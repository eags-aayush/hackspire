"""
Prediction Log Store Exporter & Retraining Foundation (ML_WORKFLOW.md §10.4, §10.5)

Exports stored inference predictions from the SQLite store (or Backend REST API)
into Pandas DataFrames and CSV formats for Phase 5+ offline retraining.
Validates (32, 9) input window array deserialization.
"""

import os
import sys
import json
import sqlite3
import argparse
from typing import Optional, Tuple, Dict, Any
import numpy as np
import pandas as pd


DEFAULT_DB_CANDIDATES = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend", "data", "predictions.db")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "predictions.db")),
    os.path.abspath(os.path.join(os.getcwd(), "backend", "data", "predictions.db")),
    os.path.abspath(os.path.join(os.getcwd(), "data", "predictions.db")),
]


def resolve_db_path(custom_path: Optional[str] = None) -> str:
    """Finds the predictions.db SQLite database file."""
    if custom_path and os.path.exists(custom_path):
        return os.path.abspath(custom_path)

    env_path = os.environ.get("ML_LOG_STORE_PATH")
    if env_path and os.path.exists(env_path):
        return os.path.abspath(env_path)

    for cand in DEFAULT_DB_CANDIDATES:
        if os.path.exists(cand):
            return cand

    # Fallback to default expected path even if file not created yet
    return DEFAULT_DB_CANDIDATES[0]


def load_predictions_from_db(
    db_path: str,
    node_id: Optional[str] = None,
    zone_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    predicted_class: Optional[str] = None,
    confirmed_only: bool = False,
    limit: Optional[int] = None,
) -> pd.DataFrame:
    """
    Queries prediction_logs from the SQLite database into a Pandas DataFrame.
    """
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Prediction store database not found at {db_path}")

    conn = sqlite3.connect(db_path)
    try:
        where_clauses = []
        params = []

        if node_id:
            where_clauses.append("node_id = ?")
            params.append(node_id)
        if zone_id:
            where_clauses.append("zone_id = ?")
            params.append(zone_id)
        if start_date:
            where_clauses.append("timestamp >= ?")
            params.append(start_date)
        if end_date:
            where_clauses.append("timestamp <= ?")
            params.append(end_date)
        if predicted_class:
            where_clauses.append("predicted_class = ?")
            params.append(predicted_class)
        if confirmed_only:
            where_clauses.append("confirmed_label IS NOT NULL")

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        limit_sql = f"LIMIT {int(limit)}" if limit else ""

        query = f"""
            SELECT
                prediction_id,
                node_id,
                zone_id,
                timestamp,
                predicted_class,
                severity,
                alert_level,
                model_version,
                inference_latency_ms,
                confirmed_label,
                class_probs,
                input_window,
                created_at
            FROM prediction_logs
            {where_sql}
            ORDER BY timestamp ASC
            {limit_sql}
        """

        df = pd.read_sql_query(query, conn, params=params)
        return df
    finally:
        conn.close()


def load_predictions_from_api(
    base_url: str = "http://localhost:3000",
    node_id: Optional[str] = None,
    zone_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> pd.DataFrame:
    """
    Fetches prediction records from the Backend REST API endpoint.
    """
    import urllib.request
    import urllib.parse

    params = {}
    if node_id: params["nodeId"] = node_id
    if zone_id: params["zoneId"] = zone_id
    if start_date: params["startDate"] = start_date
    if end_date: params["endDate"] = end_date
    params["format"] = "json"

    query_str = urllib.parse.urlencode(params)
    url = f"{base_url.rstrip('/')}/ml/predictions/export?{query_str}"

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.loads(response.read().decode("utf-8"))

    records = data.get("records", [])
    return pd.DataFrame(records)


def extract_window_arrays(df: pd.DataFrame) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Deserializes the 'input_window' JSON column in the DataFrame into a
    3D NumPy array of shape (N, 32, 9) and dtype float32.

    Returns:
        X: np.ndarray of shape (N, 32, 9)
        stats: dictionary of validation metrics
    """
    if df.empty or "input_window" not in df.columns:
        return np.empty((0, 32, 9), dtype=np.float32), {"count": 0, "valid": True}

    windows = []
    corrupted_count = 0

    for idx, raw in enumerate(df["input_window"]):
        try:
            if isinstance(raw, str):
                w = json.loads(raw)
            elif isinstance(raw, (list, tuple)):
                w = raw
            else:
                w = []

            arr = np.array(w, dtype=np.float32)
            if arr.shape == (32, 9) and not np.isnan(arr).any():
                windows.append(arr)
            else:
                corrupted_count += 1
        except Exception:
            corrupted_count += 1

    if not windows:
        return np.empty((0, 32, 9), dtype=np.float32), {
            "count": 0,
            "corrupted": corrupted_count,
            "valid": False,
        }

    X = np.stack(windows, axis=0)
    stats = {
        "count": len(X),
        "shape": X.shape,
        "corrupted": corrupted_count,
        "valid": corrupted_count == 0,
        "min": float(np.min(X)),
        "max": float(np.max(X)),
        "mean": float(np.mean(X)),
    }
    return X, stats


def set_confirmed_label_db(db_path: str, prediction_id: str, label: str) -> bool:
    """Updates confirmed_label for a given prediction_id directly in SQLite."""
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE prediction_logs SET confirmed_label = ? WHERE prediction_id = ?",
            (label, prediction_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Export logged predictions for retraining (Phase 4)")
    parser.add_argument("--db", type=str, default=None, help="Path to predictions.db SQLite file")
    parser.add_argument("--api", type=str, default=None, help="Backend API base URL (e.g. http://localhost:3000)")
    parser.add_argument("--node", type=str, default=None, help="Filter by nodeId")
    parser.add_argument("--zone", type=str, default=None, help="Filter by zoneId")
    parser.add_argument("--start", type=str, default=None, help="Start timestamp ISO or YYYY-MM-DD")
    parser.add_argument("--end", type=str, default=None, help="End timestamp ISO or YYYY-MM-DD")
    parser.add_argument("--class-name", type=str, default=None, help="Filter by predicted_class")
    parser.add_argument("--confirmed-only", action="store_true", help="Only export operator-confirmed labels")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of exported rows")
    parser.add_argument("--out", type=str, default=None, help="Output CSV file path")
    parser.add_argument("--verify", action="store_true", help="Validate (32, 9) input_window round-trip deserialization")
    parser.add_argument("--confirm-id", type=str, default=None, help="Prediction ID to attach ground truth label to")
    parser.add_argument("--confirm-label", type=str, default=None, help="Ground truth label to attach")

    args = parser.parse_args()

    db_path = resolve_db_path(args.db)

    # Label update CLI action
    if args.confirm_id and args.confirm_label:
        success = set_confirmed_label_db(db_path, args.confirm_id, args.confirm_label)
        if success:
            print(f"[SUCCESS] Updated prediction {args.confirm_id} -> confirmed_label: '{args.confirm_label}'")
        else:
            print(f"[FAILED] Prediction ID {args.confirm_id} not found in {db_path}")
        return

    print(f"=== Mine Subsidence Prediction Log Store Exporter ===")
    if args.api:
        print(f"Source: Backend API ({args.api})")
        df = load_predictions_from_api(
            base_url=args.api,
            node_id=args.node,
            zone_id=args.zone,
            start_date=args.start,
            end_date=args.end,
        )
    else:
        print(f"Source: SQLite Database ({db_path})")
        df = load_predictions_from_db(
            db_path=db_path,
            node_id=args.node,
            zone_id=args.zone,
            start_date=args.start,
            end_date=args.end,
            predicted_class=args.class_name,
            confirmed_only=args.confirmed_only,
            limit=args.limit,
        )

    print(f"Loaded {len(df)} prediction rows.")

    if len(df) > 0:
        class_counts = df["predicted_class"].value_counts().to_dict()
        print(f"Class distribution: {class_counts}")
        confirmed_count = df["confirmed_label"].dropna().count()
        print(f"Operator-confirmed labels: {confirmed_count}")

        if args.verify:
            print("\n--- Validating (32, 9) Input Window Deserialization ---")
            X, stats = extract_window_arrays(df)
            print(f"Extracted tensor shape: {X.shape} (dtype: {X.dtype})")
            print(f"Tensor stats: min={stats.get('min', 0):.4f}, max={stats.get('max', 0):.4f}, mean={stats.get('mean', 0):.4f}")
            print(f"Corrupted/Invalid windows: {stats.get('corrupted', 0)}")
            assert stats["valid"], "Validation failed: corrupted windows detected!"
            print("[PASS] All input windows successfully round-tripped into valid (32, 9) arrays!")

        if args.out:
            df.to_csv(args.out, index=False)
            print(f"\nExported {len(df)} rows to {args.out}")


if __name__ == "__main__":
    main()
