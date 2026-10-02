"""Standalone Browser Demo Web Page for Mine Subsidence ML Inference Microservice.

Provides an interactive test console with:
- 9-channel geotechnical sensor sliders
- One-click mining incident presets (Normal, Drilling Noise, Early Subsidence, Critical Collapse)
- Live inference execution against /predict
- Real-time probability distributions, continuous severity meter, provisional alert badge
- Model checkpoint switcher (baseline_latest.pt vs hybrid_attention_latest.pt)
- Real-time rolling drift monitor visualizer (§10.7)
- Continuous live simulation streaming mode
"""

DEMO_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mine Subsidence ML Model Testing Lab | SIH-2026</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-dark: #070a12;
      --panel-bg: rgba(16, 24, 40, 0.75);
      --panel-border: rgba(255, 255, 255, 0.08);
      --accent-amber: #fca311;
      --accent-blue: #3b82f6;
      --hazard-red: #ef4444;
      --safety-green: #10b981;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --card-bg: #0f172a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 10% 20%, #0d1527 0%, #060911 90%);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      min-height: 100vh;
      padding: 24px;
      line-height: 1.5;
    }
    .container {
      max-width: 1380px;
      margin: 0 auto;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--panel-border);
      margin-bottom: 24px;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, #fca311, #d97706);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 0 20px rgba(252, 163, 17, 0.35);
    }
    .brand-title h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand-title p {
      font-size: 13px;
      color: var(--text-muted);
    }
    .header-badges {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .badge {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 9999px;
      font-family: 'JetBrains Mono', monospace;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--panel-border);
    }
    .badge.active {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: #34d399;
    }
    .badge.shadow {
      background: rgba(252, 163, 17, 0.15);
      border-color: rgba(252, 163, 17, 0.4);
      color: #fbbf24;
    }

    /* Grid Layout */
    .grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 24px;
    }
    @media (max-width: 1080px) {
      .grid { grid-template-columns: 1fr; }
    }

    /* Glass Cards */
    .card {
      background: var(--panel-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      margin-bottom: 24px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      letter-spacing: -0.01em;
    }
    .card-title span.sub {
      font-size: 12px;
      font-weight: 400;
      color: var(--text-muted);
    }

    /* Presets bar */
    .presets {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .preset-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 10px 8px;
      color: var(--text-main);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .preset-btn:hover {
      background: rgba(252, 163, 17, 0.15);
      border-color: rgba(252, 163, 17, 0.5);
      transform: translateY(-2px);
    }
    .preset-btn.active {
      background: rgba(252, 163, 17, 0.25);
      border-color: #fca311;
      color: #fca311;
    }
    .preset-btn span.tag {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 400;
    }

    /* Controls */
    .sliders-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 20px;
    }
    @media (max-width: 640px) {
      .sliders-grid { grid-template-columns: 1fr; }
    }
    .slider-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--text-muted);
    }
    .slider-val {
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-main);
      font-weight: 600;
    }
    input[type=range] {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      outline: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fca311;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(252, 163, 17, 0.6);
      transition: transform 0.1s;
    }
    input[type=range]::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    /* Actions */
    .action-row {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }
    .btn {
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #fca311, #e8590c);
      color: #000;
      flex: 1;
      box-shadow: 0 4px 15px rgba(252, 163, 17, 0.3);
    }
    .btn-primary:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      border: 1px solid var(--panel-border);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    .btn-secondary.streaming {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.6);
      color: #fca5a5;
    }

    /* Prediction Result Panel */
    .pred-hero {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      padding: 20px;
      text-align: center;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }
    .pred-class {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }
    .pred-class.normal { color: #34d399; text-shadow: 0 0 20px rgba(52, 211, 153, 0.4); }
    .pred-class.equipment_noise { color: #60a5fa; text-shadow: 0 0 20px rgba(96, 165, 250, 0.4); }
    .pred-class.subsidence_risk { color: #f87171; text-shadow: 0 0 25px rgba(248, 113, 113, 0.6); animation: pulseGlow 2s infinite; }
    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }
    .pred-meta {
      display: flex;
      justify-content: center;
      gap: 16px;
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 8px;
    }

    /* Alert Badges */
    .alert-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.05em;
    }
    .alert-badge.GREEN { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .alert-badge.YELLOW { background: rgba(234, 179, 8, 0.2); color: #fde047; border: 1px solid rgba(234, 179, 8, 0.4); }
    .alert-badge.ORANGE { background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.4); }
    .alert-badge.RED { background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); animation: blink 1.2s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    /* Severity Meter */
    .meter-container {
      margin: 18px 0;
    }
    .meter-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .meter-track {
      height: 12px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    .meter-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #10b981 0%, #eab308 50%, #f97316 75%, #ef4444 100%);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 8px;
    }

    /* Probabilities Bars */
    .prob-bars {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }
    .prob-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .prob-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .prob-track {
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      overflow: hidden;
    }
    .prob-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .prob-fill.normal { background: #10b981; }
    .prob-fill.equipment_noise { background: #3b82f6; }
    .prob-fill.subsidence_risk { background: #ef4444; }

    /* Drift Monitor Widget */
    .drift-box {
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.25);
    }
    .drift-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .drift-pill {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .drift-pill.pass { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .drift-pill.warn { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); animation: blink 1s infinite; }

    /* Checkpoint selector */
    .select-model {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      border: 1px solid var(--panel-border);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
    }

    .latency-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--accent-amber);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">⚠️</div>
        <div class="brand-title">
          <h1>Mine Subsidence ML Testing Lab</h1>
          <p>Phase 6 Browser View Verification & Multi-Sensor Sandbox</p>
        </div>
      </div>
      <div class="header-badges">
        <div class="badge active" id="server-status">● ML Service Online</div>
        <div class="badge shadow">🛡️ Shadow Mode (§10.6)</div>
        <select class="select-model" id="model-select" onchange="switchModel(this.value)">
          <option value="baseline_latest.pt" selected>Checkpoint: baseline_latest.pt (Production Active)</option>
          <option value="hybrid_attention_latest.pt">Checkpoint: hybrid_attention_latest.pt (Audited Fallback)</option>
        </select>
      </div>
    </header>

    <div class="grid">
      <!-- LEFT COLUMN: SENSOR CONTROLS & PRESETS -->
      <div>
        <div class="card">
          <div class="card-title">
            <span>Geotechnical Event Presets</span>
            <span class="sub">Click to load realistic physical conditions</span>
          </div>
          <div class="presets">
            <button class="preset-btn active" onclick="loadPreset('normal')">
              <span>🌿 Normal Stable</span>
              <span class="tag">Quiet Baseline</span>
            </button>
            <button class="preset-btn" onclick="loadPreset('drilling')">
              <span>⛏️ Machine Vibration</span>
              <span class="tag">Equipment Noise</span>
            </button>
            <button class="preset-btn" onclick="loadPreset('early_sub')">
              <span>⚠️ Early Subsidence</span>
              <span class="tag">Tilt & Creep Precursor</span>
            </button>
            <button class="preset-btn" onclick="loadPreset('critical_sub')">
              <span>🚨 Critical Collapse</span>
              <span class="tag">Severe Subsidence Risk</span>
            </button>
            <button class="preset-btn" onclick="loadPreset('gas_inflow')">
              <span>💨 Water / Gas Inflow</span>
              <span class="tag">Hydro-Gas Shift</span>
            </button>
          </div>

          <div class="card-title" style="margin-top: 24px;">
            <span>9-Channel Sensor Sandbox (32-Timestep Rolling Window)</span>
            <span class="sub">Tweak continuous parameters</span>
          </div>

          <div class="sliders-grid">
            <div class="slider-group">
              <div class="slider-header">
                <span>tilt_x_deg (Primary Tilt)</span>
                <span class="slider-val" id="val_tilt_x">0.05°</span>
              </div>
              <input type="range" id="tilt_x_deg" min="-5.0" max="5.0" step="0.05" value="0.05" oninput="updateParam('tilt_x', this.value, '°')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>tilt_y_deg (Secondary Tilt)</span>
                <span class="slider-val" id="val_tilt_y">0.02°</span>
              </div>
              <input type="range" id="tilt_y_deg" min="-5.0" max="5.0" step="0.05" value="0.02" oninput="updateParam('tilt_y', this.value, '°')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>vibration_amplitude_g (Dynamic)</span>
                <span class="slider-val" id="val_vibration_amplitude">0.03 g</span>
              </div>
              <input type="range" id="vibration_amplitude_g" min="0.0" max="2.0" step="0.02" value="0.03" oninput="updateParam('vibration_amplitude', this.value, ' g')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>vibration_freq_hz (Frequency)</span>
                <span class="slider-val" id="val_vibration_freq">12 Hz</span>
              </div>
              <input type="range" id="vibration_freq_hz" min="0" max="100" step="1" value="12" oninput="updateParam('vibration_freq', this.value, ' Hz')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>crack_displacement_mm</span>
                <span class="slider-val" id="val_crack_displacement">0.2 mm</span>
              </div>
              <input type="range" id="crack_displacement_mm" min="0.0" max="25.0" step="0.2" value="0.2" oninput="updateParam('crack_displacement', this.value, ' mm')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>water_level_cm</span>
                <span class="slider-val" id="val_water_level">15 cm</span>
              </div>
              <input type="range" id="water_level_cm" min="0" max="150" step="1" value="15" oninput="updateParam('water_level', this.value, ' cm')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>gas_ppm (CH4 / Toxic)</span>
                <span class="slider-val" id="val_gas">12 ppm</span>
              </div>
              <input type="range" id="gas_ppm" min="0" max="100" step="1" value="12" oninput="updateParam('gas', this.value, ' ppm')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>temperature_c</span>
                <span class="slider-val" id="val_temperature">24.5 °C</span>
              </div>
              <input type="range" id="temperature_c" min="10" max="50" step="0.5" value="24.5" oninput="updateParam('temperature', this.value, ' °C')">
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <span>humidity_pct</span>
                <span class="slider-val" id="val_humidity">65 %</span>
              </div>
              <input type="range" id="humidity_pct" min="20" max="100" step="1" value="65" oninput="updateParam('humidity', this.value, ' %')">
            </div>
          </div>

          <div class="action-row">
            <button class="btn btn-primary" onclick="runInference()">
              <span>⚡ Run Model Inference</span>
            </button>
            <button class="btn btn-secondary" id="btn-stream" onclick="toggleStream()">
              <span>▶ Continuous Stream Mode</span>
            </button>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: RESULTS & DRIFT MONITOR -->
      <div>
        <div class="card">
          <div class="card-title">
            <span>Inference Diagnostics</span>
            <span class="latency-pill" id="latency-display">Latency: -- ms</span>
          </div>

          <!-- Hero Prediction -->
          <div class="pred-hero">
            <div class="pred-class normal" id="pred-class-text">NORMAL</div>
            <div id="alert-badge-container">
              <span class="alert-badge GREEN" id="alert-badge">GREEN ALERT</span>
            </div>
            <div class="pred-meta">
              <span id="model-type-badge">Architecture: BaselineCNNLSTM</span>
              <span>•</span>
              <span id="reference-id-text">Reference: manual-test</span>
            </div>
          </div>

          <!-- Severity Meter -->
          <div class="meter-container">
            <div class="meter-header">
              <span style="font-weight: 600;">Continuous Severity Score</span>
              <span class="slider-val" id="severity-score">0.05 / 1.00</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill" id="meter-fill" style="width: 5%;"></div>
            </div>
          </div>

          <!-- Class Probabilities Distribution -->
          <div class="card-title" style="margin-top: 20px; font-size: 14px;">
            <span>Class Logit Probabilities (Softmax)</span>
          </div>
          <div class="prob-bars">
            <div class="prob-item">
              <div class="prob-labels">
                <span>0 • Normal Operating Baseline</span>
                <span class="slider-val" id="prob-val-normal">95.0%</span>
              </div>
              <div class="prob-track">
                <div class="prob-fill normal" id="prob-fill-normal" style="width: 95%;"></div>
              </div>
            </div>

            <div class="prob-item">
              <div class="prob-labels">
                <span>1 • Equipment Noise / Drill Vibration</span>
                <span class="slider-val" id="prob-val-noise">4.5%</span>
              </div>
              <div class="prob-track">
                <div class="prob-fill equipment_noise" id="prob-fill-noise" style="width: 4.5%;"></div>
              </div>
            </div>

            <div class="prob-item">
              <div class="prob-labels">
                <span style="color: #f87171; font-weight: 600;">2 • [!] Subsidence Risk</span>
                <span class="slider-val" id="prob-val-subsidence" style="color: #f87171;">0.5%</span>
              </div>
              <div class="prob-track">
                <div class="prob-fill subsidence_risk" id="prob-fill-subsidence" style="width: 0.5%;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Drift Monitor Card -->
        <div class="card">
          <div class="card-title">
            <span>Rolling Drift Monitor (§10.7)</span>
            <span class="sub">500-Sample Sliding Window</span>
          </div>
          <div class="drift-box">
            <div class="drift-header">
              <span style="font-size: 13px; font-weight: 600;" id="drift-status-msg">● Health: Baseline Distribution Matching</span>
              <span class="drift-pill pass" id="drift-pill">TVD = 0.042 (PASS)</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;" id="drift-details">
              Total Predictions Evaluated: <span class="slider-val" id="drift-total">0</span> | Window Primed: <span class="slider-val" id="drift-window">0/500</span><br>
              Baseline: normal 40.5%, noise 49.2%, subsidence 10.3%
            </div>
            <button class="btn btn-secondary" style="width: 100%; margin-top: 12px; font-size: 12px; padding: 8px;" onclick="simulateDriftBurst()">
              ⚡ Simulate Hardware Sensor Anomaly (Trigger Drift Check)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let streamInterval = null;
    const SENSOR_CHANNELS = [
      "tilt_x_deg", "tilt_y_deg", "vibration_amplitude_g", "vibration_freq_hz",
      "crack_displacement_mm", "water_level_cm", "gas_ppm",
      "temperature_c", "humidity_pct"
    ];

    const PRESETS = {
      normal: {
        tilt_x_deg: 0.05, tilt_y_deg: 0.02, vibration_amplitude_g: 0.03, vibration_freq_hz: 12,
        crack_displacement_mm: 0.2, water_level_cm: 15, gas_ppm: 12, temperature_c: 24.5, humidity_pct: 65
      },
      drilling: {
        tilt_x_deg: 0.12, tilt_y_deg: 0.08, vibration_amplitude_g: 1.45, vibration_freq_hz: 68,
        crack_displacement_mm: 0.4, water_level_cm: 18, gas_ppm: 14, temperature_c: 28.0, humidity_pct: 62
      },
      early_sub: {
        tilt_x_deg: 1.85, tilt_y_deg: 0.95, vibration_amplitude_g: 0.18, vibration_freq_hz: 24,
        crack_displacement_mm: 6.8, water_level_cm: 45, gas_ppm: 26, temperature_c: 26.2, humidity_pct: 78
      },
      critical_sub: {
        tilt_x_deg: 4.20, tilt_y_deg: 2.85, vibration_amplitude_g: 0.85, vibration_freq_hz: 38,
        crack_displacement_mm: 19.4, water_level_cm: 85, gas_ppm: 48, temperature_c: 29.5, humidity_pct: 88
      },
      gas_inflow: {
        tilt_x_deg: 0.85, tilt_y_deg: 0.65, vibration_amplitude_g: 0.12, vibration_freq_hz: 16,
        crack_displacement_mm: 3.2, water_level_cm: 110, gas_ppm: 82, temperature_c: 25.0, humidity_pct: 94
      }
    };

    function updateParam(id, val, unit) {
      document.getElementById('val_' + id).innerText = val + unit;
    }

    function loadPreset(key) {
      const p = PRESETS[key];
      if (!p) return;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      event.currentTarget.classList.add('active');

      document.getElementById('tilt_x_deg').value = p.tilt_x_deg; updateParam('tilt_x', p.tilt_x_deg, '°');
      document.getElementById('tilt_y_deg').value = p.tilt_y_deg; updateParam('tilt_y', p.tilt_y_deg, '°');
      document.getElementById('vibration_amplitude_g').value = p.vibration_amplitude_g; updateParam('vibration_amplitude', p.vibration_amplitude_g, ' g');
      document.getElementById('vibration_freq_hz').value = p.vibration_freq_hz; updateParam('vibration_freq', p.vibration_freq_hz, ' Hz');
      document.getElementById('crack_displacement_mm').value = p.crack_displacement_mm; updateParam('crack_displacement', p.crack_displacement_mm, ' mm');
      document.getElementById('water_level_cm').value = p.water_level_cm; updateParam('water_level', p.water_level_cm, ' cm');
      document.getElementById('gas_ppm').value = p.gas_ppm; updateParam('gas', p.gas_ppm, ' ppm');
      document.getElementById('temperature_c').value = p.temperature_c; updateParam('temperature', p.temperature_c, ' °C');
      document.getElementById('humidity_pct').value = p.humidity_pct; updateParam('humidity', p.humidity_pct, ' %');

      runInference();
    }

    function buildWindowPayload() {
      // Build 32x9 window where earlier steps gradually approach current slider values
      const currentVals = SENSOR_CHANNELS.map(ch => parseFloat(document.getElementById(ch).value));
      const windowData = [];
      for (let t = 0; t < 32; t++) {
        const factor = 0.7 + 0.3 * (t / 31); // gradual ramp up
        const noise = (Math.random() - 0.5) * 0.04;
        const row = currentVals.map((v, i) => {
          // If vibration or gas, add subtle stochastic perturbation
          return Number((v * factor + noise).toFixed(4));
        });
        windowData.push(row);
      }
      return windowData;
    }

    async function runInference() {
      const windowData = buildWindowPayload();
      const t0 = performance.now();

      try {
        const res = await fetch('/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ window: windowData, reference_id: 'browser-test-' + Date.now() })
        });
        const elapsed = (performance.now() - t0).toFixed(2);
        document.getElementById('latency-display').innerText = `Latency: ${elapsed} ms`;

        if (!res.ok) {
          const err = await res.json();
          alert('Inference error: ' + err.detail);
          return;
        }

        const data = await res.json();
        renderPrediction(data);
        fetchDriftStatus();
      } catch (e) {
        console.error('Inference call failed:', e);
        document.getElementById('latency-display').innerText = `Error: Cannot reach server`;
      }
    }

    function renderPrediction(data) {
      // Class
      const clsEl = document.getElementById('pred-class-text');
      clsEl.innerText = data.anomaly_class.replace('_', ' ');
      clsEl.className = 'pred-class ' + data.anomaly_class;

      // Alert badge
      const alertEl = document.getElementById('alert-badge');
      alertEl.innerText = data.alert_level + ' ALERT';
      alertEl.className = 'alert-badge ' + data.alert_level;

      // Severity
      const sev = data.severity;
      document.getElementById('severity-score').innerText = sev.toFixed(2) + ' / 1.00';
      document.getElementById('meter-fill').style.width = Math.min(100, Math.max(0, sev * 100)) + '%';

      // Probabilities
      const pNorm = (data.class_probs.normal * 100).toFixed(1);
      const pNoise = (data.class_probs.equipment_noise * 100).toFixed(1);
      const pSub = (data.class_probs.subsidence_risk * 100).toFixed(1);

      document.getElementById('prob-val-normal').innerText = pNorm + '%';
      document.getElementById('prob-fill-normal').style.width = pNorm + '%';

      document.getElementById('prob-val-noise').innerText = pNoise + '%';
      document.getElementById('prob-fill-noise').style.width = pNoise + '%';

      document.getElementById('prob-val-subsidence').innerText = pSub + '%';
      document.getElementById('prob-fill-subsidence').style.width = pSub + '%';

      document.getElementById('model-type-badge').innerText = 'Version: ' + data.model_version;
    }

    async function fetchDriftStatus() {
      try {
        const res = await fetch('/drift');
        if (!res.ok) return;
        const d = await res.json();
        const pill = document.getElementById('drift-pill');
        const statusMsg = document.getElementById('drift-status-msg');

        if (d.drift_detected) {
          pill.className = 'drift-pill warn';
          pill.innerText = `TVD = ${d.total_variation_distance} (DRIFT DETECTED)`;
          statusMsg.innerText = '⚠️ Warning: Live Prediction Distribution Shifted!';
          statusMsg.style.color = '#f87171';
        } else {
          pill.className = 'drift-pill pass';
          pill.innerText = `TVD = ${d.total_variation_distance} (PASS)`;
          statusMsg.innerText = '● Health: Baseline Distribution Matching';
          statusMsg.style.color = '#34d399';
        }

        document.getElementById('drift-total').innerText = d.total_predictions;
        document.getElementById('drift-window').innerText = `${d.samples_in_window}/500`;
      } catch (e) {
        console.warn('Drift fetch failed', e);
      }
    }

    async function switchModel(checkpointName) {
      alert(`To swap checkpoints in production without redeploying:\nSet the container environment variable:\nML_MODEL_CHECKPOINT=${checkpointName}\nand restart the container.\n\nPer Phase 6 audit, baseline_latest.pt is the verified production model.`);
    }

    async function simulateDriftBurst() {
      // Fire 60 anomalous subsidence requests in rapid succession to trigger the drift monitor
      for (let i = 0; i < 40; i++) {
        const payload = SENSOR_CHANNELS.map(() => 5.0);
        await fetch('/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            window: Array(32).fill(payload),
            reference_id: 'drift-burst-' + i
          })
        });
      }
      fetchDriftStatus();
    }

    function toggleStream() {
      const btn = document.getElementById('btn-stream');
      if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
        btn.classList.remove('streaming');
        btn.innerHTML = '<span>▶ Continuous Stream Mode</span>';
      } else {
        btn.classList.add('streaming');
        btn.innerHTML = '<span>⏹ Stop Streaming</span>';
        streamInterval = setInterval(() => {
          // Add subtle natural jitter to current sliders and infer
          const tilt = parseFloat(document.getElementById('tilt_x_deg').value);
          const jitter = (Math.random() - 0.5) * 0.1;
          document.getElementById('tilt_x_deg').value = (tilt + jitter).toFixed(2);
          updateParam('tilt_x', (tilt + jitter).toFixed(2), '°');
          runInference();
        }, 1200);
      }
    }

    // Run on initial load
    window.onload = () => {
      runInference();
      fetchDriftStatus();
    };
  </script>
</body>
</html>
"""
