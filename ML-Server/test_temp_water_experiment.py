import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "inference-service"))
from app import load_model, predict, PredictRequest

load_model()

print("\n--- EXPERIMENT: WHAT HAPPENS WHEN TEMPERATURE & WATER LEVEL INCREASE? ---")

# Normal quiet baseline (All 12 metrics in SAFE limit)
# [tilt_x, tilt_y, vib_amp, vib_freq, pot_raw, water_raw, gas_raw, temp_c, hum_pct]
baseline_w = [[0.01, 0.01, 0.022, 5.2, 280.0, 230.0, 650.0, 25.0, 58.0]] * 32
res_base = predict(PredictRequest(window=baseline_w, reference_id="baseline"))
print(f"1. Baseline Normal:        Class={res_base.anomaly_class:15} Probs={res_base.class_probs} Severity={res_base.severity:.3f} Alert={res_base.alert_level}")

# Experiment A: Water level surges (from 230 to 1400 - crossing WATER_WARNING_LIMIT 900 towards DANGER 1500)
water_rise_w = [[0.01, 0.01, 0.022, 5.2, 280.0, 1400.0, 650.0, 25.0, 58.0]] * 32
res_water = predict(PredictRequest(window=water_rise_w, reference_id="water_rise"))
print(f"2. High Water Level:       Class={res_water.anomaly_class:15} Probs={res_water.class_probs} Severity={res_water.severity:.3f} Alert={res_water.alert_level}")

# Experiment B: Temperature increases (from 25°C to 46°C - crossing TEMP_WARNING_LIMIT 35°C & TEMP_DANGER_LIMIT 45°C)
temp_rise_w = [[0.01, 0.01, 0.022, 5.2, 280.0, 230.0, 650.0, 46.0, 68.0]] * 32
res_temp = predict(PredictRequest(window=temp_rise_w, reference_id="temp_rise"))
print(f"3. High Temperature:       Class={res_temp.anomaly_class:15} Probs={res_temp.class_probs} Severity={res_temp.severity:.3f} Alert={res_temp.alert_level}")

# Experiment C: Both Temperature (42°C) AND Water Level (1500) increase
both_rise_w = [[0.01, 0.01, 0.022, 5.2, 280.0, 1500.0, 650.0, 42.0, 75.0]] * 32
res_both = predict(PredictRequest(window=both_rise_w, reference_id="both_rise"))
print(f"4. High Temp + High Water: Class={res_both.anomaly_class:15} Probs={res_both.class_probs} Severity={res_both.severity:.3f} Alert={res_both.alert_level}")

# Experiment D: Progressive water inrush, fissure crack opening and strata tilt (geotechnical subsidence precursor)
progressive_w = []
for i in range(32):
    t_val = 25.0 + (i / 31.0) * 16.0       # Temp rising 25 -> 41°C
    w_val = 230.0 + (i / 31.0) * 1300.0   # Water rising 230 -> 1530
    p_val = 280.0 + (i / 31.0) * 1100.0   # Potentiometer crack rising 280 -> 1380
    tilt_val = 0.02 + (i / 31.0) * 2.5    # Tilt rising 0.02 -> 2.52°
    progressive_w.append([tilt_val, tilt_val * 0.8, 0.08, 6.0, p_val, w_val, 500.0, t_val, 74.0])
res_prog = predict(PredictRequest(window=progressive_w, reference_id="progressive"))
print(f"5. Progressive Inrush+Tilt: Class={res_prog.anomaly_class:15} Probs={res_prog.class_probs} Severity={res_prog.severity:.3f} Alert={res_prog.alert_level}")
