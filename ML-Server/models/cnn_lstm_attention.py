"""CNN + BiLSTM + Attention Hybrid Model for Mine Subsidence Early Warning.

Phase 5 implementation per docs/ML_WORKFLOW.md §5:
  1. 1D-CNN branch: captures rapid local transients (vibration bursts, crack displacement jumps, gas spikes).
  2. BiLSTM branch: captures slow, multi-hour continuous drift (gradual tilt accumulation, water table creep).
     Bidirectional architecture confirmed: provides forward accumulation trajectory and backward context relative
     to pre-event baseline across the 32-timestep window.
  3. Dual Attention interpretability layer:
     - Channel Attention (CBAM-style): Combines average pooling (drift) and peak excursion (shock) to produce
       independent sensor activation gates in [0, 1] for operator justification.
     - Temporal Attention: Softmax distribution over the 32 timesteps to pinpoint critical event timestamps.
  4. MSHA / DGMS static context fusion branch:
     - Step 0 Scope Decision: Out of scope for Phase 5. No confirmed DGMS (Directorate General of Mines Safety,
       India) or coal mine static geology tabular dataset exists yet. Documented as an explicit extension gap.
  5. Multi-task output heads:
     - 3-way classification logits (normal, equipment_noise, subsidence_risk).
     - Continuous severity regression in [0, 1] via Sigmoid.
     - Derived monotonic alert mapping (GREEN, YELLOW, ORANGE, RED).

BaselineCNNLSTM is preserved intact below for comparison and fallback per §11.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Tuple, Optional


class ChannelAttention(nn.Module):
    """CBAM-style Channel Attention over the 9 physical sensor channels.

    Combines Global Average Pooling (drift detection) and Global Max Pooling
    (shock/spike detection) to produce calibrated sensor activation gates in [0, 1].
    """

    def __init__(self, n_channels: int = 9, hidden_dim: int = 32):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(n_channels * 2, hidden_dim),
            nn.ReLU(inplace=True),
            nn.Linear(hidden_dim, n_channels),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Forward pass.

        Args:
            x: (batch, window_len, n_channels)

        Returns:
            x_weighted: (batch, window_len, n_channels)
            weights: (batch, n_channels) activation gates in [0, 1]
        """
        # Average pooling captures slow continuous baseline drift
        gap = x.mean(dim=1)  # (batch, n_channels)
        # Max pooling of absolute excursion captures transient shock / burst peaks
        gmp = x.abs().max(dim=1).values  # (batch, n_channels)
        combined = torch.cat([gap, gmp], dim=-1)  # (batch, 2 * n_channels)

        weights = self.fc(combined)  # (batch, n_channels) in [0, 1]
        x_weighted = x * weights.unsqueeze(1)
        return x_weighted, weights


class TemporalAttention(nn.Module):
    """Additive Bahdanau-style Temporal Attention over the 32 sliding window timesteps.

    Highlights which timesteps within the rolling window contributed most to the
    subsidence or equipment anomaly prediction.
    """

    def __init__(self, feature_dim: int, hidden_dim: int = 64):
        super().__init__()
        self.proj = nn.Linear(feature_dim, hidden_dim)
        self.v = nn.Linear(hidden_dim, 1, bias=False)

    def forward(self, features: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Forward pass.

        Args:
            features: (batch, window_len, feature_dim)

        Returns:
            context: (batch, feature_dim) weighted sum of features
            weights: (batch, window_len) softmax weights summing to 1
        """
        # (batch, window_len, hidden_dim)
        u = torch.tanh(self.proj(features))
        # (batch, window_len)
        scores = self.v(u).squeeze(-1)
        weights = F.softmax(scores, dim=-1)

        # Context vector: (batch, feature_dim)
        context = torch.bmm(weights.unsqueeze(1), features).squeeze(1)
        return context, weights


class HybridCNNBILSTMAttention(nn.Module):
    """Full Hybrid Architecture: 1D-CNN + BiLSTM + Dual Attention + Multi-Task Heads.

    Args:
        n_channels: Number of sensor channels (9 in current schema).
        window_len: Length of sliding window (32 timesteps).
        n_classes: Number of anomaly classes (3: normal, equipment_noise, subsidence_risk).
        cnn_filters: Filter channels for 1D convolutions.
        bilstm_hidden: Hidden units per direction for BiLSTM.
        fusion_dim: Dimension of the unified feature representation.
        dropout: Dropout probability.
    """

    def __init__(
        self,
        n_channels: int = 9,
        window_len: int = 32,
        n_classes: int = 3,
        cnn_filters: int = 48,
        bilstm_hidden: int = 64,
        fusion_dim: int = 96,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.n_channels = n_channels
        self.window_len = window_len
        self.n_classes = n_classes

        # ── Interpretability: CBAM Channel Attention on Input Sensors ──
        self.channel_attention = ChannelAttention(n_channels=n_channels, hidden_dim=32)

        # ── 1D-CNN Branch: Local Spikes & High-Frequency Transients ──
        # Operates on (batch, n_channels, window_len)
        self.cnn = nn.Sequential(
            nn.Conv1d(n_channels, cnn_filters, kernel_size=3, padding=1),
            nn.BatchNorm1d(cnn_filters),
            nn.GELU(),
            nn.Dropout(dropout * 0.5),
            nn.Conv1d(cnn_filters, cnn_filters, kernel_size=5, padding=2),
            nn.BatchNorm1d(cnn_filters),
            nn.GELU(),
            nn.Dropout(dropout * 0.5),
        )

        # ── BiLSTM Branch: Slow Multi-Hour Drift & Structural Creep ──
        # BiLSTM choice: bidirectional context across the fixed 32-step window
        # captures inflection points (pre-event stability vs post-event movement)
        self.bilstm = nn.LSTM(
            input_size=n_channels,
            hidden_size=bilstm_hidden,
            num_layers=1,
            batch_first=True,
            bidirectional=True,
        )
        bilstm_out_dim = bilstm_hidden * 2

        # ── Fusion Layer: Merges Local (CNN) and Drift (BiLSTM) features ──
        merged_dim = cnn_filters + bilstm_out_dim
        self.fusion = nn.Sequential(
            nn.Linear(merged_dim, fusion_dim),
            nn.LayerNorm(fusion_dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # ── Temporal Attention over Merged Sequence ──
        self.temporal_attention = TemporalAttention(feature_dim=fusion_dim, hidden_dim=48)

        # ── Multi-Task Output Heads ──
        # Classification Head (3-class)
        self.cls_head = nn.Sequential(
            nn.Linear(fusion_dim, 48),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(48, n_classes),
        )

        # Severity Regression Head (0.0 to 1.0 continuous)
        self.sev_head = nn.Sequential(
            nn.Linear(fusion_dim, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor, return_attention: bool = False) -> Dict[str, torch.Tensor]:
        """Forward pass.

        Args:
            x: (batch, window_len, n_channels) float32 tensor
            return_attention: If True, includes attention maps in returned dict

        Returns:
            dict containing:
              - 'class_logits': (batch, n_classes) raw classification logits
              - 'severity': (batch, 1) continuous severity in [0, 1]
              - 'channel_attention': (batch, n_channels) sensor activation gates (if return_attention)
              - 'temporal_attention': (batch, window_len) timestep weights (if return_attention)
        """
        # 1. Channel Attention on physical sensors
        x_ch_weighted, ch_weights = self.channel_attention(x)

        # 2. CNN Branch: local transients
        x_cnn_in = x_ch_weighted.transpose(1, 2)
        cnn_features = self.cnn(x_cnn_in).transpose(1, 2)  # (batch, window_len, cnn_filters)

        # 3. BiLSTM Branch: long-term drift
        bilstm_features, _ = self.bilstm(x_ch_weighted)  # (batch, window_len, bilstm_hidden * 2)

        # 4. Fusion of CNN + BiLSTM
        merged = torch.cat([cnn_features, bilstm_features], dim=-1)  # (batch, window_len, merged_dim)
        fused = self.fusion(merged)  # (batch, window_len, fusion_dim)

        # 5. Temporal Attention
        context, temp_weights = self.temporal_attention(fused)  # context: (batch, fusion_dim)

        # 6. Multi-task output heads
        class_logits = self.cls_head(context)  # (batch, n_classes)
        severity = self.sev_head(context)      # (batch, 1)

        result = {
            "class_logits": class_logits,
            "severity": severity,
        }

        if return_attention:
            result["channel_attention"] = ch_weights
            result["temporal_attention"] = temp_weights

        return result

    @staticmethod
    def derive_alert_level(severity: float) -> str:
        """Derives operational alert level monotonically from continuous severity score.

        Rationale for threshold-derived alert level over an unconstrained trained head:
          1. Monotonic Consistency: Prevents dangerous contradictory outputs (e.g. severity=0.88,
             alert=YELLOW).
          2. Operational Calibrability: Allows mine safety officers to tune DGMS/MSHA action thresholds
             (GREEN <0.2, YELLOW 0.2-0.6, ORANGE 0.6-0.8, RED >=0.8) without requiring neural network
             retraining.
        """
        if severity >= 0.8:
            return "RED"
        elif severity >= 0.6:
            return "ORANGE"
        elif severity >= 0.2:
            return "YELLOW"
        else:
            return "GREEN"


# ─────────────────────────────────────────────────────────────────────────────
# Phase 1 Baseline CNN-LSTM (Preserved for comparison and fallback per §11)
# ─────────────────────────────────────────────────────────────────────────────


class BaselineCNNLSTM(nn.Module):
    """Simple 1D-CNN + LSTM baseline with dual output heads."""

    def __init__(
        self,
        n_channels: int = 9,
        window_len: int = 32,
        n_classes: int = 3,
        cnn_filters: int = 32,
        cnn_kernel: int = 5,
        lstm_hidden: int = 64,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.n_channels = n_channels
        self.window_len = window_len
        self.n_classes = n_classes

        self.cnn = nn.Sequential(
            nn.Conv1d(n_channels, cnn_filters, kernel_size=cnn_kernel, padding=cnn_kernel // 2),
            nn.BatchNorm1d(cnn_filters),
            nn.ReLU(),
            nn.Conv1d(cnn_filters, cnn_filters, kernel_size=cnn_kernel, padding=cnn_kernel // 2),
            nn.BatchNorm1d(cnn_filters),
            nn.ReLU(),
        )

        self.lstm = nn.LSTM(
            input_size=cnn_filters,
            hidden_size=lstm_hidden,
            num_layers=1,
            batch_first=True,
            bidirectional=False,
        )
        self.dropout = nn.Dropout(dropout)

        self.cls_head = nn.Linear(lstm_hidden, n_classes)
        self.sev_head = nn.Sequential(
            nn.Linear(lstm_hidden, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        x_cnn = x.transpose(1, 2)
        x_cnn = self.cnn(x_cnn)
        x_lstm_in = x_cnn.transpose(1, 2)
        lstm_out, (h_n, _) = self.lstm(x_lstm_in)
        features = self.dropout(h_n.squeeze(0))

        class_logits = self.cls_head(features)
        severity = self.sev_head(features)

        return {
            "class_logits": class_logits,
            "severity": severity,
        }


def count_parameters(model: nn.Module) -> int:
    """Count total trainable parameters."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    baseline = BaselineCNNLSTM(n_channels=9, window_len=32, n_classes=3)
    hybrid = HybridCNNBILSTMAttention(n_channels=9, window_len=32, n_classes=3)

    print(f"Baseline CNN-LSTM parameters: {count_parameters(baseline):,}")
    print(f"Hybrid CNN-BiLSTM-Attention parameters: {count_parameters(hybrid):,}")

    dummy = torch.randn(4, 32, 9)
    out_base = baseline(dummy)
    out_hyb = hybrid(dummy, return_attention=True)

    print(f"\nBaseline class_logits shape: {out_base['class_logits'].shape}")
    print(f"Baseline severity shape: {out_base['severity'].shape}")

    print(f"\nHybrid class_logits shape: {out_hyb['class_logits'].shape}")
    print(f"Hybrid severity shape: {out_hyb['severity'].shape}")
    print(f"Hybrid channel_attention shape: {out_hyb['channel_attention'].shape}")
    print(f"Hybrid temporal_attention shape: {out_hyb['temporal_attention'].shape}")
    print("Channel attention gates per sample:", out_hyb['channel_attention'].mean(dim=-1).tolist())
