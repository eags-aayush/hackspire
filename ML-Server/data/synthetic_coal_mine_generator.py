"""Synthetic Coal Mine Sensor Data Generator.

Generates labeled windows for all 5 classes with physically-correlated
multi-channel anomaly injection per docs/ML_WORKFLOW.md §4B.

Each window is (128, 13) with channels matching §2's sensor inventory:
  humidity, temperature, vertical_tilt, horizontal_tilt, ultrasonic_distance,
  gas_level, water_conductivity, gyro_x, gyro_y, gyro_z, accel_x, accel_y, accel_z

Output: coal_mine_synthetic_dataset.npz containing:
  X            — (n, 128, 13) float32
  y_class      — (n,) int64
  y_severity   — (n,) float32
  channels     — (13,) string array of column names
"""

import numpy as np
import os

# Reproducible generation
RNG_SEED = 42

CHANNELS = [
    "humidity", "temperature", "vertical_tilt", "horizontal_tilt",
    "ultrasonic_distance", "gas_level", "water_conductivity",
    "gyro_x", "gyro_y", "gyro_z",
    "accel_x", "accel_y", "accel_z",
]

LABEL_NAMES = [
    "normal",               # 0
    "abnormal_tilt",        # 1
    "distance_change",      # 2
    "crack_vibration",      # 3
    "subsidence_progression",  # 4
]

WINDOW_LEN = 128
N_CHANNELS = 13
SAMPLES_PER_CLASS = 250


def _generate_baseline_window(rng: np.random.Generator) -> np.ndarray:
    """Generate a single baseline (normal) window with realistic noise.

    Noise/drift parameters are placeholder estimates — TODO: recalibrate
    once real quiet-baseline ESP32 data is available (per §4B note).
    """
    w = np.zeros((WINDOW_LEN, N_CHANNELS), dtype=np.float32)
    t = np.arange(WINDOW_LEN, dtype=np.float32)

    # humidity: ~55% RH with slow diurnal drift + small noise
    w[:, 0] = 55.0 + 2.0 * np.sin(2 * np.pi * t / WINDOW_LEN * 0.3) + rng.normal(0, 0.5, WINDOW_LEN)

    # temperature: ~25°C with slow drift
    w[:, 1] = 25.0 + 1.0 * np.sin(2 * np.pi * t / WINDOW_LEN * 0.2) + rng.normal(0, 0.3, WINDOW_LEN)

    # vertical_tilt: near 0 degrees with small noise
    w[:, 2] = rng.normal(0, 0.05, WINDOW_LEN)

    # horizontal_tilt: near 0 degrees with small noise
    w[:, 3] = rng.normal(0, 0.05, WINDOW_LEN)

    # ultrasonic_distance: ~100cm stable
    w[:, 4] = 100.0 + rng.normal(0, 0.2, WINDOW_LEN)

    # gas_level: low baseline ~50 ppm
    w[:, 5] = 50.0 + rng.normal(0, 5.0, WINDOW_LEN)

    # water_conductivity: stable ~200 µS/cm
    w[:, 6] = 200.0 + rng.normal(0, 5.0, WINDOW_LEN)

    # gyro_x/y/z: near zero
    w[:, 7] = rng.normal(0, 0.02, WINDOW_LEN)
    w[:, 8] = rng.normal(0, 0.02, WINDOW_LEN)
    w[:, 9] = rng.normal(0, 0.02, WINDOW_LEN)

    # accel_x/y: near zero, accel_z: ~1g (gravity)
    w[:, 10] = rng.normal(0, 0.01, WINDOW_LEN)
    w[:, 11] = rng.normal(0, 0.01, WINDOW_LEN)
    w[:, 12] = 1.0 + rng.normal(0, 0.01, WINDOW_LEN)

    return w


def _inject_abnormal_tilt(w: np.ndarray, severity: float, rng: np.random.Generator) -> np.ndarray:
    """Class 1: Abnormal tilt. Primary: vertical_tilt, horizontal_tilt, accel.

    Correlated: a tilt event moves tilt sensors + shifts accel readings.
    """
    w = w.copy()
    onset = rng.integers(10, 60)
    tilt_mag = severity * 5.0  # up to 5 degrees at max severity

    # Ramp up tilt over the window
    ramp = np.clip((np.arange(WINDOW_LEN) - onset) / (WINDOW_LEN - onset), 0, 1)
    w[:, 2] += tilt_mag * ramp + rng.normal(0, 0.1 * severity, WINDOW_LEN)  # vertical_tilt
    w[:, 3] += tilt_mag * 0.6 * ramp + rng.normal(0, 0.08 * severity, WINDOW_LEN)  # horizontal_tilt

    # Correlated accel shift (gravity component redistribution)
    w[:, 10] += severity * 0.05 * ramp  # accel_x
    w[:, 12] -= severity * 0.03 * ramp  # accel_z slight decrease

    return w


def _inject_distance_change(w: np.ndarray, severity: float, rng: np.random.Generator) -> np.ndarray:
    """Class 2: Distance change. Primary: ultrasonic_distance, vertical_tilt.

    Gap opening or closing between nodes.
    """
    w = w.copy()
    onset = rng.integers(20, 70)
    direction = rng.choice([-1, 1])  # gap opening or closing
    dist_shift = direction * severity * 15.0  # up to 15cm shift

    ramp = np.clip((np.arange(WINDOW_LEN) - onset) / (WINDOW_LEN - onset - 10), 0, 1)
    w[:, 4] += dist_shift * ramp + rng.normal(0, 0.5 * severity, WINDOW_LEN)  # ultrasonic_distance

    # Correlated: slight tilt change accompanies distance shift
    w[:, 2] += severity * 0.8 * ramp * direction  # vertical_tilt
    w[:, 3] += severity * 0.3 * ramp * direction  # horizontal_tilt

    return w


def _inject_crack_vibration(w: np.ndarray, severity: float, rng: np.random.Generator) -> np.ndarray:
    """Class 3: Crack/vibration event. Primary: gyro, accel, ultrasonic, gas.

    High-frequency burst + correlated distance/gas shift.
    """
    w = w.copy()
    burst_center = rng.integers(30, 100)
    burst_width = rng.integers(10, 30)
    burst_start = max(0, burst_center - burst_width // 2)
    burst_end = min(WINDOW_LEN, burst_center + burst_width // 2)

    # High-frequency vibration burst in gyro and accel
    burst_len = burst_end - burst_start
    freq = rng.uniform(5, 20)
    t_burst = np.arange(burst_len, dtype=np.float32)
    envelope = np.sin(np.pi * t_burst / burst_len)  # smooth envelope

    for ch in [7, 8, 9]:  # gyro_x/y/z
        w[burst_start:burst_end, ch] += severity * 2.0 * envelope * np.sin(
            2 * np.pi * freq * t_burst / burst_len + rng.uniform(0, 2 * np.pi)
        )
    for ch in [10, 11, 12]:  # accel_x/y/z
        w[burst_start:burst_end, ch] += severity * 0.5 * envelope * np.sin(
            2 * np.pi * freq * 1.3 * t_burst / burst_len + rng.uniform(0, 2 * np.pi)
        )

    # Correlated: small distance jump after burst
    post_burst = np.clip((np.arange(WINDOW_LEN) - burst_end) / 20, 0, 1)
    w[:, 4] += severity * 3.0 * post_burst  # ultrasonic_distance

    # Correlated: gas spike (cracking releases trapped gas)
    w[:, 5] += severity * 200.0 * envelope.max() * np.exp(
        -0.05 * np.abs(np.arange(WINDOW_LEN) - burst_center)
    )

    return w


def _inject_subsidence_progression(w: np.ndarray, severity: float, rng: np.random.Generator) -> np.ndarray:
    """Class 4: Subsidence progression. Primary: vertical_tilt, ultrasonic_distance,
    water_conductivity, humidity, gas_level.

    Slow multi-channel drift over time, increasing severity.
    """
    w = w.copy()
    t = np.arange(WINDOW_LEN, dtype=np.float32) / WINDOW_LEN

    # Slow progressive tilt
    w[:, 2] += severity * 3.0 * t ** 1.5 + rng.normal(0, 0.1 * severity, WINDOW_LEN)  # vertical_tilt

    # Progressive distance change
    w[:, 4] += severity * 8.0 * t ** 1.3  # ultrasonic_distance

    # Rising water conductivity (water infiltration precursor)
    w[:, 6] += severity * 150.0 * t ** 1.2  # water_conductivity

    # Rising humidity
    w[:, 0] += severity * 10.0 * t  # humidity

    # Rising gas level (slow seepage)
    w[:, 5] += severity * 100.0 * t ** 1.1  # gas_level

    # Slight horizontal tilt correlation
    w[:, 3] += severity * 1.0 * t ** 1.5

    return w


INJECTORS = {
    1: _inject_abnormal_tilt,
    2: _inject_distance_change,
    3: _inject_crack_vibration,
    4: _inject_subsidence_progression,
}


def generate_dataset(
    samples_per_class: int = SAMPLES_PER_CLASS,
    seed: int = RNG_SEED,
) -> dict:
    """Generate the full synthetic dataset.

    Returns dict with keys: X, y_class, y_severity, channels.
    """
    rng = np.random.default_rng(seed)

    all_X = []
    all_y_class = []
    all_y_severity = []

    for class_id in range(5):
        for _ in range(samples_per_class):
            w = _generate_baseline_window(rng)

            if class_id == 0:
                severity = 0.0
            else:
                # Severity spread: ensure variety within each class
                severity = rng.uniform(0.2, 1.0)
                w = INJECTORS[class_id](w, severity, rng)

            all_X.append(w)
            all_y_class.append(class_id)
            all_y_severity.append(severity)

    X = np.array(all_X, dtype=np.float32)
    y_class = np.array(all_y_class, dtype=np.int64)
    y_severity = np.array(all_y_severity, dtype=np.float32)

    # Shuffle
    perm = rng.permutation(len(X))
    X = X[perm]
    y_class = y_class[perm]
    y_severity = y_severity[perm]

    return {
        "X": X,
        "y_class": y_class,
        "y_severity": y_severity,
        "channels": np.array(CHANNELS),
    }


def save_dataset(output_dir: str = None, **kwargs):
    """Generate and save dataset to .npz file."""
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))

    data = generate_dataset(**kwargs)

    npz_path = os.path.join(output_dir, "coal_mine_synthetic_dataset.npz")
    np.savez(npz_path, **data)
    print(f"Saved dataset to {npz_path}")
    print(f"  X: {data['X'].shape}, y_class: {data['y_class'].shape}, "
          f"y_severity: {data['y_severity'].shape}")
    print(f"  Class distribution: {dict(zip(*np.unique(data['y_class'], return_counts=True)))}")

    # Also save metadata CSV
    import csv
    csv_path = os.path.join(output_dir, "coal_mine_synthetic_dataset_metadata.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["window_id", "label", "label_name", "severity"])
        for i in range(len(data["y_class"])):
            writer.writerow([
                i,
                data["y_class"][i],
                LABEL_NAMES[data["y_class"][i]],
                f"{data['y_severity'][i]:.4f}",
            ])
    print(f"Saved metadata to {csv_path}")

    return npz_path


if __name__ == "__main__":
    save_dataset()
