import os
import sys
import json
import time
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import torch

# Add parent directory to path so we can import models.* and satisfy IDE static analysis
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from models.cnn_lstm_attention import BaselineCNNLSTM, HybridCNNBILSTMAttention
from drift_monitor import RollingDriftMonitor
from demo_page import DEMO_HTML

app = FastAPI(
    title="Mine Subsidence ML Inference Service",
    description="Real-time multi-sensor deep learning inference microservice for mine subsidence detection (Shadow Mode)",
    version="0.1.0",
)

# Enable CORS for direct frontend dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
@app.get("/demo", response_class=HTMLResponse, include_in_schema=False)
def browser_demo():
    """Interactive browser testing console for the ML model."""
    return HTMLResponse(content=DEMO_HTML)

MODEL_REGISTRY = os.path.join(os.path.dirname(__file__), "model_registry")
# Configurable model checkpoint selection via env var (Default: baseline_latest.pt per Phase 6 audit)
CHECKPOINT_NAME = os.environ.get("ML_MODEL_CHECKPOINT", "baseline_latest.pt")
CHECKPOINT_PATH = os.path.join(MODEL_REGISTRY, CHECKPOINT_NAME)
PREDICTION_LOG_FILE = os.path.join(os.path.dirname(__file__), "prediction_log.jsonl")

# Rolling drift monitor (§10.7)
drift_monitor = RollingDriftMonitor(window_size=500, log_interval=50)

# Global state for model and config
model = None
model_version = "unknown"
model_type = "baseline"
norm_stats = None
label_names = {}
EXPECTED_WINDOW_LEN = 32
EXPECTED_N_CHANNELS = 9

@app.on_event("startup")
def load_model():
    global model, model_version, model_type, norm_stats, label_names, EXPECTED_WINDOW_LEN, EXPECTED_N_CHANNELS
    
    if not os.path.exists(CHECKPOINT_PATH):
        raise RuntimeError(f"Model checkpoint not found at {CHECKPOINT_PATH}")
    
    print(f"Loading checkpoint from {CHECKPOINT_PATH} (Configured by ML_MODEL_CHECKPOINT='{CHECKPOINT_NAME}')")
    checkpoint = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
    
    # Extract config
    config = checkpoint["model_config"]
    EXPECTED_WINDOW_LEN = config["window_len"]
    EXPECTED_N_CHANNELS = config["n_channels"]
    n_classes = config["n_classes"]
    
    model_version = checkpoint.get("version", "unknown")
    model_type = checkpoint.get("model_type", "baseline")
    norm_stats = checkpoint["normalization_stats"]
    label_names = checkpoint.get("label_names", {0: "normal", 1: "equipment_noise", 2: "subsidence_risk"})
    
    # Init model dynamically based on checkpoint architecture
    if model_type in ["hybrid", "hybrid_attention"]:
        model = HybridCNNBILSTMAttention(**config)
    else:
        model = BaselineCNNLSTM(
            n_channels=EXPECTED_N_CHANNELS,
            window_len=EXPECTED_WINDOW_LEN,
            n_classes=n_classes,
            cnn_filters=config["cnn_filters"],
            cnn_kernel=config.get("cnn_kernel", 5),
            lstm_hidden=config["lstm_hidden"],
            dropout=config["dropout"]
        )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    print(f"Model {model_version} (type={model_type}) loaded successfully.")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_version": model_version,
        "model_type": model_type,
        "checkpoint": CHECKPOINT_NAME,
        "drift_detected": drift_monitor.last_drift_status["drift_detected"],
    }

@app.get("/drift")
def get_drift():
    return drift_monitor.get_status()

class PredictRequest(BaseModel):
    # A single window: list of lists. (window_len x n_channels)
    window: List[List[float]]
    reference_id: str = "unknown"

class PredictResponse(BaseModel):
    anomaly_class: str
    class_probs: Dict[str, float]
    severity: float
    alert_level: str
    model_version: str

def get_provisional_alert_level(severity: float) -> str:
    """
    Provisional thresholding for shadow mode.
    Not MSHA-calibrated.
    """
    if severity < 0.2:
        return "GREEN"
    elif severity < 0.6:
        return "YELLOW"
    elif severity < 0.8:
        return "ORANGE"
    else:
        return "RED"

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    # 1. Input Validation
    window_data = req.window
    
    if len(window_data) != EXPECTED_WINDOW_LEN:
        raise HTTPException(status_code=400, detail=f"Expected window length {EXPECTED_WINDOW_LEN}, got {len(window_data)}")
    
    for i, timestep in enumerate(window_data):
        if len(timestep) != EXPECTED_N_CHANNELS:
            raise HTTPException(status_code=400, detail=f"Expected {EXPECTED_N_CHANNELS} channels at timestep {i}, got {len(timestep)}")
            
    # Convert to numpy and check for NaNs
    try:
        X_np = np.array(window_data, dtype=np.float32)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid data format, could not convert to float array.")
        
    if np.isnan(X_np).any():
        raise HTTPException(status_code=400, detail="Input contains NaNs, which is not allowed.")
        
    # 2. Normalization
    mean = np.array(norm_stats["mean"], dtype=np.float32)
    std = np.array(norm_stats["std"], dtype=np.float32)
    X_norm = (X_np - mean) / std
    
    # 3. Model Inference
    X_tensor = torch.tensor(X_norm, dtype=torch.float32).unsqueeze(0)
    
    with torch.no_grad():
        out = model(X_tensor)
        
    # Process outputs
    logits = out["class_logits"].squeeze(0)
    probs = torch.softmax(logits, dim=0).numpy()
    pred_class_idx = int(np.argmax(probs))
    pred_class_name = label_names[pred_class_idx]
    
    class_probs = {label_names[i]: float(probs[i]) for i in range(len(probs))}
    severity = float(out["severity"].squeeze(0).squeeze(-1).item())
    
    alert_level = get_provisional_alert_level(severity)
    
    response = PredictResponse(
        anomaly_class=pred_class_name,
        class_probs=class_probs,
        severity=severity,
        alert_level=alert_level,
        model_version=model_version
    )
    
    # 4. Lightweight Prediction Logging (Placeholder for Prediction Log Store §10.4)
    try:
        log_entry = {
            "timestamp": time.time(),
            "reference_id": req.reference_id,
            "response": response.dict()
        }
        with open(PREDICTION_LOG_FILE, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"Warning: Failed to log prediction: {e}")

    # 5. Record prediction for Rolling Drift Monitoring (§10.7)
    try:
        drift_monitor.record_prediction(pred_class_name)
    except Exception as e:
        print(f"Warning: Failed to update drift monitor: {e}")
        
    return response

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
