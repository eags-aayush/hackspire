"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { Socket } from 'socket.io-client';
import { getSocketClient } from '@/lib/socket';
import { ValidatedSensorReading } from '@/types/sensor';
import { NodeStatusState } from '@/types/node';
import { SystemLatencyMetrics, SnapshotPayload } from '@/types/socket';
import { SubsidenceAlert } from '@/types/alert';
import { ShadowMlPrediction } from '@/types/ml';
import type { EdgeAlertLevel, EdgeNodeActuatorState, EdgeAlertCommand } from '@/types/edgeAlert';
import { EDGE_ALERT_CONFIGS } from '@/types/edgeAlert';
import { getSensorSeverity } from '@/lib/utils';
import { SENSOR_CONFIGS } from '@/lib/constants';
import {
  decodeSensorReadingBatch,
  decodeNodeStatusBatch,
  decodeZoneSnapshot,
} from '@/lib/proto/telemetry';
import { voiceAlertService } from '@/lib/voiceAlertService';

export interface GatewayStatus {
  brokerConnected: boolean;
  loraGatewayConnected: boolean;
  status: 'online' | 'offline' | 'standby';
  lastLoraPacketAt: string | null;
  totalLoraPackets: number;
  gatewayType: string;
  topic: string;
  nodeId?: string;
}

interface RealtimeContextValue {
  socket: Socket | null;
  isConnected: boolean;
  gatewayStatus: GatewayStatus;
  activeZones: string[];
  readings: Record<string, Record<string, Record<string, ValidatedSensorReading>>>;
  nodeStatuses: Record<string, Record<string, NodeStatusState>>;
  mlPredictions: Record<string, Record<string, ShadowMlPrediction>>;
  metrics: SystemLatencyMetrics;
  alerts: SubsidenceAlert[];
  stats: {
    totalZones: number;
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalGaps: number;
    activeSensorsCount: number;
  };
  reconnect: () => void;
  joinZone: (zoneId: string) => void;
  clearAlerts: () => void;
  clearCache: (options?: { purgeOfflineOnly?: boolean }) => void;
  isSimulationActive: boolean;
  toggleSimulation: () => void;
  triggerDemoMlEvent: (
    nodeId?: string,
    anomalyClass?: 'subsidence_risk' | 'equipment_noise' | 'normal'
  ) => void;
  autoPurgeStale: boolean;
  setAutoPurgeStale: (enabled: boolean) => void;
  voiceAlertsEnabled: boolean;
  toggleVoiceAlerts: () => void;
  testVoiceAlert: () => void;
  isSpeaking: boolean;
  lastSpokenMessage: string | null;
  edgeActuatorStates: Record<string, EdgeNodeActuatorState>;
  dispatchEdgeAlert: (params: { nodeId: string; zoneId: string; level: EdgeAlertLevel; message?: string }) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

// Stable zone merge helper that prevents re-renders when list of zones is unchanged
function mergeUniqueZones(existing: string[], incoming: string[]): string[] {
  const merged = Array.from(new Set([...existing, ...incoming])).filter(Boolean).sort();
  if (existing.length === merged.length && existing.every((z, i) => z === merged[i])) {
    return existing;
  }
  return merged;
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialization avoids setState inside useEffect
  const [socket] = useState<Socket | null>(() =>
    typeof window !== 'undefined' ? getSocketClient() : null
  );

  const [isConnected, setIsConnected] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>({
    brokerConnected: false,
    loraGatewayConnected: false,
    status: 'standby',
    lastLoraPacketAt: null,
    totalLoraPackets: 0,
    gatewayType: 'ESP32 LoRa Gateway (SX1276)',
    topic: 'sensors/lora/#',
    nodeId: 'NODE_01',
  });
  const [activeZones, setActiveZones] = useState<string[]>([]);
  const [readings, setReadings] = useState<
    Record<string, Record<string, Record<string, ValidatedSensorReading>>>
  >({});
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<string, Record<string, NodeStatusState>>
  >({});
  const [mlPredictions, setMlPredictions] = useState<
    Record<string, Record<string, ShadowMlPrediction>>
  >({});
  const [alerts, setAlerts] = useState<SubsidenceAlert[]>([]);
  const [metrics, setMetrics] = useState<SystemLatencyMetrics>({
    avgLatency: 0,
    maxLatency: 0,
    count: 0,
    totalLatency: 0,
    packetsPerSec: 0,
    protoBytesReceived: 0,
    lastPacketBytes: 0,
    lastJsonBytesEquivalent: 0,
    estimatedBandwidthSavedPercent: 0,
    transportFormat: 'Protobuf (Binary)',
  });

  // State for simulated interactive mesh mode & auto purge
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [autoPurgeStale, setAutoPurgeStale] = useState(true);

  // Edge Alert Actuator States (physical LED / buzzer state per node)
  const [edgeActuatorStates, setEdgeActuatorStates] = useState<Record<string, EdgeNodeActuatorState>>({});

  // Voice Alert & Speech Synthesis state
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('voice_alerts_enabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastSpokenMessage, setLastSpokenMessage] = useState<string | null>(null);

  const toggleVoiceAlerts = useCallback(() => {
    setVoiceAlertsEnabled(prev => {
      const next = !prev;
      voiceAlertService.setEnabled(next);
      if (next) {
        voiceAlertService.speak('Voice alerts activated.', {
          type: 'warning',
          force: true,
          onStart: () => {
            setIsSpeaking(true);
            setLastSpokenMessage('Voice alerts activated.');
          },
          onEnd: () => {
            setIsSpeaking(false);
          },
        });
      } else {
        voiceAlertService.cancel();
        setIsSpeaking(false);
        setLastSpokenMessage(null);
      }
      return next;
    });
  }, []);

  const testVoiceAlert = useCallback(() => {
    const testMsg = 'Voice Alert System Online. Geotechnical early warning audio beacon is operational.';
    voiceAlertService.speak(testMsg, {
      type: 'critical',
      force: true,
      onStart: () => {
        setIsSpeaking(true);
        setLastSpokenMessage(testMsg);
      },
      onEnd: () => {
        setIsSpeaking(false);
      },
    });
  }, []);

  const joinedZonesRef = useRef<Set<string>>(new Set());
  const packetCountInWindowRef = useRef(0);
  const lastProtoReceivedAtRef = useRef<number>(0);

  // Measure packets per second periodically
  useEffect(() => {
    const ppsInterval = setInterval(() => {
      const pps = packetCountInWindowRef.current;
      packetCountInWindowRef.current = 0;
      setMetrics(prev => {
        if (prev.packetsPerSec === pps) return prev;
        return {
          ...prev,
          packetsPerSec: pps,
        };
      });
    }, 1000);

    return () => clearInterval(ppsInterval);
  }, []);

  // Client-side Gateway Watchdog to detect hardware disconnection (<25s without LoRa packet)
  useEffect(() => {
    const gwWatchdog = setInterval(() => {
      setGatewayStatus(prev => {
        if (!prev.lastLoraPacketAt) return prev;
        const elapsed = Date.now() - new Date(prev.lastLoraPacketAt).getTime();
        if (elapsed > 25000 && (prev.loraGatewayConnected || prev.status === 'online')) {
          return {
            ...prev,
            loraGatewayConnected: false,
            status: 'offline',
          };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(gwWatchdog);
  }, []);

  // Shared ML Prediction Dispatcher: updates state and triggers alerts on risk
  const dispatchMlPrediction = useCallback((prediction: ShadowMlPrediction) => {
    if (!prediction?.nodeId || !prediction?.zoneId) return;
    setMlPredictions(prev => {
      const next = { ...prev };
      if (!next[prediction.zoneId]) next[prediction.zoneId] = {};
      next[prediction.zoneId] = {
        ...next[prediction.zoneId],
        [prediction.nodeId]: prediction,
      };
      return next;
    });

    if (
      prediction.alert_level !== 'GREEN' ||
      prediction.anomaly_class === 'subsidence_risk' ||
      prediction.severity >= 0.2
    ) {
      const isCritical = prediction.alert_level === 'RED' || prediction.severity >= 0.6;
      const confidencePct = Math.round(
        (prediction.class_probs?.[prediction.anomaly_class] || 0) * 100,
      );
      const severityPct = Math.round(prediction.severity * 100);

      const newMlAlert: SubsidenceAlert = {
        id: prediction.predictionId || `ml-alert-${prediction.nodeId}-${Date.now()}`,
        nodeId: prediction.nodeId,
        zoneId: prediction.zoneId,
        sensorType: 'tilt' as any,
        value: severityPct,
        threshold: 20,
        unit: '% severity',
        severity: isCritical ? 'critical' : 'warning',
        timestamp: prediction.timestamp,
        message: `[AI/ML Early Warning] ${prediction.anomaly_class.replace(/_/g, ' ').toUpperCase()} on ${prediction.nodeId} (${confidencePct}% conf, ${severityPct}% sev) [${prediction.alert_level}]`,
      };

      setAlerts(prev => {
        // Debounce alert per node within 5 seconds to prevent spamming
        const recent = prev.find(
          a =>
            a.nodeId === prediction.nodeId &&
            Date.now() - new Date(a.timestamp).getTime() < 5000 &&
            a.message.includes('[AI/ML Early Warning]'),
        );
        if (recent) return prev;
        return [newMlAlert, ...prev].slice(0, 50);
      });

      // Voice Alert announcement for AI-detected risks
      if (prediction.anomaly_class === 'subsidence_risk' || prediction.alert_level === 'RED') {
        const cleanZone = prediction.zoneId.replace(/^ZONE_\d+_/, '').replace(/_/g, ' ');
        const cleanNode = prediction.nodeId.replace(/_/g, ' ');
        const speechText = `Warning! AI subsidence risk detected on ${cleanNode}, ${cleanZone}. Severity ${severityPct} percent.`;
        voiceAlertService.speak(speechText, {
          type: 'critical',
          onStart: () => {
            setIsSpeaking(true);
            setLastSpokenMessage(speechText);
          },
          onEnd: () => {
            setIsSpeaking(false);
          },
        });
      } else if (prediction.alert_level === 'ORANGE' && prediction.severity >= 0.5) {
        const cleanZone = prediction.zoneId.replace(/^ZONE_\d+_/, '').replace(/_/g, ' ');
        const cleanNode = prediction.nodeId.replace(/_/g, ' ');
        const speechText = `Hazard alert on ${cleanNode}, ${cleanZone}. Safety threshold breached.`;
        voiceAlertService.speak(speechText, {
          type: 'warning',
          onStart: () => {
            setIsSpeaking(true);
            setLastSpokenMessage(speechText);
          },
          onEnd: () => {
            setIsSpeaking(false);
          },
        });
      }
    }
  }, []);

  const triggerDemoMlEvent = useCallback(
    (
      targetNodeId: string = 'NODE_03',
      targetClass: 'subsidence_risk' | 'equipment_noise' | 'normal' = 'subsidence_risk'
    ) => {
      let targetZone = 'ZONE_01_LONGWALL_FACE';
      for (const [zId, nodes] of Object.entries(nodeStatuses)) {
        if (nodes[targetNodeId]) {
          targetZone = zId;
          break;
        }
      }

      const isRisk = targetClass === 'subsidence_risk';
      const isNoise = targetClass === 'equipment_noise';
      const severity = isRisk ? 0.91 : isNoise ? 0.24 : 0.02;
      const alert_level = isRisk ? 'RED' : isNoise ? 'YELLOW' : 'GREEN';
      const class_probs = isRisk
        ? { normal: 0.01, equipment_noise: 0.01, subsidence_risk: 0.98 }
        : isNoise
        ? { normal: 0.04, equipment_noise: 0.94, subsidence_risk: 0.02 }
        : { normal: 0.98, equipment_noise: 0.01, subsidence_risk: 0.01 };

      const pred: ShadowMlPrediction = {
        predictionId: `manual-ml-${targetNodeId}-${Date.now()}`,
        nodeId: targetNodeId,
        zoneId: targetZone,
        timestamp: new Date().toISOString(),
        anomaly_class: targetClass,
        class_probs,
        severity,
        alert_level,
        inferenceLatencyMs: 0.71,
        windowLen: 32,
        stride: 4,
        isShadowMode: true,
        model_version: 'baseline_latest.pt',
      };

      dispatchMlPrediction(pred);

      // Speak explicit button simulation event
      const cleanNode = targetNodeId.replace(/_/g, ' ');
      const speechText = isRisk
        ? `Manual simulation: Neural network detected critical subsidence risk on ${cleanNode}.`
        : isNoise
        ? `Machinery cutting noise detected on ${cleanNode}. Strata normal.`
        : `Telemetry nominal on ${cleanNode}.`;
      voiceAlertService.speak(speechText, {
        type: isRisk ? 'critical' : 'warning',
        force: true,
        onStart: () => {
          setIsSpeaking(true);
          setLastSpokenMessage(speechText);
        },
        onEnd: () => {
          setIsSpeaking(false);
        },
      });
    },
    [nodeStatuses, dispatchMlPrediction]
  );

  // Real-Life Coal Mine Telemetry & Multi-Anomaly Simulation Generator
  // 2 Real Deep-Seam Zones with 3 Mesh Nodes Each (6 Nodes Total)
  useEffect(() => {
    if (!isSimulationActive) return;

    const simZones = [
      'ZONE_01_LONGWALL_FACE',
      'ZONE_02_RETURN_AIRWAY',
    ];
    setActiveZones(simZones);

    const simNodes = [
      { zoneId: 'ZONE_01_LONGWALL_FACE', nodeId: 'NODE_01' },
      { zoneId: 'ZONE_01_LONGWALL_FACE', nodeId: 'NODE_02' },
      { zoneId: 'ZONE_01_LONGWALL_FACE', nodeId: 'NODE_03' },
      { zoneId: 'ZONE_02_RETURN_AIRWAY', nodeId: 'NODE_04' },
      { zoneId: 'ZONE_02_RETURN_AIRWAY', nodeId: 'NODE_05' },
      { zoneId: 'ZONE_02_RETURN_AIRWAY', nodeId: 'NODE_06' },
    ];

    let batchRound = 1;

    const generateSimBatch = () => {
      const now = new Date().toISOString();
      const nowMs = Date.now();

      // Alternating Zone Risk Cycle:
      // 10 rounds per phase (10 * 4s = 40s per phase) for calm, progressive evaluation
      // Phase A: ZONE_01_LONGWALL_FACE slowly builds geotechnical risk, ZONE_02_RETURN_AIRWAY is normal/calm
      // Phase B: SWAP! ZONE_01_LONGWALL_FACE stabilizes to normal, ZONE_02_RETURN_AIRWAY slowly develops hazards
      const ROUNDS_PER_PHASE = 10;
      const phaseIndex = Math.floor((batchRound - 1) / ROUNDS_PER_PHASE) % 2;
      const isPhaseA = phaseIndex === 0;
      const stepInPhase = (batchRound - 1) % ROUNDS_PER_PHASE; // 0 to 9

      // Gradual, realistic transition progression across 10 rounds (40 seconds total per phase)
      // Steps 0-1 (0-8s): Subtle precursor emergence (ramp ~0.25 -> 0.45)
      // Steps 2-3 (8-16s): Active risk escalation (ramp ~0.65 -> 0.85)
      // Steps 4-6 (16-28s): Peak critical risk & threshold breaches (ramp ~1.0 -> 0.95)
      // Steps 7-9 (28-40s): Safety response engaged, gradual subsidence stabilization (ramp ~0.60 -> 0.30 -> 0.12)
      const rampArray = [0.25, 0.45, 0.68, 0.85, 1.00, 0.95, 0.80, 0.55, 0.30, 0.12];
      const ramp = rampArray[stepInPhase] ?? 0.5;

      // Voice alert announcement at the start of each phase swap
      if (stepInPhase === 0 && batchRound > 1) {
        if (isPhaseA) {
          const phaseMsg = 'Phase A active: Geotechnical strain shifting to Longwall Face. Early subsidence dynamics developing on Node 03.';
          voiceAlertService.speak(phaseMsg, {
            type: 'critical',
            onStart: () => {
              setIsSpeaking(true);
              setLastSpokenMessage(phaseMsg);
            },
            onEnd: () => {
              setIsSpeaking(false);
            },
          });
        } else {
          const phaseMsg = 'Phase B active: Longwall Face stabilized. Hazard shifted to Return Airway. Monitoring methane buildup and fault shear.';
          voiceAlertService.speak(phaseMsg, {
            type: 'critical',
            onStart: () => {
              setIsSpeaking(true);
              setLastSpokenMessage(phaseMsg);
            },
            onEnd: () => {
              setIsSpeaking(false);
            },
          });
        }
      }

      const newSimReadings: ValidatedSensorReading[] = [];

      simNodes.forEach(({ zoneId, nodeId }, nIdx) => {
        let tilt = 0.12;
        let vibe = 0.45;
        let disp = 0.20;
        let crack = 0;
        let gas = 5.6;
        let water = 0.24;

        if (isPhaseA) {
          // =========================================================================
          // PHASE A: ZONE 1 UNDER GEOTECHNICAL RISK | ZONE 2 CALM & NORMAL BASELINE
          // =========================================================================
          if (nodeId === 'NODE_01') {
            // Main Gate Chock Support #12: Absorbing overburden load transfer
            tilt = 0.45 + ramp * 0.55 + Math.sin(nowMs / 6000) * 0.08;
            vibe = 1.10 + ramp * 1.30;
            disp = 0.50 + ramp * 0.80;
            crack = 0;
            gas = 6.0 + ramp * 4.5;
            water = 0.28;
          } else if (nodeId === 'NODE_02') {
            // Longwall Shearer Cutting Machine Noise (High mechanical vibration, stable strata)
            // Demonstrates AI False Alarm Suppression (YELLOW equipment_noise badge)
            tilt = 0.18 + ramp * 0.14;
            vibe = 3.5 + ramp * 10.5 + Math.sin(nowMs / 1800) * 1.2;
            disp = 0.25 + ramp * 0.28;
            crack = 0;
            gas = 6.5 + ramp * 6.5;
            water = 0.30;
          } else if (nodeId === 'NODE_03') {
            // Imminent Strata Caving & Roof Subsidence Precursor
            // Demonstrates AI Neural Network Early Warning (Gradually escalates to RED subsidence_risk)
            tilt = 1.20 + ramp * 2.85 + Math.sin(nowMs / 2500) * 0.12;
            vibe = 1.80 + ramp * 4.20;
            disp = 3.5 + ramp * 10.8;
            crack = ramp >= 0.65 ? 1 : 0;
            gas = 8.0 + ramp * 10.5;
            water = 0.30 + ramp * 0.42;
          } else if (nodeId === 'NODE_04') {
            // ZONE 2 Tailgate Ventilation: Pristine, Safe Baseline
            tilt = 0.09 + Math.sin(nowMs / 12000) * 0.03;
            vibe = 0.38 + Math.cos(nowMs / 8000) * 0.08;
            disp = 0.14 + Math.sin(nowMs / 11000) * 0.03;
            crack = 0;
            gas = 5.8 + Math.sin(nowMs / 15000) * 0.8;
            water = 0.22;
          } else if (nodeId === 'NODE_05') {
            // ZONE 2 Underground Sump: Dry & Nominal Drainage
            tilt = 0.11 + Math.sin(nowMs / 10000) * 0.03;
            vibe = 0.42 + Math.cos(nowMs / 9000) * 0.08;
            disp = 0.18 + Math.sin(nowMs / 12000) * 0.04;
            crack = 0;
            gas = 5.4 + Math.sin(nowMs / 14000) * 0.6;
            water = 0.32 + Math.sin(nowMs / 8000) * 0.06;
          } else if (nodeId === 'NODE_06') {
            // ZONE 2 Return Airway Bedrock: Completely Stable Strata
            tilt = 0.08 + Math.sin(nowMs / 11000) * 0.02;
            vibe = 0.32 + Math.cos(nowMs / 10000) * 0.06;
            disp = 0.11 + Math.sin(nowMs / 13000) * 0.03;
            crack = 0;
            gas = 5.0 + Math.sin(nowMs / 16000) * 0.5;
            water = 0.20;
          }
        } else {
          // =========================================================================
          // PHASE B: SWAP! ZONE 1 STABILIZED TO NORMAL | ZONE 2 UNDER RISKS & HAZARDS
          // =========================================================================
          if (nodeId === 'NODE_01') {
            // ZONE 1 Hydraulic Supports Bolted & Locked: Completely Stable Baseline
            tilt = 0.12 + Math.sin(nowMs / 11000) * 0.03;
            vibe = 0.44 + Math.cos(nowMs / 8000) * 0.08;
            disp = 0.16 + Math.sin(nowMs / 12000) * 0.04;
            crack = 0;
            gas = 5.6 + Math.sin(nowMs / 15000) * 0.7;
            water = 0.22;
          } else if (nodeId === 'NODE_02') {
            // ZONE 1 Shearer Halted / Maintenance Mode: Zero Machine Vibration
            tilt = 0.14 + Math.sin(nowMs / 9000) * 0.03;
            vibe = 0.50 + Math.cos(nowMs / 7000) * 0.09;
            disp = 0.18 + Math.sin(nowMs / 10000) * 0.04;
            crack = 0;
            gas = 5.8 + Math.sin(nowMs / 14000) * 0.8;
            water = 0.24;
          } else if (nodeId === 'NODE_03') {
            // ZONE 1 Roof Convergence Halted by Hydraulic Cribbing: Stable Strata
            tilt = 0.20 + Math.sin(nowMs / 12000) * 0.04;
            vibe = 0.46 + Math.cos(nowMs / 9000) * 0.08;
            disp = 0.28 + Math.sin(nowMs / 14000) * 0.05;
            crack = 0;
            gas = 6.2 + Math.sin(nowMs / 16000) * 0.8;
            water = 0.26;
          } else if (nodeId === 'NODE_04') {
            // ZONE 2 Tailgate Ventilation Methane Gas Breakthrough (Breaches 25 ppm threshold)
            tilt = 0.15 + ramp * 0.30;
            vibe = 0.50 + ramp * 1.05;
            disp = 0.20 + ramp * 0.60;
            crack = 0;
            gas = Math.round(8.5 + ramp * 31.5);
            water = 0.42;
          } else if (nodeId === 'NODE_05') {
            // ZONE 2 Underground Sump Drainage Water Inrush Flood (Breaches 2.0m threshold)
            tilt = 0.18 + ramp * 0.62;
            vibe = 0.45 + ramp * 1.55;
            disp = 0.22 + ramp * 1.65;
            crack = 0;
            gas = 8.0 + ramp * 3.5;
            water = Number((0.45 + ramp * 3.35).toFixed(2));
          } else if (nodeId === 'NODE_06') {
            // ZONE 2 Fault Slip & Return Airway Subsidence Collapse Precursor!
            // Shear rupture along geological fault plane (RED subsidence_risk badge)
            tilt = 1.15 + ramp * 2.95 + Math.sin(nowMs / 2500) * 0.12;
            vibe = 1.60 + ramp * 4.40;
            disp = 3.2 + ramp * 11.2;
            crack = ramp >= 0.65 ? 1 : 0;
            gas = 7.0 + ramp * 9.5;
            water = 0.75;
          }
        }

        const tiltX = Number((tilt * 0.68 + Math.sin(nowMs / 3000 + nIdx) * 0.15).toFixed(2));
        const tiltY = Number((tilt * 0.55 + Math.cos(nowMs / 3400 + nIdx) * 0.12).toFixed(2));
        // Roof distance in cm: starts around 180cm, decreases as displacement converges
        const distCm = Math.max(5.0, Number((180.0 - disp * 11.5).toFixed(1)));
        const tempC = Number((24.2 + (nodeId === 'NODE_02' ? 6.5 : 0) + (ramp > 0.6 ? 7.8 : 1.2) + Math.sin(nowMs / 9000) * 0.8).toFixed(1));
        const humPct = Math.min(98.0, Math.max(25.0, Number((58.0 + water * 18.0 + Math.cos(nowMs / 8000) * 3.5).toFixed(1))));

        newSimReadings.push(
          {
            nodeId,
            zoneId,
            sensorType: 'tilt',
            value: Math.max(0.05, Number(tilt.toFixed(2))),
            unit: 'degrees',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'tilt_x_deg',
            value: tiltX,
            unit: 'deg',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'tilt_y_deg',
            value: tiltY,
            unit: 'deg',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'vibration',
            value: Math.max(0.1, Number(vibe.toFixed(2))),
            unit: 'mm/s',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'displacement',
            value: Math.max(0.05, Number(disp.toFixed(2))),
            unit: 'mm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'distance',
            value: distCm,
            unit: 'cm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'crack',
            value: crack,
            unit: '',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'gas',
            value: Math.max(2, Math.round(gas)),
            unit: 'ppm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'gas_ppm',
            value: Math.max(2, Math.round(gas)),
            unit: 'ppm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'water',
            value: Math.max(0.1, Number(water.toFixed(2))),
            unit: 'm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'water_level_cm',
            value: Math.max(1, Math.round(water * 100)),
            unit: 'cm',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'temperature',
            value: tempC,
            unit: '°C',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          },
          {
            nodeId,
            zoneId,
            sensorType: 'humidity',
            value: humPct,
            unit: '%',
            timestamp: now,
            sequenceNumber: batchRound * 10 + nIdx,
          }
        );
      });

      // Update Node Statuses (simulating a sequence gap on NODE_06 for testing LoRa reliability)
      setNodeStatuses(prev => {
        const next = { ...prev };
        simNodes.forEach(({ zoneId, nodeId }, nIdx) => {
          if (!next[zoneId]) next[zoneId] = {};
          next[zoneId][nodeId] = {
            nodeId,
            zoneId,
            status: 'online',
            lastSeenAt: now,
            lastSequenceNumber: nodeId === 'NODE_06' ? batchRound * 10 + 4 : batchRound * 10 + nIdx,
            gapCount: nodeId === 'NODE_06' ? 2 : 0,
          };
        });
        return next;
      });

      // Update Readings
      setReadings(prev => {
        const next = { ...prev };
        newSimReadings.forEach(r => {
          if (!next[r.zoneId]) next[r.zoneId] = {};
          if (!next[r.zoneId][r.nodeId]) next[r.zoneId][r.nodeId] = {};
          next[r.zoneId][r.nodeId][r.sensorType] = r;
        });
        return next;
      });

      // Update Live Real-Time ML Predictions for Coal Mine Mesh (Batched atomically)
      const simPredsMap: Record<string, Record<string, ShadowMlPrediction>> = {
        'ZONE_01_LONGWALL_FACE': {},
        'ZONE_02_RETURN_AIRWAY': {},
      };
      const simMlAlerts: SubsidenceAlert[] = [];

      simNodes.forEach(({ zoneId, nodeId }) => {
        let anomaly_class = 'normal';
        let severity = 0.02;
        let alert_level = 'GREEN';
        let class_probs = { normal: 0.98, equipment_noise: 0.01, subsidence_risk: 0.01 };

        if (isPhaseA) {
          if (nodeId === 'NODE_01') {
            anomaly_class = 'normal';
            severity = Number((0.05 + ramp * 0.15).toFixed(2));
            alert_level = 'GREEN';
            class_probs = { normal: 0.90, equipment_noise: 0.08, subsidence_risk: 0.02 };
          } else if (nodeId === 'NODE_02') {
            // Heavy Machinery Cutting Vibration (Filtered by ML as equipment noise)
            anomaly_class = 'equipment_noise';
            severity = Number((0.14 + ramp * 0.14).toFixed(2));
            alert_level = 'YELLOW';
            class_probs = { normal: 0.04, equipment_noise: 0.94, subsidence_risk: 0.02 };
          } else if (nodeId === 'NODE_03') {
            // Imminent Strata Subsidence Precursor (Gradually scales with ramp)
            anomaly_class = ramp >= 0.40 ? 'subsidence_risk' : 'normal';
            severity = Number((0.12 + ramp * 0.81).toFixed(2));
            alert_level = ramp >= 0.65 ? 'RED' : ramp >= 0.40 ? 'ORANGE' : 'YELLOW';
            const riskProb = Number((0.15 + ramp * 0.83).toFixed(2));
            class_probs = {
              normal: Math.max(0.01, Number((0.98 - riskProb).toFixed(2))),
              equipment_noise: 0.01,
              subsidence_risk: Math.min(0.99, riskProb),
            };
          } else {
            // Zone 2 Nodes are nominal
            anomaly_class = 'normal';
            severity = 0.02;
            alert_level = 'GREEN';
            class_probs = { normal: 0.98, equipment_noise: 0.01, subsidence_risk: 0.01 };
          }
        } else {
          // Phase B (Zone 2 in Risk, Zone 1 Normal)
          if (nodeId === 'NODE_04') {
            // Methane Tailgate Safety Threshold Breach
            anomaly_class = 'equipment_noise';
            severity = Number((0.20 + ramp * 0.58).toFixed(2));
            alert_level = ramp >= 0.60 ? 'ORANGE' : 'YELLOW';
            class_probs = { normal: 0.06, equipment_noise: 0.88, subsidence_risk: 0.06 };
          } else if (nodeId === 'NODE_05') {
            // Sump Inrush Flood Hazard
            anomaly_class = 'normal';
            severity = Number((0.15 + ramp * 0.55).toFixed(2));
            alert_level = ramp >= 0.60 ? 'ORANGE' : 'GREEN';
            class_probs = { normal: 0.20, equipment_noise: 0.70, subsidence_risk: 0.10 };
          } else if (nodeId === 'NODE_06') {
            // Fault Slip / Return Airway Subsidence Collapse
            anomaly_class = ramp >= 0.40 ? 'subsidence_risk' : 'normal';
            severity = Number((0.12 + ramp * 0.80).toFixed(2));
            alert_level = ramp >= 0.65 ? 'RED' : ramp >= 0.40 ? 'ORANGE' : 'YELLOW';
            const riskProb = Number((0.15 + ramp * 0.83).toFixed(2));
            class_probs = {
              normal: Math.max(0.01, Number((0.98 - riskProb).toFixed(2))),
              equipment_noise: 0.01,
              subsidence_risk: Math.min(0.99, riskProb),
            };
          } else {
            // Zone 1 Nodes are nominal
            anomaly_class = 'normal';
            severity = 0.02;
            alert_level = 'GREEN';
            class_probs = { normal: 0.98, equipment_noise: 0.01, subsidence_risk: 0.01 };
          }
        }

        const pred: ShadowMlPrediction = {
          predictionId: `sim-pred-${nodeId}`,
          nodeId,
          zoneId,
          timestamp: now,
          anomaly_class,
          class_probs,
          severity,
          alert_level,
          inferenceLatencyMs: 0.72,
          windowLen: 32,
          stride: 4,
          isShadowMode: true,
          model_version: 'baseline_latest.pt',
        };

        simPredsMap[zoneId][nodeId] = pred;

        // Populate deterministic ML alert for active anomalies
        if (alert_level !== 'GREEN' || anomaly_class === 'subsidence_risk' || severity >= 0.2) {
          const isCritical = alert_level === 'RED' || severity >= 0.6;
          const confidencePct = Math.round(
            (class_probs[anomaly_class as keyof typeof class_probs] || 0) * 100
          );
          const severityPct = Math.round(severity * 100);

          simMlAlerts.push({
            id: `alert-ml-${nodeId}`,
            nodeId,
            zoneId,
            sensorType: 'tilt',
            value: severityPct,
            threshold: 20,
            unit: '% severity',
            severity: isCritical ? 'critical' : 'warning',
            timestamp: now,
            message: `[AI/ML Early Warning] ${anomaly_class.replace(/_/g, ' ').toUpperCase()} on ${nodeId} (${confidencePct}% conf, ${severityPct}% sev) [${alert_level}]`,
          });
        }
      });

      // Update ML predictions state once atomically
      setMlPredictions(prev => ({
        ...prev,
        ...simPredsMap,
      }));

      // Generate realistic physical sensor threshold breaches with deterministic IDs
      const simHwAlerts: SubsidenceAlert[] = isPhaseA
        ? [
            {
              id: 'alert-hw-tilt-NODE_03',
              nodeId: 'NODE_03',
              zoneId: 'ZONE_01_LONGWALL_FACE',
              sensorType: 'tilt',
              value: Number((1.20 + ramp * 2.85).toFixed(1)),
              threshold: 2.0,
              unit: 'deg',
              severity: ramp >= 0.65 ? 'critical' : 'warning',
              timestamp: now,
              message: `Main Gate Overburden strata tilt breached stability threshold (${(1.20 + ramp * 2.85).toFixed(1)}° > 2.0°)`,
            },
            {
              id: 'alert-hw-disp-NODE_03',
              nodeId: 'NODE_03',
              zoneId: 'ZONE_01_LONGWALL_FACE',
              sensorType: 'displacement',
              value: Number((3.5 + ramp * 10.8).toFixed(1)),
              threshold: 10.0,
              unit: 'mm',
              severity: ramp >= 0.65 ? 'critical' : 'warning',
              timestamp: now,
              message: `Longwall roof sag convergence rate elevated (${(3.5 + ramp * 10.8).toFixed(1)} mm > 10.0 mm)`,
            },
          ]
        : [
            {
              id: 'alert-hw-gas-NODE_04',
              nodeId: 'NODE_04',
              zoneId: 'ZONE_02_RETURN_AIRWAY',
              sensorType: 'gas',
              value: Math.round(8.5 + ramp * 31.5),
              threshold: 25,
              unit: 'ppm',
              severity: ramp >= 0.60 ? 'critical' : 'warning',
              timestamp: now,
              message: `Methane CH4 buildup in Return Airway exceeded safety threshold (${Math.round(8.5 + ramp * 31.5)} ppm > 25 ppm)`,
            },
            {
              id: 'alert-hw-water-NODE_05',
              nodeId: 'NODE_05',
              zoneId: 'ZONE_02_RETURN_AIRWAY',
              sensorType: 'water',
              value: Number((0.45 + ramp * 3.35).toFixed(1)),
              threshold: 2.0,
              unit: 'm',
              severity: ramp >= 0.60 ? 'warning' : 'warning',
              timestamp: now,
              message: `Underground Sump water depth elevated (${(0.45 + ramp * 3.35).toFixed(1)} m > 2.0 m)`,
            },
            {
              id: 'alert-hw-tilt-NODE_06',
              nodeId: 'NODE_06',
              zoneId: 'ZONE_02_RETURN_AIRWAY',
              sensorType: 'tilt',
              value: Number((1.15 + ramp * 2.95).toFixed(1)),
              threshold: 2.0,
              unit: 'deg',
              severity: ramp >= 0.65 ? 'critical' : 'warning',
              timestamp: now,
              message: `Return Airway fault-line strata tilt breached stability threshold (${(1.15 + ramp * 2.95).toFixed(1)}° > 2.0°)`,
            },
          ];

      // Update Alerts state atomically with stable deterministic IDs
      const activePhaseAlerts = [...simMlAlerts, ...simHwAlerts];
      setAlerts(prev => {
        const realAlerts = prev.filter(a => !a.id.startsWith('alert-'));
        return [...activePhaseAlerts, ...realAlerts];
      });

      // Update Metrics for 4s buffered batch
      const simProtoBytes = newSimReadings.length * 24;
      const simJsonBytes = newSimReadings.length * 155;
      packetCountInWindowRef.current += newSimReadings.length;
      setMetrics(prev => {
        const simLatency = 72;
        return {
          ...prev,
          avgLatency: simLatency,
          maxLatency: Math.max(prev.maxLatency, 125),
          count: prev.count + newSimReadings.length,
          totalLatency: prev.totalLatency + simLatency * newSimReadings.length,
          lastReadingAt: now,
          lastPacketBytes: simProtoBytes,
          lastJsonBytesEquivalent: simJsonBytes,
          protoBytesReceived: (prev.protoBytesReceived || 0) + simProtoBytes,
          estimatedBandwidthSavedPercent: 84,
          transportFormat: 'Protobuf (Binary)',
        };
      });

      batchRound++;
    };

    // Execute immediately on launch so cards appear without waiting
    generateSimBatch();

    // 4s real-time interval for dynamic judging presentation
    const simInterval = setInterval(generateSimBatch, 4000);

    return () => clearInterval(simInterval);
  }, [isSimulationActive]);

  // Periodic Auto-Purge of Old Stale / Ghost Nodes (Every 30s)
  useEffect(() => {
    if (!autoPurgeStale) return;

    const purgeInterval = setInterval(() => {
      const staleThresholdMs = 5 * 60 * 1000; // 5 minutes threshold
      const now = Date.now();

      setNodeStatuses(prev => {
        let changed = false;
        const next: Record<string, Record<string, NodeStatusState>> = {};

        Object.entries(prev).forEach(([zoneId, nodes]) => {
          const validNodes: Record<string, NodeStatusState> = {};
          Object.entries(nodes).forEach(([nodeId, st]) => {
            const lastSeen = st.lastSeenAt ? new Date(st.lastSeenAt).getTime() : 0;
            const isStaleExpired = st.status !== 'online' && now - lastSeen > staleThresholdMs;

            if (isStaleExpired) {
              changed = true;
            } else {
              validNodes[nodeId] = st;
            }
          });
          if (Object.keys(validNodes).length > 0) {
            next[zoneId] = validNodes;
          }
        });

        return changed ? next : prev;
      });
    }, 30000);

    return () => clearInterval(purgeInterval);
  }, [autoPurgeStale]);

  // WebSocket Event Handlers
  useEffect(() => {
    if (!socket) return;

    function handleConnect() {
      setIsConnected(true);
      socket?.emit('get_zones');
      socket?.emit('get_gateway_status');
    }

    function handleDisconnect() {
      setIsConnected(false);
      joinedZonesRef.current.clear();
    }

    function handleActiveZones(zones: string[]) {
      if (!Array.isArray(zones)) return;
      setActiveZones(prev => mergeUniqueZones(prev, zones));

      zones.forEach(zone => {
        if (zone && !joinedZonesRef.current.has(zone)) {
          socket?.emit('join_zone', { zoneId: zone });
          joinedZonesRef.current.add(zone);
        }
      });
    }

    function handleSnapshot(data: SnapshotPayload) {
      if (!data) return;

      const incomingZones: string[] = [];
      data.readings?.forEach(r => { if (r.zoneId) incomingZones.push(r.zoneId); });
      data.statuses?.forEach(st => { if (st.zoneId) incomingZones.push(st.zoneId); });

      if (incomingZones.length > 0) {
        setActiveZones(prev => mergeUniqueZones(prev, incomingZones));
        incomingZones.forEach(zone => {
          if (zone && !joinedZonesRef.current.has(zone)) {
            socket?.emit('join_zone', { zoneId: zone });
            joinedZonesRef.current.add(zone);
          }
        });
      }

      // Identify which nodes in the snapshot are offline
      const offlineKeys = new Set(
        data.statuses
          ?.filter(st => st.status === 'offline')
          .map(st => `${st.zoneId}:${st.nodeId}`) || []
      );

      setReadings(prev => {
        const next = { ...prev };

        // Populate latest sensor readings for all reporting nodes in snapshot
        data.readings?.forEach(r => {
          if (!next[r.zoneId]) next[r.zoneId] = {};
          if (!next[r.zoneId][r.nodeId]) next[r.zoneId][r.nodeId] = {};
          next[r.zoneId][r.nodeId] = {
            ...next[r.zoneId][r.nodeId],
            [r.sensorType]: r,
          };
        });
        return next;
      });

      setNodeStatuses(prev => {
        const next = { ...prev };
        data.statuses?.forEach(st => {
          if (!next[st.zoneId]) next[st.zoneId] = {};
          next[st.zoneId][st.nodeId] = st;
        });
        return next;
      });

      if (Array.isArray(data.mlPredictions)) {
        setMlPredictions(prev => {
          const next = { ...prev };
          data.mlPredictions?.forEach(p => {
            if (p?.zoneId && p?.nodeId) {
              if (!next[p.zoneId]) next[p.zoneId] = {};
              next[p.zoneId][p.nodeId] = p;
            }
          });
          return next;
        });
      }
    }

    function processSensorReadings(updates: ValidatedSensorReading[]) {
      if (!Array.isArray(updates) || updates.length === 0) return;

      const now = Date.now();
      packetCountInWindowRef.current += updates.length;

      const incomingZones = updates.map(r => r.zoneId).filter(Boolean);
      if (incomingZones.length > 0) {
        setActiveZones(prev => mergeUniqueZones(prev, incomingZones));
        incomingZones.forEach(zone => {
          if (zone && !joinedZonesRef.current.has(zone)) {
            socket?.emit('join_zone', { zoneId: zone });
            joinedZonesRef.current.add(zone);
          }
        });
      }

      const newAlerts: SubsidenceAlert[] = [];

      // Update gateway heartbeat when readings arrive
      setGatewayStatus(gw => ({
        ...gw,
        brokerConnected: true,
        loraGatewayConnected: true,
        status: 'online',
        lastLoraPacketAt: new Date().toISOString(),
        totalLoraPackets: gw.totalLoraPackets + updates.length,
      }));

      setReadings(prev => {
        const next = { ...prev };

        updates.forEach(r => {
          if (!next[r.zoneId]) next[r.zoneId] = {};
          if (!next[r.zoneId][r.nodeId])
            next[r.zoneId][r.nodeId] = { ...prev[r.zoneId]?.[r.nodeId] };

          next[r.zoneId][r.nodeId] = {
            ...next[r.zoneId][r.nodeId],
            [r.sensorType]: r,
          };

          // Check threshold alert triggers
          const severity = getSensorSeverity(r.sensorType, r.value);
          if (severity === 'critical' || severity === 'warning') {
            const meta = SENSOR_CONFIGS[r.sensorType];
            newAlerts.push({
              id: `${r.nodeId}-${r.sensorType}-${r.sequenceNumber}-${now}`,
              nodeId: r.nodeId,
              zoneId: r.zoneId,
              sensorType: r.sensorType,
              value: r.value,
              threshold:
                severity === 'critical'
                  ? (meta?.criticalThreshold ?? 0)
                  : (meta?.warningThreshold ?? 0),
              unit: r.unit,
              severity,
              timestamp: r.timestamp || new Date().toISOString(),
              message:
                severity === 'critical'
                  ? `CRITICAL: ${meta?.label || r.sensorType} reached ${r.value} ${r.unit}`
                  : `WARNING: ${meta?.label || r.sensorType} elevated at ${r.value} ${r.unit}`,
            });
          }
        });

        return next;
      });

      setMetrics(prev => {
        let maxL = prev.maxLatency;
        let sumL = prev.totalLatency;
        let count = prev.count;

        updates.forEach(r => {
          const timestamp = new Date(r.timestamp).getTime();
          const latency = isNaN(timestamp) ? 0 : Math.max(0, now - timestamp);

          if (latency > maxL) maxL = latency;
          sumL += latency;
          count++;
        });

        return {
          ...prev,
          maxLatency: maxL,
          totalLatency: sumL,
          count,
          avgLatency: count > 0 ? Math.round(sumL / count) : 0,
          lastReadingAt: new Date().toISOString(),
        };
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 50));
      }
    }

    function processNodeStatuses(updates: NodeStatusState[]) {
      if (!Array.isArray(updates)) return;

      const incomingZones = updates.map(st => st.zoneId).filter(Boolean);
      if (incomingZones.length > 0) {
        setActiveZones(prev => mergeUniqueZones(prev, incomingZones));
        incomingZones.forEach(zone => {
          if (zone && !joinedZonesRef.current.has(zone)) {
            socket?.emit('join_zone', { zoneId: zone });
            joinedZonesRef.current.add(zone);
          }
        });
      }

      setNodeStatuses(prev => {
        const next = { ...prev };
        updates.forEach(st => {
          if (!next[st.zoneId]) next[st.zoneId] = {};
          next[st.zoneId][st.nodeId] = st;
        });
        return next;
      });

      // Retain last known sensor data and shadow predictions so dashboard
      // displays last known state with offline indicator instead of blanking out telemetry.
    }

    // High-performance Binary Protobuf Handlers
    function handleProtoSnapshot(binaryData: unknown) {
      try {
        const decoded = decodeZoneSnapshot(binaryData);
        const approxJson = decoded.readings.length * 155 + decoded.statuses.length * 90;
        handleSnapshot({
          readings: decoded.readings,
          statuses: decoded.statuses,
        });
        setMetrics(prev => ({
          ...prev,
          transportFormat: 'Protobuf (Binary)',
          lastPacketBytes: decoded.rawByteSize,
          lastJsonBytesEquivalent: approxJson,
          protoBytesReceived: (prev.protoBytesReceived || 0) + decoded.rawByteSize,
        }));
      } catch (err) {
        console.error('[Protobuf] Failed to decode snapshot:proto', err);
      }
    }

    function handleProtoReadings(binaryData: unknown) {
      try {
        lastProtoReceivedAtRef.current = Date.now();
        const decoded = decodeSensorReadingBatch(binaryData);
        const approxJsonSize = Math.max(decoded.rawByteSize, decoded.readings.length * 155);
        const savedPct = Math.min(95, Math.max(30, Math.round((1 - decoded.rawByteSize / approxJsonSize) * 100)));

        processSensorReadings(decoded.readings);

        setMetrics(prev => ({
          ...prev,
          transportFormat: 'Protobuf (Binary)',
          lastPacketBytes: decoded.rawByteSize,
          lastJsonBytesEquivalent: approxJsonSize,
          protoBytesReceived: (prev.protoBytesReceived || 0) + decoded.rawByteSize,
          estimatedBandwidthSavedPercent: savedPct,
        }));
      } catch (err) {
        console.error('[Protobuf] Failed to decode readings:proto', err);
      }
    }

    function handleProtoNodeStatuses(binaryData: unknown) {
      try {
        const decoded = decodeNodeStatusBatch(binaryData);
        const approxJson = decoded.statuses.length * 90;
        processNodeStatuses(decoded.statuses);
        setMetrics(prev => ({
          ...prev,
          transportFormat: 'Protobuf (Binary)',
          lastPacketBytes: decoded.rawByteSize,
          lastJsonBytesEquivalent: approxJson,
          protoBytesReceived: (prev.protoBytesReceived || 0) + decoded.rawByteSize,
        }));
      } catch (err) {
        console.error('[Protobuf] Failed to decode nodeStatuses:proto', err);
      }
    }

    // Legacy JSON Handlers (fallback only when Protobuf is inactive)
    function handleReadings(updates: ValidatedSensorReading[]) {
      // If Protobuf binary stream is active, ignore duplicate legacy JSON broadcasts
      if (Date.now() - lastProtoReceivedAtRef.current < 2500) return;
      processSensorReadings(updates);
      setMetrics(prev => ({
        ...prev,
        transportFormat: 'JSON (Text)',
      }));
    }

    function handleNodeStatuses(updates: NodeStatusState[]) {
      if (Date.now() - lastProtoReceivedAtRef.current < 2500) return;
      processNodeStatuses(updates);
    }

    function handleGatewayStatus(status: Partial<GatewayStatus>) {
      if (!status) return;
      setGatewayStatus(prev => ({
        ...prev,
        ...status,
      }));
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('active_zones', handleActiveZones);
    socket.on('gateway:status', handleGatewayStatus);

    // Dedicated ML Shadow Prediction Listener
    socket.on('ml:prediction', dispatchMlPrediction);

    // Primary Protobuf Binary Listeners
    socket.on('snapshot:proto', handleProtoSnapshot);
    socket.on('readings:proto', handleProtoReadings);
    socket.on('nodeStatuses:proto', handleProtoNodeStatuses);

    // Fallback JSON Listeners
    socket.on('snapshot', handleSnapshot);
    socket.on('readings', handleReadings);
    socket.on('nodeStatuses', handleNodeStatuses);

    // Edge Alert Socket Listeners
    socket.on('edge_alert:update', (data: { command: EdgeAlertCommand; state: EdgeNodeActuatorState }) => {
      if (data.state?.nodeId) {
        setEdgeActuatorStates(prev => ({ ...prev, [data.state.nodeId]: data.state }));
      }
    });
    socket.on('edge_alert:ack', (state: EdgeNodeActuatorState) => {
      if (state?.nodeId) {
        setEdgeActuatorStates(prev => ({ ...prev, [state.nodeId]: state }));
      }
    });
    socket.on('edge_alert:state_batch', (states: Record<string, EdgeNodeActuatorState>) => {
      if (states && typeof states === 'object') {
        setEdgeActuatorStates(prev => ({ ...prev, ...states }));
      }
    });

    // Initial check if already connected
    if (socket.connected) {
      handleConnect();
    }

    // Zone polling interval every 2s
    const pollInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('get_zones');
        socket.emit('get_gateway_status');
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('active_zones', handleActiveZones);
      socket.off('gateway:status', handleGatewayStatus);
      socket.off('ml:prediction', dispatchMlPrediction);

      socket.off('snapshot:proto', handleProtoSnapshot);
      socket.off('readings:proto', handleProtoReadings);
      socket.off('nodeStatuses:proto', handleProtoNodeStatuses);

      socket.off('snapshot', handleSnapshot);
      socket.off('readings', handleReadings);
      socket.off('nodeStatuses', handleNodeStatuses);

      socket.off('edge_alert:update');
      socket.off('edge_alert:ack');
      socket.off('edge_alert:state_batch');
    };
  }, [socket, dispatchMlPrediction]);

  const stats = useMemo(() => {
    let totalNodes = 0;
    let onlineNodes = 0;
    let offlineNodes = 0;
    let totalGaps = 0;
    let activeSensorsCount = 0;

    const countedNodes = new Set<string>();

    Object.entries(nodeStatuses).forEach(([zoneId, nodes]) => {
      Object.entries(nodes).forEach(([nodeId, status]) => {
        const key = `${zoneId}:${nodeId}`;
        countedNodes.add(key);
        totalNodes++;
        if (status.status === 'online') {
          onlineNodes++;
        } else {
          offlineNodes++;
        }
        totalGaps += status.gapCount || 0;
      });
    });

    Object.entries(readings).forEach(([zoneId, zoneMap]) => {
      Object.entries(zoneMap).forEach(([nodeId, nodeSensors]) => {
        const key = `${zoneId}:${nodeId}`;
        if (!countedNodes.has(key)) {
          countedNodes.add(key);
          totalNodes++;
          onlineNodes++;
        }
        activeSensorsCount += Object.keys(nodeSensors).length;
      });
    });

    const allZones = new Set([
      ...activeZones,
      ...Object.keys(readings),
      ...Object.keys(nodeStatuses),
    ]);

    return {
      totalZones: allZones.size,
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalGaps,
      activeSensorsCount,
    };
  }, [nodeStatuses, readings, activeZones]);

  const reconnect = useCallback(() => {
    if (socket) {
      joinedZonesRef.current.clear();
      socket.disconnect();
      socket.connect();
    }
  }, [socket]);

  const joinZone = useCallback(
    (zoneId: string) => {
      if (socket && zoneId && !joinedZonesRef.current.has(zoneId)) {
        socket.emit('join_zone', { zoneId });
        joinedZonesRef.current.add(zoneId);
      }
    },
    [socket]
  );

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Clear Cache Logic: Purges stale/old dashboard data so user always sees live stream
  const clearCache = useCallback((options?: { purgeOfflineOnly?: boolean }) => {
    if (options?.purgeOfflineOnly) {
      // Purge only offline or stale nodes from cache
      setNodeStatuses(prev => {
        const next: Record<string, Record<string, NodeStatusState>> = {};
        Object.entries(prev).forEach(([zoneId, nodes]) => {
          const liveNodes: Record<string, NodeStatusState> = {};
          Object.entries(nodes).forEach(([nodeId, st]) => {
            if (st.status === 'online') {
              liveNodes[nodeId] = st;
            }
          });
          if (Object.keys(liveNodes).length > 0) {
            next[zoneId] = liveNodes;
          }
        });
        return next;
      });

      setReadings(prev => {
        const next: Record<string, Record<string, Record<string, ValidatedSensorReading>>> = {};
        Object.entries(prev).forEach(([zoneId, nodes]) => {
          const liveNodes: Record<string, Record<string, ValidatedSensorReading>> = {};
          Object.entries(nodes).forEach(([nodeId, sensors]) => {
            const st = nodeStatuses[zoneId]?.[nodeId];
            if (st?.status === 'online') {
              liveNodes[nodeId] = sensors;
            }
          });
          if (Object.keys(liveNodes).length > 0) {
            next[zoneId] = liveNodes;
          }
        });
        return next;
      });
    } else {
      // Complete Cache Purge: Reset all memory buffers
      setReadings({});
      setNodeStatuses({});
      setAlerts([]);
      setMetrics({
        avgLatency: 0,
        maxLatency: 0,
        count: 0,
        totalLatency: 0,
        packetsPerSec: 0,
      });
      setIsSimulationActive(false);

      // Re-fetch only currently live active rooms from server
      if (socket && socket.connected) {
        socket.emit('get_zones');
      }
    }
  }, [socket, nodeStatuses]);

  // Edge Alert Dispatch via Socket.IO (with local simulation fallback)
  const dispatchEdgeAlert = useCallback(
    (params: { nodeId: string; zoneId: string; level: EdgeAlertLevel; message?: string }) => {
      const config = EDGE_ALERT_CONFIGS[params.level];
      const commandId = `sos-${params.nodeId}-${Date.now()}`;
      const now = new Date().toISOString();

      // Local state update (optimistic)
      const state: EdgeNodeActuatorState = {
        nodeId: params.nodeId,
        zoneId: params.zoneId,
        level: params.level,
        color: config.color,
        buzzer: config.buzzer,
        buzzerMode: config.buzzerMode,
        ledPattern: config.ledPattern,
        lastCommandId: commandId,
        lastUpdatedAt: now,
        acknowledged: false,
      };
      setEdgeActuatorStates(prev => ({ ...prev, [params.nodeId]: state }));

      // Voice announcement
      const cleanNode = params.nodeId.replace(/_/g, ' ');
      const levelLabels: Record<EdgeAlertLevel, string> = {
        CRITICAL: 'Critical emergency',
        WARNING: 'Warning alert',
        ADVISORY: 'Advisory notification',
        NORMAL: 'All clear status',
      };
      const speechText = `${levelLabels[params.level]} dispatched to ${cleanNode}. ${config.buzzer ? `Buzzer ${config.buzzerMode} activated.` : 'Buzzer off.'} LED ${config.color} ${config.ledPattern}.`;
      voiceAlertService.speak(speechText, {
        type: params.level === 'CRITICAL' ? 'critical' : 'warning',
        force: true,
        onStart: () => {
          setIsSpeaking(true);
          setLastSpokenMessage(speechText);
        },
        onEnd: () => {
          setIsSpeaking(false);
        },
      });

      // Send via Socket.IO to backend (which publishes MQTT downlink)
      if (socket?.connected) {
        socket.emit('dispatch_edge_alert', {
          nodeId: params.nodeId,
          zoneId: params.zoneId,
          level: params.level,
          message: params.message || `${params.level} SOS dispatched by operator`,
          targetType: 'node',
        });
      }

      // Simulate ACK after 1.5s in simulation mode
      if (isSimulationActive || !socket?.connected) {
        setTimeout(() => {
          setEdgeActuatorStates(prev => {
            const existing = prev[params.nodeId];
            if (!existing || existing.lastCommandId !== commandId) return prev;
            return {
              ...prev,
              [params.nodeId]: { ...existing, acknowledged: true, lastUpdatedAt: new Date().toISOString() },
            };
          });
        }, 1500);
      }
    },
    [socket, isSimulationActive],
  );

  const toggleSimulation = useCallback(() => {
    setIsSimulationActive(prev => {
      const next = !prev;
      if (next) {
        // Reset cache so 2 deep seam zones and 6 nodes render with zero leftover state
        setReadings({});
        setNodeStatuses({});
        setMlPredictions({});
        setAlerts([]);
        setActiveZones(['ZONE_01_LONGWALL_FACE', 'ZONE_02_RETURN_AIRWAY']);
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      gatewayStatus,
      activeZones,
      readings,
      nodeStatuses,
      mlPredictions,
      metrics,
      alerts,
      stats,
      reconnect,
      joinZone,
      clearAlerts,
      clearCache,
      isSimulationActive,
      toggleSimulation,
      triggerDemoMlEvent,
      autoPurgeStale,
      setAutoPurgeStale,
      voiceAlertsEnabled,
      toggleVoiceAlerts,
      testVoiceAlert,
      isSpeaking,
      lastSpokenMessage,
      edgeActuatorStates,
      dispatchEdgeAlert,
    }),
    [
      socket,
      isConnected,
      gatewayStatus,
      activeZones,
      readings,
      nodeStatuses,
      mlPredictions,
      metrics,
      alerts,
      stats,
      reconnect,
      joinZone,
      clearAlerts,
      clearCache,
      isSimulationActive,
      toggleSimulation,
      triggerDemoMlEvent,
      autoPurgeStale,
      setAutoPurgeStale,
      voiceAlertsEnabled,
      toggleVoiceAlerts,
      testVoiceAlert,
      isSpeaking,
      lastSpokenMessage,
      edgeActuatorStates,
      dispatchEdgeAlert,
    ]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
