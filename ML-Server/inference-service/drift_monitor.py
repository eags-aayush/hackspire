"""Lightweight Prediction Class Drift Monitor — Phase 6 (§10.7).

Monitors live prediction class distributions over a rolling window (e.g. last 500 samples)
against baseline reference distribution derived from the training set.
Detects early signs of domain shift or sensor degradation on real hardware.
"""

import time
import logging
from collections import deque, Counter
from typing import Dict, Any, Optional

logger = logging.getLogger("drift_monitor")

# Reference training set class distribution (clean training partition)
# normal: ~40.5%, equipment_noise: ~49.2%, subsidence_risk: ~10.3%
DEFAULT_BASELINE_DIST = {
    "normal": 0.405,
    "equipment_noise": 0.492,
    "subsidence_risk": 0.103,
}

DRIFT_WARNING_TVD_THRESHOLD = 0.20  # Total Variation Distance > 0.20 triggers warning


class RollingDriftMonitor:
    """Rolling window prediction distribution and drift monitor."""

    def __init__(
        self,
        window_size: int = 500,
        baseline_distribution: Optional[Dict[str, float]] = None,
        log_interval: int = 100,
    ):
        self.window_size = window_size
        self.baseline_dist = baseline_distribution or DEFAULT_BASELINE_DIST.copy()
        self.log_interval = log_interval
        self.history = deque(maxlen=window_size)
        self.prediction_count = 0
        self.last_logged_count = 0
        self.last_drift_status = {
            "drift_detected": False,
            "total_variation_distance": 0.0,
            "current_distribution": {},
            "baseline_distribution": self.baseline_dist,
            "samples_in_window": 0,
            "total_predictions": 0,
            "message": "Initializing rolling window",
        }

    def record_prediction(self, predicted_class: str) -> Dict[str, Any]:
        """Record a live prediction and periodically check for distribution drift."""
        self.history.append(predicted_class)
        self.prediction_count += 1

        # Check drift periodically or once the window is primed
        if (
            self.prediction_count - self.last_logged_count >= self.log_interval
            or (self.prediction_count == self.window_size)
        ):
            self._evaluate_drift()
            self.last_logged_count = self.prediction_count

        return self.last_drift_status

    def _evaluate_drift(self):
        """Computes current rolling class distribution and Total Variation Distance (TVD)."""
        if not self.history:
            return

        counts = Counter(self.history)
        n = len(self.history)
        current_dist = {cls: counts.get(cls, 0) / n for cls in ["normal", "equipment_noise", "subsidence_risk"]}

        # Total Variation Distance: TVD = 0.5 * sum(|P(x) - Q(x)|)
        tvd = 0.5 * sum(
            abs(current_dist[cls] - self.baseline_dist.get(cls, 0.0))
            for cls in ["normal", "equipment_noise", "subsidence_risk"]
        )

        drift_detected = (n >= min(50, self.window_size)) and (tvd >= DRIFT_WARNING_TVD_THRESHOLD)

        msg = (
            f"[DRIFT WARNING] Prediction distribution shifted! TVD={tvd:.3f} "
            f"(Current: {current_dist}, Baseline: {self.baseline_dist})"
            if drift_detected
            else f"[OK] Drift check pass. TVD={tvd:.3f} across {n} rolling predictions."
        )

        if drift_detected:
            logger.warning(msg)
            print(msg)
        else:
            logger.info(msg)

        self.last_drift_status = {
            "drift_detected": drift_detected,
            "total_variation_distance": round(tvd, 4),
            "current_distribution": {k: round(v, 4) for k, v in current_dist.items()},
            "baseline_distribution": self.baseline_dist,
            "samples_in_window": n,
            "total_predictions": self.prediction_count,
            "message": msg,
            "evaluated_at": time.time(),
        }

    def get_status(self) -> Dict[str, Any]:
        """Returns the current drift monitoring metrics."""
        self._evaluate_drift()
        return self.last_drift_status
