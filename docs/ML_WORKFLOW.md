# Coal Mine Ground & Structural Monitoring — ML Workflow Spec

**Purpose of this document:** context for an AI coding agent (Antigravity) continuing
this project. It describes the sensing hardware, data strategy, model architecture,
file layout, and outstanding implementation tasks. Treat this as the source of
truth for design decisions already made; anything marked `TODO` is unbuilt.

---

## 1. Project Goal

An ESP32-based sensor network deployed in/around a coal mine, feeding a hybrid
deep learning model that performs real-time structural and ground-stability
early warning.

**System must detect:**
1. Abnormal ground tilt
2. Change in relative distance between nodes
3. Early crack initiation
4. Unusual vibration signatures

**AI/ML must additionally:**
5. Identify abnormal deformation patterns
6. Predict possible subsidence zones
7. Generate automated early warning alerts
8. Estimate severity and progression

---

## 2. Sensor Inventory & Data Schema

9 channels, sampled continuously from ESP32 telemetry nodes.

| Channel | Unit | Sensor / Source | Description |
|---|---|---|---|
| `tilt_x_deg` | ° (degrees) | Biaxial inclinometer / IMU | Primary X-axis ground tilt angle |
| `tilt_y_deg` | ° (degrees) | Biaxial inclinometer / IMU | Secondary Y-axis ground tilt angle |
| `vibration_amplitude_g` | g | Accelerometer / vibration probe | Peak acceleration / dynamic ground excitation |
| `vibration_freq_hz` | Hz | Accelerometer FFT / frequency detector | Dominant vibration frequency |
| `crack_displacement_mm` | mm | LVDT / crackmeter / rangefinder | Crack opening & structural displacement |
| `water_level_cm` | cm | Hydrostatic / piezometric sensor | Groundwater inflow / sump level precursor |
| `gas_ppm` | ppm | Electrochemical gas sensor | Methane & toxic gas accumulation proxy |
| `temperature_c` | °C | Thermal sensor | Ambient mine temperature baseline |
| `humidity_pct` | % RH | Relative humidity sensor | Ambient humidity / diurnal environmental baseline |

**Model input unit:** a sliding window of shape `(32, 9)` (`window_len = 32`, `n_channels = 9`, `dtype = float32`).
Input features are normalized using training set statistics (mean & standard deviation per channel).

---

## 3. Label Taxonomy

| ID | Label | Dominant Channels | Operational Description |
|---|---|---|---|
| 0 | `normal` | all | Baseline quiet operating conditions within safety thresholds |
| 1 | `equipment_noise` | vibration_amplitude_g, vibration_freq_hz | High-frequency mechanical machinery & drill vibrations without ground tilt or crack progression |
| 2 | `subsidence_risk` | tilt_x_deg, tilt_y_deg, crack_displacement_mm, water_level_cm, gas_ppm | Coordinated geotechnical deformation, expanding crack aperture, water shift, and ground instability |

Each labeled window also carries a continuous `severity` score in `[0, 1]`
(0 = no anomaly, 1 = critical structural failure), used by the multi-task regression head.
Provisional shadow alert levels are derived from severity:
- `severity < 0.2` → `GREEN`
- `0.2 <= severity < 0.6` → `YELLOW`
- `0.6 <= severity < 0.8` → `ORANGE`
- `severity >= 0.8` → `RED`

---

## 4. Data Strategy

No public dataset matches this exact multi-sensor combination. Strategy is a
three-source blend:

**A. Reference/transfer-learning sources (real data, different domain):**
- Z24 Bridge benchmark (KU Leuven) — real accelerometer + temperature vibration
  data with progressive damage; use to pretrain vibration-anomaly feature
  extractors before fine-tuning on mine accel/gyro data.
- LANL 3-story building benchmark — open vibration-based damage detection
  benchmark, same purpose as above.
- Coal mine subsidence dataset (11 geotechnical parameters, 14 mines) — tabular
  data (seam thickness, mining depth, rock strength, etc.) for a geology-aware
  static risk feature vector, not a sensor time series.
- MSHA (Mine Safety and Health Administration) open data — gas sampling
  records, accident/incident severity taxonomy, and regulatory action
  thresholds (e.g. required action at 1.0% methane, evacuation at 2.0% under
  30 CFR Part 75). Used to calibrate `gas_level` alert thresholds and to map
  the model's severity score onto a real-world severity taxonomy
  (non-reportable → reportable → S&S → fatality-risk), **not** as raw sensor
  training data.

**B. Synthetic dataset (already generated, see §7 for files):**
- `synthetic_coal_mine_generator.py` produces labeled windows for all 5
  classes with **physically-correlated** multi-channel anomaly injection
  (e.g. a crack event moves gyro/accel + ultrasonic_distance + gas_level
  together, not independently) so the model learns real sensor fusion
  instead of single-channel shortcuts.
- Current sample: 1,250 windows, 250 per class, shape `(1250, 128, 13)`.
- Baseline noise levels in the generator are **placeholder estimates** —
  `TODO`: recalibrate `_generate_baseline_window()` noise/drift parameters
  once real quiet-baseline ESP32 data is available.

**C. Real field data (not yet collected):**
- `TODO`: build an ESP32 → storage logging pipeline to capture continuous
  baseline data, plus any staged/controlled abnormal events, for final
  fine-tuning and validation. This is the highest-priority gap — synthetic
  and transfer-learned data can bootstrap the pipeline but should not be the
  sole basis for deployment decisions.

---

## 5. Model Architecture — Hybrid CNN-BiLSTM + Attention

```
Multi-sensor window (9 channels, 32 timesteps: window_len=32, n_channels=9)
          │
   ┌──────┴──────┐
   │             │
1D-CNN branch   BiLSTM branch
(local spikes:  (slow continuous drift:
 vibration,     tilt accumulation,
 crack jumps)   water level creep)
   │             │
   └──────┬──────┘
          │
   Dual Attention Layer (Interpretability Layer)
   ├── CBAM Channel Attention: activation gates in [0, 1] across the 9 sensors
   └── Temporal Attention: softmax weights across the 32 historical timesteps
          │
   (MSHA/DGMS static context fusion hook — documented gap, out of scope for Phase 5)
          │
   Multi-task output heads
   ├── Classification head (3-way: normal, equipment_noise, subsidence_risk)
   └── Severity regression (continuous in [0, 1], Sigmoid)
          │
   Derived Operational Alert (GREEN < 0.2, YELLOW 0.2–0.6, ORANGE 0.6–0.8, RED >= 0.8)
```

**Component detail:**
- **CNN branch:** 1D convolutions (kernel sizes 3 and 5, BatchNorm1d, GELU) over the time axis, tuned for short local
  events — vibration bursts, sudden crack displacement jumps, gas spikes. Operates strictly on the real 9-channel schema.
- **BiLSTM branch:** captures slow multi-hour/day drift — gradual tilt increase, rising water level, subsidence creep.
  Bidirectional processing is confirmed: across a fixed 32-step sliding window, BiLSTM captures both pre-event baseline
  stability (backward context) and progressive accumulation towards the anomaly (forward context).
- **Attention layer (Interpretability):**
  - *Channel Attention:* CBAM-style pooling (Global Average Pooling for drift + Global Max Pooling for transient peaks)
    feeding an MLP to produce per-channel activation gates in `[0, 1]`. Directly surfaces which physical sensors drove
    the prediction for mine safety officers.
  - *Temporal Attention:* Additive Bahdanau-style attention over merged sequence features, outputting a softmax distribution
    over the 32 timesteps to identify critical inflection points.
- **MSHA / DGMS static context fusion:** Documented gap. Step 0 explicitly determined this is out of scope for Phase 5
  since no confirmed DGMS (Directorate General of Mines Safety, India) or coal mine geology tabular dataset (depth, seam thickness,
  rock rating) currently exists. Code maintains a clean extension hook rather than fabricating placeholder features.
- **Output heads (multi-task, joint training):**
  - Classification head: Linear layers + GELU + Dropout + Linear over 3 classes, weighted cross-entropy loss.
  - Severity head: Linear layers + GELU + Sigmoid in `[0, 1]`, masked MSE loss (normal weighted at 0.01, equipment noise at 1.0, subsidence at 2.0).
  - Alert head: Derived monotonically from continuous severity (`<0.2` GREEN, `0.2–0.6` YELLOW, `0.6–0.8` ORANGE, `>=0.8` RED).
    *Rationale:* Guarantees monotonic consistency (prevents contradictory outputs like severity=0.88 with alert=YELLOW) and allows
    safety engineers to adjust DGMS regulatory thresholds without retraining model weights.
  - Combined loss: `L = L_class + λ1 * L_severity`.

**Framework decision: PyTorch.** Chosen over TensorFlow because the model is a
custom multi-branch, multi-task architecture (easier to build/debug with
PyTorch's dynamic graphs and custom training loop) and there is no on-device
microcontroller inference requirement — the model runs in the cloud (see §10),
so TensorFlow Lite Micro's MCU advantage doesn't apply here. Scikit-learn was
ruled out for the deep model (no autograd/custom architectures) but remains a
good fit for a small side-model on the MSHA-derived static risk features
(mine depth, seam thickness, incident history) if a tabular baseline is
useful for comparison.

---

## 6. Alerting Logic

- Alert thresholds must be grounded in MSHA's real regulatory action levels
  wherever a direct analog exists (gas level is the clearest case).
- For channels without a direct MSHA analog (tilt, distance, vibration),
  derive thresholds from the severity regression output plus domain review —
  `TODO`: get threshold sign-off from a mining safety engineer before this
  goes anywhere near production alerting.
- Design for **low false-negative tolerance**: in a safety-critical alerting
  system, missed detections are far costlier than false alarms. Evaluation
  (§9) should weight recall on anomalous classes accordingly.

---

## 7. Repository / File Layout

```
ML-Server/
  data/
    minegaurd_sensor_dataset.csv          # Ground-truth multi-sensor dataset (9 channels, 3 classes)
    minegaurd_demo_sample.csv             # Compact calibration and demo sample
    synthetic_coal_mine_generator.py      # Correlated physics-based window generator
    export_predictions.py                 # Prediction log store exporter for retraining
  models/
    cnn_lstm_attention.py                 # BaselineCNNLSTM PyTorch implementation (CNN + LSTM + Attention)
    train.py                              # Supervised training loop & evaluation checkpointing
    evaluate.py                           # Per-class metrics, confusion matrix, and latency benchmarks
  inference-service/
    app.py                                # FastAPI microservice (:8000/predict, :8000/health)
    model_registry/
      baseline_latest.pt                  # Active PyTorch model weights checkpoint
      normalization_stats.json            # Mean and std statistics for the 9 channels
    prediction_log.jsonl                  # Legacy throwaway logging (superseded by Prediction Log Store)
    requirements.txt          # Microservice deps

backend/
  src/ml/
    ml.interface.ts                       # 9-channel definitions, window (32, 9), ShadowMlPrediction types
    ml-window-buffer.service.ts           # Rolling 32-sample sliding window buffer per sensor node
    ml-inference.service.ts               # HTTP client to FastAPI /predict, emits ml.prediction.generated
    ml-prediction-store.service.ts        # Persistent SQLite store (node:sqlite, WAL mode) per §10.4
    ml-prediction.controller.ts           # REST query, export (CSV/JSON), and ground-truth confirmation API
  data/
    predictions.db                        # SQLite database holding durable inference windows & metadata
```

---

## 8. Training Pipeline (planned steps)

1. Per-channel normalization (z-score using training-set statistics only).
2. Train/val/test split — stratify by class; if mixing synthetic + real data,
   keep real data concentrated in val/test to catch synthetic-to-real gaps.
3. Handle class imbalance (real deployment will be normal-heavy) — class
   weights or focal loss on the classification head.
4. Train CNN-LSTM-Attention-fusion model with multi-task loss (§5).
5. Log per-class precision/recall/F1, confusion matrix, severity MAE, and
   alert-head recall specifically on anomalous classes.

## 9. Evaluation Priorities

- **Recall on classes 1–2 (equipment_noise, subsidence_risk) is the top metric** — this is a safety system;
  missed anomalies matter far more than false alarms.
- Track severity MAE separately per class (a `subsidence_risk` severity error
  has different real-world cost than a `normal` one).
- Before any real deployment claim, validate against real field data, not
  just synthetic/transfer-learned benchmarks.

---

## 10. Deployment Architecture

Decided: **model deployed in the cloud/edge**, integrated as a microservice
into the existing pipeline. Gateway Node, Backend Server, Sensor Data
Pipeline, and Real-time Dashboard run continuously; the ML
inference service and Prediction Log Store handle intelligence.

**Data flow:**

```
ESP32 sensors ──> Gateway Node ──> Backend Server ──> ML Inference Service
  (existing)        (existing)       (existing)         (FastAPI :8000)
                                          │                  │
                                          ▼                  │
                                     Dashboard               ▼
                                 (Realtime WebSockets)  ml.prediction.generated
                                                             │
                                                             ▼
                                                    Prediction Log Store
                                                  (SQLite WAL backend/data)
                                                             │
                                                             ▼
                                                    periodic offline retraining
                                                    (export_predictions.py)
```

**Key decisions:**

1. **ML inference is a separate microservice, not code embedded in the
   backend.** Package the trained PyTorch model behind a small API (FastAPI).
   The backend calls `POST /predict` with a sensor window and receives back
   `{anomaly_class, class_probs, severity, alert_level, model_version}`.
   This lets the model be redeployed independently of backend/frontend releases.
2. **Windowing lives in the Backend Server, not the inference service.** The
   backend maintains a rolling buffer (`MlWindowBufferService`) of shape `(32, 9)`
   per sensor node and feeds windows to the inference service.
3. **Training is fully offline**, run separately from the live pipeline.
   Output is a versioned model artifact (`baseline_latest.pt`) loaded into the
   inference service — training never touches the live path directly.
4. **Log every prediction, not just alerts, to the Prediction Log Store.**
   `MlPredictionStoreService` listens to `ml.prediction.generated` asynchronously
   and writes to `predictions.db`. Every row stores `prediction_id`, `node_id`, `zone_id`,
   `timestamp`, `input_window` (raw 32x9 array), `class_probs`, `predicted_class`,
   `severity`, `alert_level`, `model_version`, `inference_latency_ms`, and `confirmed_label`.
   - **Production Volume Estimation:**
     - At intra-packet sub-reading cadence (11 evaluations per packet):
       - At 1 Hz: 11 rows/sec/node = ~950,400 rows/day/node (~14.2 GB/day for 10 nodes at ~1.5 KB/row).
     - At packet-level cadence (1 evaluation per sequence packet):
       - At 1 Hz: 1 row/sec/node = ~86,400 rows/day/node (~1.3 GB/day for 10 nodes).
   - **Retention / Rotation Strategy (`TODO`):**
     Prune unflagged `normal` windows (severity < 0.1) older than 14 days, while permanently
     retaining all anomalous, warning, and operator-confirmed records for future retraining.
5. **Retraining is periodic and offline, not live.** Pull logged
   predictions via `export_predictions.py` or `GET /ml/predictions/export`,
   filter by confirmed ground truth / high confidence, retrain, validate against
   held-out test sets, and redeploy model checkpoints deliberately.
6. **Shadow mode before automated alerting.** Predictions flow over dedicated
   `ml:prediction` channels to the dashboard for operator visibility. Real mine
   sirens and hard safety alarms remain isolated until real-world validation
   reaches high recall confidence.
7. **Monitor latency and drift once live.** Track inference latency (ms) and
   prediction class distributions to detect sensor drift, seasonal baseline
   shifts, or degraded network conditions.

8. **Packet-Level Ingestion Debouncing (Phase 5 Resolution):** Intra-packet sub-reading
   cadence (11 channel events emitted per sequence packet) was coalesced via a 25ms sliding
   debounce in `MlInferenceService`, ensuring inference evaluates strictly once per completed
   packet sequence rather than 11 times, slashing background inference load by 11x.

9. **Evaluation Integrity Audit & Drift Monitoring (Phase 6 Resolution):**
   - **Audit Findings:** The Phase 1 post-windowing random split caused severe temporal window leakage (100% of test subsidence windows had $\ge 90\%$ overlap with training neighbors).
   - **Clean Source-Event Re-evaluation:** Re-splitting by Source-Event (holding out Zone 14 / Node ESP32_014 completely with 0% overlap) revealed that the Phase 5 Hybrid model suffered from overparameterized oversensitivity, collapsing precision to 71.07% (with 46 false subsidence alarms on normal data), whereas Baseline CNN-LSTM maintained 95.76% precision, 97.84% F1, 100% recall, and 2.7x faster inference.
   - **Conditional Live Swap:** Explicitly not swapped. `baseline_latest.pt` remains active. Checkpoint loading is configurable via `ML_MODEL_CHECKPOINT`.
   - **Rolling Drift Monitoring (§10.7):** Built `RollingDriftMonitor` tracking Total Variation Distance (TVD) across a rolling 500-sample window against training distribution with `/drift` monitoring.

**Status:**
- Phase 0: System Scaffold & Ingestion Pipeline (Complete)
- Phase 1: Baseline CNN-LSTM Model & Safety Metrics (Complete)
- Phase 2: Inference Microservice & Model Registry (Complete)
- Phase 3: Backend Ingestion Integration & Real-time Shadow Mode (Complete)
- Phase 4: Prediction Log Store & Retraining Exporter (Complete)
- Phase 5: Full Hybrid Model (CNN + BiLSTM + CBAM Channel Attention + Temporal Attention) & Operator-Confirmed Training Bridge (Complete)
- Phase 6: Evaluation Integrity Audit, Clean Split Re-evaluation, Conditional Live Model Swap & Rolling Drift Monitor (Complete)

---

## 11. Known Limitations / Assumptions to Revisit

- Synthetic data noise/drift parameters are placeholder guesses, not
  measured from real hardware.
- Window length (128) and implicit sampling rate are unconfirmed against
  actual ESP32 firmware sampling interval.
- MSHA thresholds are U.S. regulatory values — if the mine is outside the
  U.S. (e.g. India), swap in the appropriate local regulator's thresholds
  (e.g. DGMS) before using them for real alerting.
- No real labeled failure events exist yet; treat current models as
  anomaly-detection-oriented (autoencoder/one-class alternatives should be
  kept as a fallback) until real event data accumulates.
