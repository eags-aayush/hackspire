"""Model Evaluation & Safety Metrics Module — Phase 5.

Per ML_WORKFLOW.md §9 and Phase 5 requirements:
  - Evaluates both Phase 1 Baseline and Phase 5 Hybrid CNN-BiLSTM-Attention
  - Side-by-side comparison on identical held-out test split
  - Top metric: subsidence_risk recall compared directly against 64.94% baseline
  - Confusion matrices, per-class metrics, severity MAE
  - Attention visualization for true subsidence_risk window (channel & temporal interpretability)
"""

import os
import sys
import json
import argparse
import numpy as np
import torch
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cnn_lstm_attention import BaselineCNNLSTM, HybridCNNBILSTMAttention

MODEL_REGISTRY = os.path.join(os.path.dirname(__file__), "..", "inference-service", "model_registry")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

LABEL_NAMES = {0: "normal", 1: "equipment_noise", 2: "subsidence_risk"}
ALERT_SEVERITY_THRESHOLD = 0.3

SENSOR_COLUMNS = [
    "tilt_x_deg", "tilt_y_deg", "vibration_amplitude_g", "vibration_freq_hz",
    "crack_displacement_mm", "water_level_cm", "gas_ppm",
    "temperature_c", "humidity_pct",
]


def load_test_data():
    """Load test data from test_split.npz and return unnormalized arrays + norm stats."""
    test_path = os.path.join(MODEL_REGISTRY, "test_split.npz")
    if not os.path.exists(test_path):
        raise FileNotFoundError(f"Test split not found at {test_path}. Run train.py first.")

    test_data = np.load(test_path)
    X_test = test_data["X_test"]
    y_cls_test = test_data["y_cls_test"]
    y_sev_test = test_data["y_sev_test"]
    return X_test, y_cls_test, y_sev_test


def load_model(checkpoint_path: str):
    """Load model from checkpoint path."""
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Checkpoint not found at {checkpoint_path}")

    checkpoint = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    cfg = checkpoint["model_config"]
    model_type = checkpoint.get("model_type", "baseline")

    if model_type in ["hybrid", "hybrid_attention"]:
        model = HybridCNNBILSTMAttention(**cfg).to(DEVICE)
    else:
        model = BaselineCNNLSTM(**cfg).to(DEVICE)

    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    norm_stats = checkpoint["normalization_stats"]
    return model, model_type, checkpoint, norm_stats


def run_inference(model, X_test, norm_stats):
    """Run inference on test data (X_test in test_split.npz is pre-normalized by train.py)."""
    X_norm = X_test

    model.eval()
    all_logits = []
    all_severity = []

    with torch.no_grad():
        batch_size = 64
        for start in range(0, len(X_norm), batch_size):
            end = min(start + batch_size, len(X_norm))
            X_batch = torch.tensor(X_norm[start:end], dtype=torch.float32).to(DEVICE)
            out = model(X_batch)
            all_logits.append(out["class_logits"].cpu().numpy())
            all_severity.append(out["severity"].cpu().numpy())

    logits = np.concatenate(all_logits, axis=0)
    severity = np.concatenate(all_severity, axis=0).squeeze(-1)
    preds = logits.argmax(axis=1)

    return preds, severity, logits, X_norm


def compute_metrics(y_cls_test, y_sev_test, preds, severity_pred):
    """Compute comprehensive safety and performance metrics."""
    accuracy = float((preds == y_cls_test).mean())
    cm = confusion_matrix(y_cls_test, preds)

    precision, recall, f1, support = precision_recall_fscore_support(
        y_cls_test, preds, labels=[0, 1, 2], zero_division=0
    )

    mae_per_class = {}
    for i in range(len(LABEL_NAMES)):
        mask = y_cls_test == i
        mae_per_class[LABEL_NAMES[i]] = float(np.abs(severity_pred[mask] - y_sev_test[mask]).mean()) if mask.sum() > 0 else 0.0

    overall_mae = float(np.abs(severity_pred - y_sev_test).mean())

    # Derived alert metrics
    alert_pred = severity_pred > ALERT_SEVERITY_THRESHOLD
    alert_true = y_sev_test > ALERT_SEVERITY_THRESHOLD
    alert_recall = float((alert_pred & alert_true).sum() / max(alert_true.sum(), 1))
    alert_precision = float((alert_pred & alert_true).sum() / max(alert_pred.sum(), 1))

    return {
        "accuracy": accuracy,
        "overall_mae": overall_mae,
        "per_class_precision": {LABEL_NAMES[i]: float(precision[i]) for i in range(3)},
        "per_class_recall": {LABEL_NAMES[i]: float(recall[i]) for i in range(3)},
        "per_class_f1": {LABEL_NAMES[i]: float(f1[i]) for i in range(3)},
        "per_class_support": {LABEL_NAMES[i]: int(support[i]) for i in range(3)},
        "mae_per_class": mae_per_class,
        "alert_recall": alert_recall,
        "alert_precision": alert_precision,
        "confusion_matrix": cm,
    }


def visualize_attention(hybrid_model, X_test, y_cls_test, y_sev_test, norm_stats):
    """Extract and display channel and temporal attention maps for true subsidence_risk window."""
    is_already_normalized = abs(X_test.mean()) < 0.5 and abs(X_test.std() - 1.0) < 0.5
    if not is_already_normalized:
        mean = np.array(norm_stats["mean"], dtype=np.float32)
        std = np.array(norm_stats["std"], dtype=np.float32)
        X_norm = (X_test - mean) / std
    else:
        X_norm = X_test

    # Find subsidence_risk samples
    subsidence_indices = np.where(y_cls_test == 2)[0]
    if len(subsidence_indices) == 0:
        print("No subsidence_risk windows found in test set for attention visualization.")
        return

    # Select a representative subsidence window with significant severity
    best_idx = subsidence_indices[0]
    for idx in subsidence_indices:
        if y_sev_test[idx] >= 0.8:
            best_idx = idx
            break

    x_sample = torch.tensor(X_norm[best_idx : best_idx + 1], dtype=torch.float32).to(DEVICE)
    with torch.no_grad():
        out = hybrid_model(x_sample, return_attention=True)

    ch_attn = out["channel_attention"].cpu().numpy().squeeze(0)  # (9,)
    temp_attn = out["temporal_attention"].cpu().numpy().squeeze(0)  # (32,)
    pred_cls = out["class_logits"].argmax(dim=-1).item()
    pred_sev = out["severity"].item()

    print("\n" + "=" * 76)
    print(f"INTERPRETABILITY LAYER: ATTENTION WEIGHT VISUALIZATION (Test Window #{best_idx})")
    print("=" * 76)
    print(f"Ground Truth: {LABEL_NAMES[y_cls_test[best_idx]]} (True Severity: {y_sev_test[best_idx]:.2f})")
    print(f"Model Pred:   {LABEL_NAMES[pred_cls]} (Predicted Severity: {pred_sev:.2f} -> Alert: {HybridCNNBILSTMAttention.derive_alert_level(pred_sev)})")

    # 1. Channel Attention
    print("\n--- 1. Sensor Channel Attention Breakdown (Which sensors drove this risk call?) ---")
    sorted_ch = sorted(zip(SENSOR_COLUMNS, ch_attn), key=lambda x: x[1], reverse=True)
    for name, w in sorted_ch:
        pct = w * 100
        bar_len = int(pct * 0.8)
        bar = "#" * bar_len + "-" * max(0, 40 - bar_len)
        print(f"  {name:<24s} {pct:5.1f}% |{bar}|")

    # Verify physical sanity
    top_channels = [name for name, _ in sorted_ch[:3]]
    geotech_sensors = {"tilt_x_deg", "tilt_y_deg", "crack_displacement_mm", "water_level_cm"}
    has_geotech = any(ch in geotech_sensors for ch in top_channels)
    print(f"\nPhysical Plausibility Check: {'[PASS] Geotechnical drift sensors dominant' if has_geotech else '[WARN] Non-geotechnical sensors dominant'}")
    print(f"Top 3 influential sensors: {', '.join(top_channels)}")

    # 2. Temporal Attention Timeline (32 steps = ~16 hours of 30min intervals)
    print("\n--- 2. Temporal Attention Profile (Across 32 timesteps in rolling window) ---")
    print("Timestep Attention Profile (t=0 earliest -> t=31 latest reading):")
    max_t = temp_attn.max()
    timeline_str = "  ["
    blocks = [".", ":", "-", "=", "+", "*", "#", "%", "@"]
    for t, val in enumerate(temp_attn):
        intensity = int((val / max_t) * 8)
        timeline_str += blocks[min(intensity, 8)]
    timeline_str += "]"
    print(timeline_str)
    print("  0" + " " * 30 + "31")

    # Quantile summary
    first_half_attn = temp_attn[:16].sum() * 100
    second_half_attn = temp_attn[16:].sum() * 100
    print(f"\n  Window Progression: Early Half (t=0..15): {first_half_attn:.1f}% | Late Half (t=16..31): {second_half_attn:.1f}%")
    if second_half_attn > first_half_attn:
        print("  Notice: Attention concentrates towards the recent timesteps as deformation accelerates.")
    print("=" * 76)


def evaluate_all():
    """Runs complete side-by-side evaluation and reporting."""
    print("=" * 76)
    print("PHASE 5 — Full Hybrid Model vs Phase 1 Baseline Side-by-Side Evaluation")
    print("=" * 76)

    X_test, y_cls_test, y_sev_test = load_test_data()
    print(f"Loaded held-out test split: {len(X_test)} samples (identical across models).")

    baseline_ckpt = os.path.join(MODEL_REGISTRY, "baseline_latest.pt")
    hybrid_ckpt = os.path.join(MODEL_REGISTRY, "hybrid_attention_latest.pt")

    if not os.path.exists(hybrid_ckpt):
        raise FileNotFoundError(f"Hybrid checkpoint not found at {hybrid_ckpt}. Run train.py --model hybrid first.")

    # 1. Evaluate Baseline
    print("\nLoading Phase 1 Baseline CNN-LSTM...")
    base_model, _, base_ckpt_meta, base_stats = load_model(baseline_ckpt)
    base_preds, base_sev, base_logits, _ = run_inference(base_model, X_test, base_stats)
    base_metrics = compute_metrics(y_cls_test, y_sev_test, base_preds, base_sev)

    # 2. Evaluate Hybrid
    print("Loading Phase 5 Hybrid CNN-BiLSTM-Attention...")
    hyb_model, _, hyb_ckpt_meta, hyb_stats = load_model(hybrid_ckpt)
    hyb_preds, hyb_sev, hyb_logits, _ = run_inference(hyb_model, X_test, hyb_stats)
    hyb_metrics = compute_metrics(y_cls_test, y_sev_test, hyb_preds, hyb_sev)

    # ── SIDE-BY-SIDE SUMMARY TABLE ──
    print("\n" + "=" * 76)
    print(f"SIDE-BY-SIDE METRICS COMPARISON (Clean Unseen Event Test Set, N={len(X_test)})")
    print("=" * 76)
    print(f"{'Metric':<32s} | {'Phase 1 Baseline':<18s} | {'Phase 5 Hybrid':<18s} | {'Delta':<10s}")
    print("-" * 76)

    # Overall Accuracy
    acc_diff = (hyb_metrics["accuracy"] - base_metrics["accuracy"]) * 100
    print(f"{'Overall Accuracy':<32s} | {base_metrics['accuracy']*100:6.2f}%            | {hyb_metrics['accuracy']*100:6.2f}%            | {acc_diff:+5.2f}%")

    # Overall Severity MAE
    mae_diff = hyb_metrics["overall_mae"] - base_metrics["overall_mae"]
    print(f"{'Overall Severity MAE':<32s} | {base_metrics['overall_mae']:8.4f}           | {hyb_metrics['overall_mae']:8.4f}           | {mae_diff:+7.4f}")

    # Safety-critical subsidence_risk recall
    base_sub_rec = base_metrics["per_class_recall"]["subsidence_risk"] * 100
    hyb_sub_rec = hyb_metrics["per_class_recall"]["subsidence_risk"] * 100
    sub_diff = hyb_sub_rec - base_sub_rec
    print(f"{'[!] Subsidence Risk Recall (§9)':<32s} | {base_sub_rec:6.2f}%            | {hyb_sub_rec:6.2f}%            | {sub_diff:+5.2f}%")

    # Subsidence Risk Precision & F1
    base_sub_prec = base_metrics["per_class_precision"]["subsidence_risk"] * 100
    hyb_sub_prec = hyb_metrics["per_class_precision"]["subsidence_risk"] * 100
    base_sub_f1 = base_metrics["per_class_f1"]["subsidence_risk"] * 100
    hyb_sub_f1 = hyb_metrics["per_class_f1"]["subsidence_risk"] * 100
    print(f"{'    Subsidence Risk Precision':<32s} | {base_sub_prec:6.2f}%            | {hyb_sub_prec:6.2f}%            | {hyb_sub_prec - base_sub_prec:+5.2f}%")
    print(f"{'    Subsidence Risk F1-Score':<32s} | {base_sub_f1:6.2f}%            | {hyb_sub_f1:6.2f}%            | {hyb_sub_f1 - base_sub_f1:+5.2f}%")

    # Subsidence Risk Severity MAE
    base_sub_mae = base_metrics["mae_per_class"]["subsidence_risk"]
    hyb_sub_mae = hyb_metrics["mae_per_class"]["subsidence_risk"]
    print(f"{'    Subsidence Risk Severity MAE':<32s} | {base_sub_mae:8.4f}           | {hyb_sub_mae:8.4f}           | {hyb_sub_mae - base_sub_mae:+7.4f}")

    # Equipment Noise Metrics
    base_eq_rec = base_metrics["per_class_recall"]["equipment_noise"] * 100
    hyb_eq_rec = hyb_metrics["per_class_recall"]["equipment_noise"] * 100
    print(f"{'Equipment Noise Recall':<32s} | {base_eq_rec:6.2f}%            | {hyb_eq_rec:6.2f}%            | {hyb_eq_rec - base_eq_rec:+5.2f}%")

    # Normal Metrics
    base_norm_rec = base_metrics["per_class_recall"]["normal"] * 100
    hyb_norm_rec = hyb_metrics["per_class_recall"]["normal"] * 100
    print(f"{'Normal Baseline Recall':<32s} | {base_norm_rec:6.2f}%            | {hyb_norm_rec:6.2f}%            | {hyb_norm_rec - base_norm_rec:+5.2f}%")

    # Alert Metrics
    print(f"{'Derived Alert Recall (sev > 0.3)':<32s} | {base_metrics['alert_recall']*100:6.2f}%            | {hyb_metrics['alert_recall']*100:6.2f}%            | {(hyb_metrics['alert_recall'] - base_metrics['alert_recall'])*100:+5.2f}%")
    print(f"{'Derived Alert Precision':<32s} | {base_metrics['alert_precision']*100:6.2f}%            | {hyb_metrics['alert_precision']*100:6.2f}%            | {(hyb_metrics['alert_precision'] - base_metrics['alert_precision'])*100:+5.2f}%")
    print("-" * 76)

    # ── CONFUSION MATRICES ──
    print("\n" + "-" * 76)
    print("PHASE 1 BASELINE CONFUSION MATRIX:")
    print("-" * 76)
    header = "                    " + "  ".join(f"{LABEL_NAMES[i]:>18s}" for i in range(3))
    print(f"{'Predicted ->':>20s}")
    print(header)
    for i in range(3):
        row = f"{'Actual ' + LABEL_NAMES[i]:>20s}"
        for j in range(3):
            row += f"  {base_metrics['confusion_matrix'][i, j]:>18d}"
        print(row)

    print("\n" + "-" * 76)
    print("PHASE 5 HYBRID CONFUSION MATRIX:")
    print("-" * 76)
    print(f"{'Predicted ->':>20s}")
    print(header)
    for i in range(3):
        row = f"{'Actual ' + LABEL_NAMES[i]:>20s}"
        for j in range(3):
            row += f"  {hyb_metrics['confusion_matrix'][i, j]:>18d}"
        print(row)

    # Attention visualization
    visualize_attention(hyb_model, X_test, y_cls_test, y_sev_test, hyb_stats)

    return {
        "baseline": base_metrics,
        "hybrid": hyb_metrics,
    }


if __name__ == "__main__":
    evaluate_all()
