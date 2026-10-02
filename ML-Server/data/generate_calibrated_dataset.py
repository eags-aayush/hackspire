"""Generate Calibrated Coal Mine Sensor Dataset based on ESP32 Hardware Thresholds.

Features:
- tilt_x_deg, tilt_y_deg: Ground slope displacement
- vibration_amplitude_g: Acceleration magnitude (g)
- vibration_freq_hz: Dominant frequency (Hz)
- crack_displacement_mm: Potentiometer raw ADC / fissure displacement (0-4095)
- water_level_cm: Water sensor raw ADC / pore saturation (0-4095)
- gas_ppm: MQ-6 raw ADC / gas level (0-4095)
- temperature_c: DHT22 Temperature in °C
- humidity_pct: DHT22 Humidity in %

Thresholds directly matching the user's ESP32 code:
- Temperature: Safe < 28, Warning >= 35, Danger >= 45 °C
- Humidity: Safe < 65, Warning >= 70, Danger >= 85 %
- Water (Raw ADC): Safe < 400, Warning >= 900, Danger >= 1500
- Potentiometer (Raw ADC): Safe < 500, Warning >= 1000, Danger >= 1500
- MQ6 Gas: Safe ~600, Warning ~400, Danger ~200 (or gas buildup)
- Accelerometer: Normal ~0.02g, Warning >= 0.2g, Danger >= 0.6g
"""

import os
import csv
import numpy as np

def generate_dataset():
    np.random.seed(42)
    output_path = os.path.join(os.path.dirname(__file__), "minegaurd_sensor_dataset.csv")
    
    nodes = [f"ESP32_{i:03d}" for i in range(1, 16)]
    timesteps_per_node = 960
    
    rows = []
    
    # Equipment noise windows for operational machines (cutting/drilling vibration only)
    noise_windows = {
        "ESP32_001": [(200, 240), (500, 530)],
        "ESP32_002": [(350, 390)],
        "ESP32_003": [(180, 220), (600, 640)],
        "ESP32_004": [(400, 440)],
        "ESP32_010": [(250, 290)],
        "ESP32_012": [(300, 340), (700, 740)],
        "ESP32_015": [(450, 490)],
    }
    
    base_time = np.datetime64("2026-08-01T00:00:00")
    
    for node_idx, node_id in enumerate(nodes):
        zone_id = f"Zone_{node_idx + 1:02d}"
        
        # Per-node steady-state baseline variations (strictly in SAFE range)
        node_tilt_x_bias = np.random.uniform(-0.10, 0.10)
        node_tilt_y_bias = np.random.uniform(-0.10, 0.10)
        node_temp_bias = np.random.uniform(24.0, 26.0)     # SAFE limit 28.0°C
        node_hum_bias = np.random.uniform(55.0, 60.0)      # SAFE limit 65.0%
        node_pot_bias = np.random.uniform(220.0, 320.0)    # SAFE limit 500
        node_water_bias = np.random.uniform(180.0, 280.0)  # SAFE limit 400
        node_gas_bias = np.random.uniform(620.0, 700.0)    # SAFE clean air ~650
        
        for t in range(timesteps_per_node):
            timestamp = str(base_time + np.timedelta64(t * 30, 'm')).replace('T', ' ')
            
            # Default normal baseline
            tilt_x = node_tilt_x_bias + np.random.normal(0, 0.03)
            tilt_y = node_tilt_y_bias + np.random.normal(0, 0.03)
            vib_amp = np.abs(np.random.normal(0.022, 0.005))
            vib_freq = np.random.uniform(4.5, 6.0)
            pot_raw = node_pot_bias + np.random.normal(0, 10.0)
            water_raw = node_water_bias + np.random.normal(0, 10.0)
            gas_raw = node_gas_bias + np.random.normal(0, 10.0)
            temp_c = node_temp_bias + 1.0 * np.sin(2 * np.pi * t / 48) + np.random.normal(0, 0.2)
            hum_pct = node_hum_bias + 2.0 * np.cos(2 * np.pi * t / 48) + np.random.normal(0, 0.3)
            
            label = "normal"
            
            # 1. Operational Equipment Noise injection (heavy cutting/haulage vibration)
            if node_id in noise_windows:
                for start_t, end_t in noise_windows[node_id]:
                    if start_t <= t < end_t:
                        label = "equipment_noise"
                        vib_amp = np.random.uniform(0.35, 0.90)
                        vib_freq = np.random.uniform(25.0, 55.0)
                        break
            
            # 2. Targeted Hazard Events per Training Node:
            
            # ESP32_005: Water inrush / pore-water table surge (t >= 650)
            if node_id == "ESP32_005" and t >= 650:
                label = "subsidence_risk"
                p = (t - 650) / (960 - 650)
                # Water surges from ~250 to 1700 (crosses warning 900, danger 1500)
                water_raw = node_water_bias + p * 1450.0 + np.random.normal(0, 20.0)
                # Minor accompanying moisture & soil shift
                hum_pct = node_hum_bias + p * 18.0 + np.random.normal(0, 0.4)
                pot_raw = node_pot_bias + p * 300.0 + np.random.normal(0, 15.0)
                
            # ESP32_006: Sub-surface thermal heating / coal oxidation (t >= 650)
            elif node_id == "ESP32_006" and t >= 650:
                label = "subsidence_risk"
                p = (t - 650) / (960 - 650)
                # Temp rises from ~25°C to 48°C (crosses warning 35°C, danger 45°C)
                temp_c = node_temp_bias + p * 23.0 + np.random.normal(0, 0.4)
                gas_raw = node_gas_bias - p * 250.0 + np.random.normal(0, 15.0)
                hum_pct = node_hum_bias + p * 15.0 + np.random.normal(0, 0.4)

            # ESP32_007: Strata crack opening / potentiometer fissure (t >= 650)
            elif node_id == "ESP32_007" and t >= 650:
                label = "subsidence_risk"
                p = (t - 650) / (960 - 650)
                # Potentiometer opens from ~280 to 1800 (crosses warning 1000, danger 1500)
                pot_raw = node_pot_bias + p * 1500.0 + np.random.normal(0, 20.0)
                tilt_x = node_tilt_x_bias + p * 1.5 + np.random.normal(0, 0.05)

            # ESP32_008: Hazardous Gas release / MQ-6 event (t >= 650)
            elif node_id == "ESP32_008" and t >= 650:
                label = "subsidence_risk"
                p = (t - 650) / (960 - 650)
                # Gas crosses warning 400 and danger 200
                gas_raw = node_gas_bias - p * 480.0 + np.random.normal(0, 15.0)
                temp_c = node_temp_bias + p * 8.0 + np.random.normal(0, 0.3)

            # ESP32_009: Slope ground tilt displacement (t >= 650)
            elif node_id == "ESP32_009" and t >= 650:
                label = "subsidence_risk"
                p = (t - 650) / (960 - 650)
                # Tilt ramps from ~0 to 4.0° (crosses warning 2.0°, danger 3.5°)
                tilt_x = node_tilt_x_bias + p * 3.8 + np.random.normal(0, 0.08)
                tilt_y = node_tilt_y_bias + p * 2.5 + np.random.normal(0, 0.08)
                pot_raw = node_pot_bias + p * 600.0 + np.random.normal(0, 15.0)

            # ESP32_011: Validation mixed hazard (t >= 700)
            elif node_id == "ESP32_011" and t >= 700:
                label = "subsidence_risk"
                p = (t - 700) / (960 - 700)
                water_raw = node_water_bias + p * 1300.0 + np.random.normal(0, 20.0)
                temp_c = node_temp_bias + p * 18.0 + np.random.normal(0, 0.4)
                pot_raw = node_pot_bias + p * 900.0 + np.random.normal(0, 15.0)

            # ESP32_013: Event 1 (Compound Progressive Subsidence, t >= 720)
            elif node_id == "ESP32_013" and t >= 720:
                label = "subsidence_risk"
                p = (t - 720) / (960 - 720)
                tilt_x = node_tilt_x_bias + p * 3.6 + np.random.normal(0, 0.10)
                tilt_y = node_tilt_y_bias + p * 2.8 + np.random.normal(0, 0.10)
                water_raw = node_water_bias + p * 1400.0 + np.random.normal(0, 25.0)
                pot_raw = node_pot_bias + p * 1450.0 + np.random.normal(0, 20.0)
                temp_c = node_temp_bias + p * 18.0 + np.random.normal(0, 0.4)
                hum_pct = node_hum_bias + p * 28.0 + np.random.normal(0, 0.5)
                gas_raw = node_gas_bias - p * 380.0 + np.random.normal(0, 15.0)
                vib_amp = np.random.uniform(0.06, 0.20) + p * 0.15
                vib_freq = np.random.uniform(6.0, 12.0)

            # ESP32_014: Event 2 (Held-out Test Catastrophic Collapse, t >= 816)
            elif node_id == "ESP32_014" and t >= 816:
                label = "subsidence_risk"
                p = (t - 816) / (960 - 816)
                tilt_x = node_tilt_x_bias + p * 4.2 + np.random.normal(0, 0.12)
                tilt_y = node_tilt_y_bias + p * 3.2 + np.random.normal(0, 0.12)
                water_raw = node_water_bias + p * 1550.0 + np.random.normal(0, 25.0)
                pot_raw = node_pot_bias + p * 1600.0 + np.random.normal(0, 25.0)
                temp_c = node_temp_bias + p * 20.0 + np.random.normal(0, 0.4)
                hum_pct = node_hum_bias + p * 30.0 + np.random.normal(0, 0.5)
                gas_raw = node_gas_bias - p * 450.0 + np.random.normal(0, 20.0)
                vib_amp = np.random.uniform(0.08, 0.28) + p * 0.15
                vib_freq = np.random.uniform(7.0, 14.0)

            # Clamp values to valid physical ranges
            tilt_x = float(np.round(tilt_x, 3))
            tilt_y = float(np.round(tilt_y, 3))
            vib_amp = float(np.round(max(0.001, vib_amp), 4))
            vib_freq = float(np.round(max(0.1, vib_freq), 2))
            pot_raw = float(np.round(np.clip(pot_raw, 0, 4095), 1))
            water_raw = float(np.round(np.clip(water_raw, 0, 4095), 1))
            gas_raw = float(np.round(np.clip(gas_raw, 0, 4095), 1))
            temp_c = float(np.round(np.clip(temp_c, -10.0, 65.0), 2))
            hum_pct = float(np.round(np.clip(hum_pct, 10.0, 100.0), 2))
            
            rows.append({
                "timestamp": timestamp,
                "zone_id": zone_id,
                "node_id": node_id,
                "tilt_x_deg": tilt_x,
                "tilt_y_deg": tilt_y,
                "vibration_amplitude_g": vib_amp,
                "vibration_freq_hz": vib_freq,
                "crack_displacement_mm": pot_raw,
                "water_level_cm": water_raw,
                "gas_ppm": gas_raw,
                "temperature_c": temp_c,
                "humidity_pct": hum_pct,
                "label": label,
            })
            
    fieldnames = [
        "timestamp", "zone_id", "node_id",
        "tilt_x_deg", "tilt_y_deg", "vibration_amplitude_g", "vibration_freq_hz",
        "crack_displacement_mm", "water_level_cm", "gas_ppm",
        "temperature_c", "humidity_pct", "label"
    ]
    
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        
    print(f"Generated {len(rows)} calibrated rows saved to {output_path}")

if __name__ == "__main__":
    generate_dataset()
