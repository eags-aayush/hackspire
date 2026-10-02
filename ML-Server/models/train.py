"""Offline Training Pipeline for Mine Subsidence Anomaly & Severity Model.

Phase 5 implementation per docs/ML_WORKFLOW.md §8:
  1. Load CSV sensor data, window it per-node into (window_len, n_channels) segments
  2. Pull operator-confirmed real records from Prediction Log Store (predictions.db via export_predictions.py)
  3. Per-channel z-score normalization (training-set stats only) — saves stats for inference
  4. Stratified train/val/test split
  5. Combined loss: L = L_class + λ1 * L_severity, severity masked on normal (label 0)
  6. Class weights on classification head prioritizing subsidence_risk recall
  7. Train HybridCNNBILSTMAttention (CNN + BiLSTM + Dual Attention)
  8. Save checkpoint + normalization stats + test split to model_registry/
"""

import os
import sys
import json
import time
import argparse
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split

# Add model, data, and ML-Server root dirs to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"))

from cnn_lstm_attention import BaselineCNNLSTM, HybridCNNBILSTMAttention, count_parameters

try:
    from data.export_predictions import resolve_db_path, load_predictions_from_db, extract_window_arrays
except ImportError:
    from export_predictions import resolve_db_path, load_predictions_from_db, extract_window_arrays

# ─────────────────────── Config ───────────────────────

DATA_CSV = os.path.join(os.path.dirname(__file__), "..", "data", "minegaurd_sensor_dataset.csv")
MODEL_REGISTRY = os.path.join(os.path.dirname(__file__), "..", "inference-service", "model_registry")

SENSOR_COLUMNS = [
    "tilt_x_deg", "tilt_y_deg", "vibration_amplitude_g", "vibration_freq_hz",
    "crack_displacement_mm", "water_level_cm", "gas_ppm",
    "temperature_c", "humidity_pct",
]
LABEL_COL = "label"
LABEL_MAP = {"normal": 0, "equipment_noise": 1, "subsidence_risk": 2}
LABEL_NAMES = {v: k for k, v in LABEL_MAP.items()}

WINDOW_LEN = 32       # timesteps per window (32 readings)
WINDOW_STRIDE = 8     # stride for sliding window (overlapping)
N_CHANNELS = len(SENSOR_COLUMNS)
N_CLASSES = len(LABEL_MAP)

# Training hyperparams
DEFAULT_BATCH_SIZE = 32
DEFAULT_LR = 1e-3
DEFAULT_EPOCHS = 80
LAMBDA_SEVERITY = 1.0
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
SEED = 42

# ─────────────────── Data Loading & Windowing ───────────────────


def window_readings_segment(readings, stride, node_id, block_offset):
    """Generate windows from a contiguous sequence of readings."""
    windows, classes, sevs, metas = [], [], [], []
    n = len(readings)
    for start in range(0, n - WINDOW_LEN + 1, stride):
        w_data = [readings[i][0] for i in range(start, start + WINDOW_LEN)]
        w_lbls = [readings[i][1] for i in range(start, start + WINDOW_LEN)]
        if 2 in w_lbls:
            w_cls = 2
        elif 1 in w_lbls:
            w_cls = 1
        else:
            w_cls = 0
        anom_frac = sum(1 for l in w_lbls if l > 0) / WINDOW_LEN
        sev = 0.0 if w_cls == 0 else (anom_frac * 0.5 if w_cls == 1 else max(anom_frac, 0.3))
        windows.append(w_data)
        classes.append(w_cls)
        sevs.append(sev)
        metas.append((node_id, block_offset + start, block_offset + start + WINDOW_LEN))
    if not windows:
        return np.empty((0, WINDOW_LEN, N_CHANNELS), dtype=np.float32), np.empty((0,), dtype=np.int64), np.empty((0,), dtype=np.float32), []
    return np.array(windows, dtype=np.float32), np.array(classes, dtype=np.int64), np.array(sevs, dtype=np.float32), metas


def load_clean_split_dataset(csv_path: str):
    """Loads CSV and applies an uncontaminated Source-Event and chronological split.
    
    Prevents temporal window leakage by guaranteeing that:
    1. Node ESP32_014 (Subsidence Event 2 in Zone 14) is held out as an unseen test event.
    2. Node ESP32_013 (Subsidence Event 1 in Zone 13) is partitioned chronologically into Train and Val.
    3. Normal and equipment noise nodes are partitioned by node/chronology.
    4. Exact overlap check asserts that zero test window shares any timesteps with training windows.
    """
    import csv
    from collections import defaultdict

    rows_by_node = defaultdict(list)
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            node = row["node_id"]
            sensor_vals = [float(row[col]) for col in SENSOR_COLUMNS]
            label_str = row[LABEL_COL]
            label_id = LABEL_MAP.get(label_str, 0)
            rows_by_node[node].append((sensor_vals, label_id))

    X_tr_list, y_tr_list, s_tr_list, meta_tr = [], [], [], []
    X_va_list, y_va_list, s_va_list, meta_va = [], [], [], []
    X_te_list, y_te_list, s_te_list, meta_te = [], [], [], []

    # Train normal nodes (ESP32_001 to ESP32_009)
    train_normal_nodes = [f"ESP32_{i:03d}" for i in range(1, 10)]
    for node in train_normal_nodes:
        x, y, s, m = window_readings_segment(rows_by_node[node], stride=WINDOW_STRIDE, node_id=node, block_offset=0)
        X_tr_list.append(x); y_tr_list.append(y); s_tr_list.append(s); meta_tr.extend(m)

    # Val normal nodes (ESP32_010 to ESP32_012)
    val_normal_nodes = [f"ESP32_{i:03d}" for i in range(10, 13)]
    for node in val_normal_nodes:
        x, y, s, m = window_readings_segment(rows_by_node[node], stride=WINDOW_STRIDE, node_id=node, block_offset=0)
        X_va_list.append(x); y_va_list.append(y); s_va_list.append(s); meta_va.extend(m)

    # Test normal nodes (ESP32_015)
    for node in ["ESP32_015"]:
        x, y, s, m = window_readings_segment(rows_by_node[node], stride=WINDOW_STRIDE, node_id=node, block_offset=0)
        X_te_list.append(x); y_te_list.append(y); s_te_list.append(s); meta_te.extend(m)

    # Node ESP32_013 (Subsidence Event 1, Zone 13):
    # Readings 0..719: normal/noise -> assigned to Train
    x_013_norm, y_013_norm, s_013_norm, m_013_norm = window_readings_segment(rows_by_node["ESP32_013"][:720], stride=WINDOW_STRIDE, node_id="ESP32_013", block_offset=0)
    X_tr_list.append(x_013_norm); y_tr_list.append(y_013_norm); s_tr_list.append(s_013_norm); meta_tr.extend(m_013_norm)
    # Readings 720..879 (160 readings): early subsidence -> Train (stride=1)
    x_013_sub_tr, y_013_sub_tr, s_013_sub_tr, m_013_sub_tr = window_readings_segment(rows_by_node["ESP32_013"][720:880], stride=1, node_id="ESP32_013", block_offset=720)
    X_tr_list.append(x_013_sub_tr); y_tr_list.append(y_013_sub_tr); s_tr_list.append(s_013_sub_tr); meta_tr.extend(m_013_sub_tr)
    # Readings 880..959 (80 readings): late subsidence -> Val (stride=1)
    x_013_sub_va, y_013_sub_va, s_013_sub_va, m_013_sub_va = window_readings_segment(rows_by_node["ESP32_013"][880:960], stride=1, node_id="ESP32_013", block_offset=880)
    X_va_list.append(x_013_sub_va); y_va_list.append(y_013_sub_va); s_va_list.append(s_013_sub_va); meta_va.extend(m_013_sub_va)

    # Node ESP32_014 (Subsidence Event 2, Zone 14): HELD OUT COMPLETELY IN TEST
    # Normal/noise readings 0..815 (stride=8)
    x_014_norm, y_014_norm, s_014_norm, m_014_norm = window_readings_segment(rows_by_node["ESP32_014"][:816], stride=WINDOW_STRIDE, node_id="ESP32_014", block_offset=0)
    X_te_list.append(x_014_norm); y_te_list.append(y_014_norm); s_te_list.append(s_014_norm); meta_te.extend(m_014_norm)
    # Subsidence readings 816..959 (144 readings, stride=1)
    x_014_sub, y_014_sub, s_014_sub, m_014_sub = window_readings_segment(rows_by_node["ESP32_014"][816:960], stride=1, node_id="ESP32_014", block_offset=816)
    X_te_list.append(x_014_sub); y_te_list.append(y_014_sub); s_te_list.append(s_014_sub); meta_te.extend(m_014_sub)

    X_train = np.concatenate(X_tr_list, axis=0); y_cls_train = np.concatenate(y_tr_list, axis=0); y_sev_train = np.concatenate(s_tr_list, axis=0)
    X_val = np.concatenate(X_va_list, axis=0); y_cls_val = np.concatenate(y_va_list, axis=0); y_sev_val = np.concatenate(s_va_list, axis=0)
    X_test = np.concatenate(X_te_list, axis=0); y_cls_test = np.concatenate(y_te_list, axis=0); y_sev_test = np.concatenate(s_te_list, axis=0)

    # Mandatory Step 0 Leakage Verification Assert
    overlap_count = 0
    for te_node, te_s, te_e in meta_te:
        for tr_node, tr_s, tr_e in meta_tr:
            if te_node == tr_node and not (te_e <= tr_s or te_s >= tr_e):
                overlap_count += 1

    if overlap_count > 0:
        raise ValueError(f"FATAL LEAKAGE DETECTED: {overlap_count} test windows overlap with training set windows!")

    print(f"  [Integrity Audit] Leakage Verification: 0 overlapping windows between Train and Test splits. (Status: CLEAN)")
    return X_train, y_cls_train, y_sev_train, X_val, y_cls_val, y_sev_val, X_test, y_cls_test, y_sev_test


def load_confirmed_real_predictions() -> tuple:
    """Loads operator-confirmed predictions from SQLite store (predictions.db).

    Returns:
        X_conf: np.ndarray (N, 32, 9) or empty
        y_cls_conf: np.ndarray (N,) or empty
        y_sev_conf: np.ndarray (N,) or empty
    """
    try:
        db_path = resolve_db_path()
        if not os.path.exists(db_path):
            return np.empty((0, WINDOW_LEN, N_CHANNELS), dtype=np.float32), np.empty((0,), dtype=np.int64), np.empty((0,), dtype=np.float32)

        df = load_predictions_from_db(db_path, confirmed_only=True)
        if df.empty:
            return np.empty((0, WINDOW_LEN, N_CHANNELS), dtype=np.float32), np.empty((0,), dtype=np.int64), np.empty((0,), dtype=np.float32)

        X_conf, stats = extract_window_arrays(df)
        if len(X_conf) == 0:
            return np.empty((0, WINDOW_LEN, N_CHANNELS), dtype=np.float32), np.empty((0,), dtype=np.int64), np.empty((0,), dtype=np.float32)

        y_cls_list = []
        y_sev_list = []
        for _, row in df.iterrows():
            lbl_name = str(row["confirmed_label"]).strip()
            lbl_id = LABEL_MAP.get(lbl_name, 0)
            sev = float(row["severity"]) if row["severity"] is not None else (0.8 if lbl_id == 2 else 0.0)
            y_cls_list.append(lbl_id)
            y_sev_list.append(sev)

        y_cls_conf = np.array(y_cls_list, dtype=np.int64)
        y_sev_conf = np.array(y_sev_list, dtype=np.float32)

        print(f"  [Real Data Ingestion] Loaded {len(X_conf)} operator-confirmed windows from {os.path.basename(db_path)}")
        return X_conf, y_cls_conf, y_sev_conf
    except Exception as e:
        print(f"  [Real Data Ingestion] Notice: could not load confirmed predictions ({e}); continuing with synthetic dataset.")
        return np.empty((0, WINDOW_LEN, N_CHANNELS), dtype=np.float32), np.empty((0,), dtype=np.int64), np.empty((0,), dtype=np.float32)


# ─────────────────── Normalization ───────────────────


def compute_normalization_stats(X_train: np.ndarray) -> dict:
    """Compute per-channel mean and std from training data only."""
    mean = X_train.mean(axis=(0, 1))
    std = X_train.std(axis=(0, 1))
    std = np.where(std < 1e-8, 1.0, std)
    return {"mean": mean.tolist(), "std": std.tolist()}


def normalize(X: np.ndarray, stats: dict) -> np.ndarray:
    """Apply per-channel z-score normalization."""
    mean = np.array(stats["mean"], dtype=np.float32)
    std = np.array(stats["std"], dtype=np.float32)
    return (X - mean) / std


# ─────────────────── Dataset Class ───────────────────


class SensorWindowDataset(Dataset):
    """PyTorch Dataset for windowed sensor data."""

    def __init__(self, X: np.ndarray, y_class: np.ndarray, y_severity: np.ndarray):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y_class = torch.tensor(y_class, dtype=torch.long)
        self.y_severity = torch.tensor(y_severity, dtype=torch.float32)

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        return self.X[idx], self.y_class[idx], self.y_severity[idx]


# ─────────────────── Training ───────────────────


def compute_class_weights(y: np.ndarray, n_classes: int) -> torch.Tensor:
    """Compute inverse-frequency class weights for weighted cross-entropy."""
    counts = np.bincount(y, minlength=n_classes).astype(np.float64)
    weights = 1.0 / (counts + 1e-6)
    weights = weights / weights.sum() * n_classes
    return torch.tensor(weights, dtype=torch.float32)


def train_model(
    model_type: str = "hybrid",
    epochs: int = DEFAULT_EPOCHS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    learning_rate: float = DEFAULT_LR,
):
    """Full training pipeline for Phase 5."""
    print("=" * 70)
    if model_type == "hybrid":
        print("PHASE 5 — Hybrid CNN-BiLSTM-Attention Training Pipeline")
    else:
        print("PHASE 1 — Baseline CNN-LSTM Training Pipeline (Fallback)")
    print("=" * 70)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    # ── 1. Load data with clean Source-Event split (zero leakage) ──
    print("\n[1/6] Loading sensor data with clean Source-Event & chronological partitioning...")
    csv_path = os.path.normpath(DATA_CSV)
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")

    X_train, y_cls_train, y_sev_train, X_val, y_cls_val, y_sev_val, X_test, y_cls_test, y_sev_test = \
        load_clean_split_dataset(csv_path)

    # ── 2. Real Confirmed Rows Ingestion (Phase 4 -> Phase 5 bridge) ──
    X_conf, y_cls_conf, y_sev_conf = load_confirmed_real_predictions()
    if len(X_conf) > 0:
        X_train = np.concatenate([X_train, X_conf], axis=0)
        y_cls_train = np.concatenate([y_cls_train, y_cls_conf], axis=0)
        y_sev_train = np.concatenate([y_sev_train, y_sev_conf], axis=0)
        print(f"  Merged {len(X_conf)} confirmed row(s) into training partition.")

    print(f"  Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    for u in range(N_CLASSES):
        print(f"  Class {u} ({LABEL_NAMES[u]}): Train={(y_cls_train == u).sum()} | Val={(y_cls_val == u).sum()} | Test={(y_cls_test == u).sum()}")

    # ── 3. Normalize using training stats only ──
    print("\n[3/6] Computing normalization stats (training set only)...")
    norm_stats = compute_normalization_stats(X_train)

    X_train = normalize(X_train, norm_stats)
    X_val = normalize(X_val, norm_stats)
    X_test = normalize(X_test, norm_stats)

    # ── 3b. Oversample minority classes in training set ──
    print("\n[3b/6] Oversampling minority classes in training set...")
    y_cls_train_original = y_cls_train.copy()
    train_counts = np.bincount(y_cls_train, minlength=N_CLASSES)
    max_count = train_counts.max()
    print(f"  Before oversampling: {dict(enumerate(train_counts.tolist()))}")

    oversampled_X = [X_train]
    oversampled_cls = [y_cls_train]
    oversampled_sev = [y_sev_train]

    rng = np.random.RandomState(SEED)
    for cls_id in range(N_CLASSES):
        cls_mask = y_cls_train == cls_id
        cls_count = cls_mask.sum()
        if cls_count < max_count and cls_count > 0:
            n_needed = max_count - cls_count
            indices = rng.choice(np.where(cls_mask)[0], size=n_needed, replace=True)
            jitter = rng.normal(0, 0.05, size=(n_needed, X_train.shape[1], X_train.shape[2])).astype(np.float32)
            oversampled_X.append(X_train[indices] + jitter)
            oversampled_cls.append(y_cls_train[indices])
            oversampled_sev.append(y_sev_train[indices])

    X_train = np.concatenate(oversampled_X, axis=0)
    y_cls_train = np.concatenate(oversampled_cls, axis=0)
    y_sev_train = np.concatenate(oversampled_sev, axis=0)

    perm = rng.permutation(len(X_train))
    X_train = X_train[perm]
    y_cls_train = y_cls_train[perm]
    y_sev_train = y_sev_train[perm]

    train_counts_after = np.bincount(y_cls_train, minlength=N_CLASSES)
    print(f"  After oversampling:  {dict(enumerate(train_counts_after.tolist()))}")

    # ── 4. Build datasets and dataloaders ──
    train_ds = SensorWindowDataset(X_train, y_cls_train, y_sev_train)
    val_ds = SensorWindowDataset(X_val, y_cls_val, y_sev_val)
    test_ds = SensorWindowDataset(X_test, y_cls_test, y_sev_test)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, drop_last=False)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    # ── 5. Build model and optimizer ──
    print(f"\n[4/6] Building model (type={model_type}, device={DEVICE})...")
    if model_type == "hybrid":
        model = HybridCNNBILSTMAttention(
            n_channels=N_CHANNELS,
            window_len=WINDOW_LEN,
            n_classes=N_CLASSES,
            cnn_filters=48,
            bilstm_hidden=64,
            fusion_dim=96,
            dropout=0.3,
        ).to(DEVICE)
        model_cfg = {
            "n_channels": N_CHANNELS,
            "window_len": WINDOW_LEN,
            "n_classes": N_CLASSES,
            "cnn_filters": 48,
            "bilstm_hidden": 64,
            "fusion_dim": 96,
            "dropout": 0.3,
        }
    else:
        model = BaselineCNNLSTM(
            n_channels=N_CHANNELS,
            window_len=WINDOW_LEN,
            n_classes=N_CLASSES,
            cnn_filters=32,
            cnn_kernel=5,
            lstm_hidden=64,
            dropout=0.3,
        ).to(DEVICE)
        model_cfg = {
            "n_channels": N_CHANNELS,
            "window_len": WINDOW_LEN,
            "n_classes": N_CLASSES,
            "cnn_filters": 32,
            "cnn_kernel": 5,
            "lstm_hidden": 64,
            "dropout": 0.3,
        }

    print(f"  Trainable parameters: {count_parameters(model):,}")

    # Class weights for safety-critical subsidence_risk recall
    class_weights = compute_class_weights(y_cls_train_original, N_CLASSES).to(DEVICE)
    # Extra safety boost for subsidence_risk (class 2) per §6 & §9: low false-negative tolerance
    class_weights[2] *= 3.5
    print(f"  Class weights: {[round(w, 4) for w in class_weights.tolist()]}")

    cls_criterion = nn.CrossEntropyLoss(weight=class_weights)
    sev_criterion = nn.MSELoss(reduction="none")
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=6)

    # ── 6. Training loop ──
    print(f"\n[5/6] Training for {epochs} epochs...")
    best_val_loss = float("inf")
    best_epoch = 0
    patience_counter = 0
    patience_limit = 15
    train_losses = []
    val_losses = []
    best_state = None

    for epoch in range(1, epochs + 1):
        model.train()
        epoch_cls_loss = 0.0
        epoch_sev_loss = 0.0
        n_batches = 0

        for X_batch, y_cls_batch, y_sev_batch in train_loader:
            X_batch = X_batch.to(DEVICE)
            y_cls_batch = y_cls_batch.to(DEVICE)
            y_sev_batch = y_sev_batch.to(DEVICE)

            optimizer.zero_grad()
            out = model(X_batch)

            loss_cls = cls_criterion(out["class_logits"], y_cls_batch)

            # Severity loss: mask normal windows (0.01), weigh equipment_noise (1.0), boost subsidence_risk (2.0)
            sev_pred = out["severity"].squeeze(-1)
            sev_loss_raw = sev_criterion(sev_pred, y_sev_batch)
            sev_mask = torch.where(y_cls_batch == 2, 2.0, torch.where(y_cls_batch == 1, 1.0, 0.01))
            loss_sev = (sev_loss_raw * sev_mask).mean()

            loss = loss_cls + LAMBDA_SEVERITY * loss_sev
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            epoch_cls_loss += loss_cls.item()
            epoch_sev_loss += loss_sev.item()
            n_batches += 1

        avg_train_cls = epoch_cls_loss / n_batches
        avg_train_sev = epoch_sev_loss / n_batches
        avg_train_total = avg_train_cls + LAMBDA_SEVERITY * avg_train_sev
        train_losses.append(avg_train_total)

        # Validation
        model.eval()
        val_cls_loss = 0.0
        val_sev_loss = 0.0
        val_batches = 0

        with torch.no_grad():
            for X_batch, y_cls_batch, y_sev_batch in val_loader:
                X_batch = X_batch.to(DEVICE)
                y_cls_batch = y_cls_batch.to(DEVICE)
                y_sev_batch = y_sev_batch.to(DEVICE)

                out = model(X_batch)
                loss_cls = cls_criterion(out["class_logits"], y_cls_batch)
                sev_pred = out["severity"].squeeze(-1)
                sev_loss_raw = sev_criterion(sev_pred, y_sev_batch)
                sev_mask = torch.where(y_cls_batch == 2, 2.0, torch.where(y_cls_batch == 1, 1.0, 0.01))
                loss_sev = (sev_loss_raw * sev_mask).mean()

                val_cls_loss += loss_cls.item()
                val_sev_loss += loss_sev.item()
                val_batches += 1

        avg_val_cls = val_cls_loss / val_batches
        avg_val_sev = val_sev_loss / val_batches
        avg_val_total = avg_val_cls + LAMBDA_SEVERITY * avg_val_sev
        val_losses.append(avg_val_total)

        scheduler.step(avg_val_total)

        if epoch % 5 == 0 or epoch == 1:
            print(f"  Epoch {epoch:3d}/{epochs} | "
                  f"Train: cls={avg_train_cls:.4f} sev={avg_train_sev:.4f} total={avg_train_total:.4f} | "
                  f"Val: cls={avg_val_cls:.4f} sev={avg_val_sev:.4f} total={avg_val_total:.4f} | "
                  f"LR={optimizer.param_groups[0]['lr']:.1e}")

        # Early stopping
        if avg_val_total < best_val_loss:
            best_val_loss = avg_val_total
            best_epoch = epoch
            patience_counter = 0
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        else:
            patience_counter += 1
            if patience_counter >= patience_limit:
                print(f"\n  Early stopping at epoch {epoch} (best was epoch {best_epoch})")
                break

    if best_state is not None:
        model.load_state_dict(best_state)
    print(f"\n  Best validation loss: {best_val_loss:.4f} at epoch {best_epoch}")

    # ── 7. Save checkpoint ──
    print(f"\n[6/6] Saving checkpoint to model_registry/...")
    os.makedirs(MODEL_REGISTRY, exist_ok=True)
    version = time.strftime("%Y%m%d_%H%M%S")

    checkpoint = {
        "model_type": model_type,
        "model_state_dict": model.state_dict(),
        "model_config": model_cfg,
        "normalization_stats": norm_stats,
        "channel_order": SENSOR_COLUMNS,
        "label_map": LABEL_MAP,
        "label_names": LABEL_NAMES,
        "version": version,
        "best_epoch": best_epoch,
        "best_val_loss": best_val_loss,
        "confirmed_rows_loaded": len(X_conf),
        "training_config": {
            "model_type": model_type,
            "batch_size": batch_size,
            "learning_rate": learning_rate,
            "epochs_trained": epoch,
            "lambda_severity": LAMBDA_SEVERITY,
            "window_len": WINDOW_LEN,
            "window_stride": WINDOW_STRIDE,
            "seed": SEED,
        },
    }

    if model_type == "hybrid":
        ckpt_filename = f"hybrid_attention_v{version}.pt"
        latest_filename = "hybrid_attention_latest.pt"
    else:
        ckpt_filename = f"baseline_v{version}.pt"
        latest_filename = "baseline_latest.pt"

    ckpt_path = os.path.join(MODEL_REGISTRY, ckpt_filename)
    latest_path = os.path.join(MODEL_REGISTRY, latest_filename)

    torch.save(checkpoint, ckpt_path)
    torch.save(checkpoint, latest_path)
    print(f"  Saved Checkpoint: {ckpt_path}")
    print(f"  Saved Latest Link: {latest_path}")

    # Save normalization stats json
    stats_path = os.path.join(MODEL_REGISTRY, "normalization_stats.json")
    with open(stats_path, "w") as f:
        json.dump(norm_stats, f, indent=2)
    print(f"  Saved Normalization Stats: {stats_path}")

    # Save test data for evaluate.py
    test_data_path = os.path.join(MODEL_REGISTRY, "test_split.npz")
    np.savez(test_data_path,
             X_test=X_test,
             y_cls_test=y_cls_test,
             y_sev_test=y_sev_test)
    print(f"  Test split: {test_data_path}")

    print("\n" + "=" * 70)
    print("Training complete. Run evaluate.py to see comparison against baseline.")
    print("=" * 70)

    return ckpt_path


def main():
    parser = argparse.ArgumentParser(description="Train Mine Subsidence Anomaly & Severity Model")
    parser.add_argument("--model", type=str, choices=["hybrid", "baseline"], default="hybrid", help="Model architecture")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS, help="Maximum epochs")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Batch size")
    parser.add_argument("--lr", type=float, default=DEFAULT_LR, help="Learning rate")

    args = parser.parse_args()
    train_model(
        model_type=args.model,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
    )


if __name__ == "__main__":
    main()
