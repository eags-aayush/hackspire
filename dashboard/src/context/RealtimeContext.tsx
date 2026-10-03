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
import { downloadIncidentPdf, type IncidentReportData } from '@/lib/reports/generateIncidentPdf';

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

export interface LivePortData {
  temp: number | null;
  hum: number | null;
  mq4: number | null;
  mq135: number | null;
  water: number | null;
  ml: number | null;
  distCm: number | null;
  ax: number | null;
  ay: number | null;
  az: number | null;
  nodeId: string;
  lastPacketTime: string | null;
  rawFrame: string | null;
}

export interface LivePortPeaks {
  temp: number;
  hum: number;
  mq4: number;
  mq135: number;
  water: number;
  ml: number;
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
  // Serial Port Telemetry Link
  isSerialSupported: boolean;
  isSerialConnected: boolean;
  connectSerialPort: (baudRate?: number) => Promise<boolean>;
  disconnectSerialPort: () => Promise<void>;
  livePortData: LivePortData | null;
  livePortPeaks: LivePortPeaks;
  // Emergency SOS Alarm Auto-Activation & Incident PDF Reporting
  isSosAlarmActive: boolean;
  sosAlarmReason: string | null;
  triggerSosAlarm: (
    reason: string,
    telemetrySnapshot?: Partial<IncidentReportData['telemetry']>,
    meta?: { nodeId?: string; zoneId?: string }
  ) => void;
  silenceSosAlarm: () => void;
  lastIncidentReport: IncidentReportData | null;
  downloadLatestIncidentPdf: () => void;
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

  // Serial Port Telemetry Link State (Web Serial API for ESP32/Arduino)
  const isSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [livePortData, setLivePortData] = useState<LivePortData | null>(null);
  const [livePortPeaks, setLivePortPeaks] = useState<LivePortPeaks>({
    temp: 0,
    hum: 0,
    mq4: 0,
    mq135: 0,
    water: 500,
    ml: 0,
  });
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);

  // Automatic Emergency SOS Alarm State & Cooldown
  const [isSosAlarmActive, setIsSosAlarmActive] = useState(false);
  const [sosAlarmReason, setSosAlarmReason] = useState<string | null>(null);
  const [lastIncidentReport, setLastIncidentReport] = useState<IncidentReportData | null>(null);
  const isSosSilencedByUserRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPdfDownloadTimeRef = useRef<number>(0);
  const prevPortDataRef = useRef<LivePortData | null>(null);

  const triggerSosAlarm = useCallback((
    reason: string,
    telemetrySnapshot?: Partial<IncidentReportData['telemetry']>,
    meta?: { nodeId?: string; zoneId?: string }
  ) => {
    if (isSosSilencedByUserRef.current) return;
    setIsSosAlarmActive(true);
    setSosAlarmReason(reason);

    // Announce emergency alert via speech synthesis
    voiceAlertService.speak(`Emergency Alert. ${reason}. Evacuate sector immediately.`, {
      type: 'critical',
      force: true,
      onStart: () => {
        setIsSpeaking(true);
        setLastSpokenMessage(`EMERGENCY SOS: ${reason}`);
      },
      onEnd: () => {
        setIsSpeaking(false);
      },
    });

    // Assemble comprehensive incident report capturing all values after detection
    const activePort = prevPortDataRef.current;
    const reportData: IncidentReportData = {
      incidentId: `DGMS-INC-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      reason,
      nodeId: meta?.nodeId || activePort?.nodeId || 'NODE_01',
      zoneId: meta?.zoneId || 'ZONE_01_LONGWALL_FACE',
      severity: 'CRITICAL',
      telemetry: {
        temp: telemetrySnapshot?.temp ?? activePort?.temp ?? null,
        hum: telemetrySnapshot?.hum ?? activePort?.hum ?? null,
        mq4: telemetrySnapshot?.mq4 ?? activePort?.mq4 ?? null,
        mq135: telemetrySnapshot?.mq135 ?? activePort?.mq135 ?? null,
        water: telemetrySnapshot?.water ?? activePort?.water ?? null,
        ml: telemetrySnapshot?.ml ?? activePort?.ml ?? null,
        tilt: telemetrySnapshot?.tilt ?? (activePort ? +(Math.sqrt((activePort.ax || 0)**2 + (activePort.ay || 0)**2) * 5.73).toFixed(2) : null),
        ax: telemetrySnapshot?.ax ?? activePort?.ax ?? null,
        ay: telemetrySnapshot?.ay ?? activePort?.ay ?? null,
        az: telemetrySnapshot?.az ?? activePort?.az ?? null,
      },
    };

    setLastIncidentReport(reportData);

    // AUTOMATIC SYSTEM REPORT PDF DOWNLOAD (throttled to avoid rapid multiple downloads)
    const now = Date.now();
    if (now - lastPdfDownloadTimeRef.current > 4000) {
      lastPdfDownloadTimeRef.current = now;
      try {
        downloadIncidentPdf(reportData);
      } catch (err) {
        console.error('Failed to trigger automatic incident PDF download:', err);
      }
    }
  }, []);

  const silenceSosAlarm = useCallback(() => {
    setIsSosAlarmActive(false);
    setSosAlarmReason(null);
    isSosSilencedByUserRef.current = true;
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
    // Allow re-arming after 20 seconds so subsequent hazards still alert
    silenceTimeoutRef.current = setTimeout(() => {
      isSosSilencedByUserRef.current = false;
    }, 20000);
  }, []);

  const downloadLatestIncidentPdf = useCallback(() => {
    if (lastIncidentReport) {
      downloadIncidentPdf(lastIncidentReport);
    } else {
      const activePort = prevPortDataRef.current;
      const onDemandReport: IncidentReportData = {
        incidentId: `DGMS-RPT-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        reason: sosAlarmReason || 'Manual Geotechnical Audit Report',
        nodeId: activePort?.nodeId || 'NODE_01',
        zoneId: 'ZONE_01_LONGWALL_FACE',
        severity: isSosAlarmActive ? 'CRITICAL' : 'WARNING',
        telemetry: {
          temp: activePort?.temp ?? null,
          hum: activePort?.hum ?? null,
          mq4: activePort?.mq4 ?? null,
          mq135: activePort?.mq135 ?? null,
          water: activePort?.water ?? null,
          ml: activePort?.ml ?? null,
          tilt: activePort ? +(Math.sqrt((activePort.ax || 0) ** 2 + (activePort.ay || 0) ** 2) * 5.73).toFixed(2) : null,
          ax: activePort?.ax ?? null,
          ay: activePort?.ay ?? null,
          az: activePort?.az ?? null,
        },
      };
      downloadIncidentPdf(onDemandReport);
    }
  }, [lastIncidentReport, sosAlarmReason, isSosAlarmActive]);

  // Process incoming JSON or structured telemetry payload from serial port
  const processPortPayload = useCallback((parsed: any, raw: string) => {
    const t = parseFloat(parsed.temp ?? parsed.temperature);
    const h = parseFloat(parsed.hum ?? parsed.humidity);
    const m4 = parseFloat(parsed.mq4 ?? parsed.mq6 ?? parsed.mq6_raw ?? parsed.gas);
    const m135 = parseFloat(parsed.mq135 ?? parsed.co ?? parsed.co2);
    const w = parseFloat(parsed.water ?? parsed.water_raw ?? parsed.dist_cm ?? parsed.distance);
    const ml = parseFloat(parsed.ml ?? parsed.seismic ?? parsed.magnitude) || 0.1;
    const ax = parseFloat(parsed.ax) || 0;
    const ay = parseFloat(parsed.ay) || 0;
    const az = parseFloat(parsed.az) || 1;
    const nodeId = parsed.id || parsed.nodeId || parsed.device || 'NODE_01';
    const nowIso = new Date().toISOString();

    const newPortData: LivePortData = {
      temp: !Number.isNaN(t) ? t : null,
      hum: !Number.isNaN(h) ? h : null,
      mq4: !Number.isNaN(m4) ? m4 : null,
      mq135: !Number.isNaN(m135) ? m135 : null,
      water: !Number.isNaN(w) ? w : null,
      ml: !Number.isNaN(ml) ? ml : null,
      distCm: !Number.isNaN(w) ? w : null,
      ax,
      ay,
      az,
      nodeId,
      lastPacketTime: nowIso,
      rawFrame: raw,
    };

    setLivePortData(newPortData);

    const fireSos = (reason: string) => {
      triggerSosAlarm(
        reason,
        {
          temp: newPortData.temp,
          hum: newPortData.hum,
          mq4: newPortData.mq4,
          mq135: newPortData.mq135,
          water: newPortData.water,
          ml: newPortData.ml,
          tilt: +(Math.sqrt(ax * ax + ay * ay) * 5.73).toFixed(2),
          ax,
          ay,
          az,
        },
        { nodeId, zoneId: 'ZONE_01_LONGWALL_FACE' }
      );
    };

    // Automatic SOS Alarm Activation upon Sudden Changes or Critical Threshold Breaches
    const prevPort = prevPortDataRef.current;
    if (prevPort) {
      // 1. Methane (MQ-4) Sudden Spike or Extreme Level
      if (newPortData.mq4 != null && prevPort.mq4 != null) {
        const deltaMq4 = newPortData.mq4 - prevPort.mq4;
        if (deltaMq4 >= 250) {
          fireSos(`Sudden Methane (CH₄) surge detected: +${Math.round(deltaMq4)} ppm (now ${Math.round(newPortData.mq4)} ppm)`);
        } else if (newPortData.mq4 >= 2800) {
          fireSos(`Critical Methane (CH₄) explosive threshold reached: ${Math.round(newPortData.mq4)} ppm`);
        }
      } else if (newPortData.mq4 != null && newPortData.mq4 >= 2800) {
        fireSos(`Critical Methane (CH₄) explosive threshold reached: ${Math.round(newPortData.mq4)} ppm`);
      }

      // 2. Toxic Gas / CO (MQ-135) Sudden Surge or Extreme Level
      if (newPortData.mq135 != null && prevPort.mq135 != null) {
        const deltaMq135 = newPortData.mq135 - prevPort.mq135;
        if (deltaMq135 >= 180) {
          fireSos(`Sudden Toxic Gas (CO/CO₂) surge detected: +${Math.round(deltaMq135)} ppm (now ${Math.round(newPortData.mq135)} ppm)`);
        } else if (newPortData.mq135 >= 1800) {
          fireSos(`Critical Toxic Gas threshold breached: ${Math.round(newPortData.mq135)} ppm`);
        }
      } else if (newPortData.mq135 != null && newPortData.mq135 >= 1800) {
        fireSos(`Critical Toxic Gas threshold breached: ${Math.round(newPortData.mq135)} ppm`);
      }

      // 3. Ambient Temperature Sudden Spike or Extreme Heat
      if (newPortData.temp != null && prevPort.temp != null) {
        const deltaTemp = newPortData.temp - prevPort.temp;
        if (deltaTemp >= 3.0) {
          fireSos(`Rapid thermal spike detected: +${deltaTemp.toFixed(1)}°C jump (now ${newPortData.temp.toFixed(1)}°C)`);
        } else if (newPortData.temp >= 46.0) {
          fireSos(`Extreme ambient heat threshold reached: ${newPortData.temp.toFixed(1)}°C`);
        }
      } else if (newPortData.temp != null && newPortData.temp >= 46.0) {
        fireSos(`Extreme ambient heat threshold reached: ${newPortData.temp.toFixed(1)}°C`);
      }

      // 4. Water Level Inrush Sudden Change
      if (newPortData.water != null && prevPort.water != null) {
        const deltaWater = Math.abs(newPortData.water - prevPort.water);
        if (deltaWater >= 20.0) {
          fireSos(`Sudden water level displacement detected: Δ${deltaWater.toFixed(1)} cm (level: ${newPortData.water.toFixed(1)} cm)`);
        } else if (newPortData.water < 25.0) {
          fireSos(`Critical water inrush / flood proximity alert: ${newPortData.water.toFixed(1)} cm clearance`);
        }
      } else if (newPortData.water != null && newPortData.water < 25.0) {
        fireSos(`Critical water inrush / flood proximity alert: ${newPortData.water.toFixed(1)} cm clearance`);
      }

      // 5. Sudden Seismic Acceleration Jump
      if (newPortData.ml != null && prevPort.ml != null) {
        const deltaMl = newPortData.ml - prevPort.ml;
        if (deltaMl >= 0.35) {
          fireSos(`Sudden seismic tremor acceleration detected: +${deltaMl.toFixed(2)} ML (now ${newPortData.ml.toFixed(2)} ML)`);
        } else if (newPortData.ml >= 1.2) {
          fireSos(`High-magnitude seismic vibration detected: ${newPortData.ml.toFixed(2)} ML`);
        }
      } else if (newPortData.ml != null && newPortData.ml >= 1.2) {
        fireSos(`High-magnitude seismic vibration detected: ${newPortData.ml.toFixed(2)} ML`);
      }

      // 6. Sudden Strata Tilt / Accelerometer Shift
      const prevTilt = Math.sqrt((prevPort.ax || 0) ** 2 + (prevPort.ay || 0) ** 2) * 5.73;
      const currTilt = Math.sqrt(ax * ax + ay * ay) * 5.73;
      const deltaTilt = Math.abs(currTilt - prevTilt);
      if (deltaTilt >= 1.5) {
        fireSos(`Sudden strata shear tilt displacement: Δ${deltaTilt.toFixed(1)}° shift`);
      }
    } else {
      // First incoming reading critical safety checks
      if (newPortData.mq4 != null && newPortData.mq4 >= 2800) {
        fireSos(`Critical Methane (CH₄) explosive threshold reached: ${Math.round(newPortData.mq4)} ppm`);
      } else if (newPortData.mq135 != null && newPortData.mq135 >= 1800) {
        fireSos(`Critical Toxic Gas threshold breached: ${Math.round(newPortData.mq135)} ppm`);
      } else if (newPortData.temp != null && newPortData.temp >= 46.0) {
        fireSos(`Extreme ambient heat threshold reached: ${newPortData.temp.toFixed(1)}°C`);
      } else if (newPortData.water != null && newPortData.water < 25.0) {
        fireSos(`Critical water inrush / flood proximity alert: ${newPortData.water.toFixed(1)} cm clearance`);
      } else if (newPortData.ml != null && newPortData.ml >= 1.2) {
        fireSos(`High-magnitude seismic vibration detected: ${newPortData.ml.toFixed(2)} ML`);
      }
    }

    prevPortDataRef.current = newPortData;

    // Update real-time peak readings
    setLivePortPeaks(prev => ({
      temp: !Number.isNaN(t) ? Math.max(prev.temp, t) : prev.temp,
      hum: !Number.isNaN(h) ? Math.max(prev.hum, h) : prev.hum,
      mq4: !Number.isNaN(m4) ? Math.max(prev.mq4, m4) : prev.mq4,
      mq135: !Number.isNaN(m135) ? Math.max(prev.mq135, m135) : prev.mq135,
      water: !Number.isNaN(w) ? Math.min(prev.water, w) : prev.water,
      ml: !Number.isNaN(ml) ? Math.max(prev.ml, ml) : prev.ml,
    }));

    // Ingest into readings and nodeStatuses so whole dashboard updates in real time!
    const zoneId = 'ZONE_01_LONGWALL_FACE';
    setActiveZones(prev => (prev.includes(zoneId) ? prev : [...prev, zoneId]));

    setNodeStatuses(prev => ({
      ...prev,
      [zoneId]: {
        ...(prev[zoneId] || {}),
        [nodeId]: {
          nodeId,
          zoneId,
          status: 'online',
          lastSeenAt: nowIso,
          lastSequenceNumber: Date.now() % 100000,
          gapCount: 0,
        },
      },
    }));

    setReadings(prev => {
      const zoneReads = prev[zoneId] || {};
      const nodeReads = zoneReads[nodeId] || {};
      const updatedNodeReads = { ...nodeReads };

      if (!Number.isNaN(t)) {
        updatedNodeReads.temperature = {
          nodeId,
          zoneId,
          sensorType: 'temperature',
          value: t,
          unit: '°C',
          timestamp: nowIso,
        };
      }
      if (!Number.isNaN(h)) {
        updatedNodeReads.humidity = {
          nodeId,
          zoneId,
          sensorType: 'humidity',
          value: h,
          unit: '%',
          timestamp: nowIso,
        };
      }
      if (!Number.isNaN(m4)) {
        updatedNodeReads.gas = {
          nodeId,
          zoneId,
          sensorType: 'gas',
          value: m4,
          unit: 'ppm',
          timestamp: nowIso,
        };
      }
      if (!Number.isNaN(w)) {
        updatedNodeReads.water = {
          nodeId,
          zoneId,
          sensorType: 'water',
          value: w,
          unit: 'cm',
          timestamp: nowIso,
        };
        updatedNodeReads.displacement = {
          nodeId,
          zoneId,
          sensorType: 'displacement',
          value: w,
          unit: 'cm',
          timestamp: nowIso,
        };
      }
      const tiltVal = +(Math.sqrt(ax * ax + ay * ay) * 5.73).toFixed(2);
      updatedNodeReads.tilt = {
        nodeId,
        zoneId,
        sensorType: 'tilt',
        value: tiltVal,
        unit: '°',
        timestamp: nowIso,
      };

      return {
        ...prev,
        [zoneId]: {
          ...zoneReads,
          [nodeId]: updatedNodeReads,
        },
      };
    });
  }, [triggerSosAlarm]);

  // Process text lines (e.g. from Arduino/ESP32 Serial.printf lines)
  const processPortLine = useCallback((line: string) => {
    const tempMatch = line.match(/Temp:\s*([\d.]+)/i);
    const humMatch = line.match(/Hum:\s*([\d.]+)/i);
    const distMatch = line.match(/Distance:\s*([\d.]+)/i);
    const mqMatch = line.match(/MQ\d*\s*raw:\s*([\d.]+)/i) || line.match(/Gas:\s*([\d.]+)/i);
    const waterMatch = line.match(/Water\s*raw:\s*([\d.]+)/i);
    const devMatch = line.match(/Device:\s*([A-Za-z0-9_-]+)/i);

    if (tempMatch || humMatch || distMatch || mqMatch) {
      const payload: any = {};
      if (tempMatch) payload.temp = parseFloat(tempMatch[1]);
      if (humMatch) payload.hum = parseFloat(humMatch[1]);
      if (distMatch) payload.dist_cm = parseFloat(distMatch[1]);
      if (mqMatch) payload.mq4 = parseFloat(mqMatch[1]);
      if (waterMatch) payload.water = parseFloat(waterMatch[1]);
      if (devMatch) payload.id = devMatch[1];
      processPortPayload(payload, line);
      return;
    }

    // CSV format: NODE_01,34.5,62.0,1200,450,140
    if (line.includes(',')) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 3 && !Number.isNaN(parseFloat(parts[1]))) {
        processPortPayload(
          {
            id: parts[0],
            temp: parseFloat(parts[1]),
            hum: parseFloat(parts[2]),
            mq4: parts[3] ? parseFloat(parts[3]) : undefined,
            water: parts[4] ? parseFloat(parts[4]) : undefined,
          },
          line
        );
      }
    }
  }, [processPortPayload]);

  // Connect Web Serial Port (baud: 115200 or 9600)
  const connectSerialPort = useCallback(async (baudRate = 115200) => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or a Chromium-based browser to connect directly via USB.');
      return false;
    }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });
      serialPortRef.current = port;
      setIsSerialConnected(true);

      const textDecoder = new (window as any).TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      // Start asynchronous read loop
      (async () => {
        let buffer = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              buffer += value;
              // Check for JSON: {...}
              let s = buffer.indexOf('{');
              let e = buffer.indexOf('}');
              while (s !== -1 && e !== -1 && e > s) {
                const jsonChunk = buffer.substring(s, e + 1);
                try {
                  const parsed = JSON.parse(jsonChunk);
                  processPortPayload(parsed, jsonChunk);
                } catch {}
                buffer = buffer.substring(e + 1);
                s = buffer.indexOf('{');
                e = buffer.indexOf('}');
              }

              // Check for lines
              const lines = buffer.split('\n');
              if (lines.length > 1) {
                buffer = lines.pop() || '';
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (trimmed) {
                    processPortLine(trimmed);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('Serial reader loop ended:', err);
        } finally {
          setIsSerialConnected(false);
          serialPortRef.current = null;
          serialReaderRef.current = null;
        }
      })();

      return true;
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.error('Serial connection error:', err);
      }
      setIsSerialConnected(false);
      return false;
    }
  }, [processPortPayload, processPortLine]);

  // Disconnect Web Serial Port
  const disconnectSerialPort = useCallback(async () => {
    try {
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel();
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close();
      }
    } catch (e) {
      console.warn('Error closing port:', e);
    } finally {
      serialReaderRef.current = null;
      serialPortRef.current = null;
      setIsSerialConnected(false);
      setLivePortData(null);
    }
  }, []);

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

          // Automatic SOS Alarm Activation upon Sudden Changes or Critical Threshold Breaches
          const prevReading = prev[r.zoneId]?.[r.nodeId]?.[r.sensorType];
          const nodeSnap = {
            temp: r.sensorType === 'temperature' ? r.value : prev[r.zoneId]?.[r.nodeId]?.temperature?.value ?? null,
            hum: r.sensorType === 'humidity' ? r.value : prev[r.zoneId]?.[r.nodeId]?.humidity?.value ?? null,
            mq4: (r.sensorType === 'gas' || r.sensorType === 'ch4') ? r.value : prev[r.zoneId]?.[r.nodeId]?.gas?.value ?? null,
            mq135: r.sensorType === 'co' ? r.value : null,
            water: (r.sensorType === 'water' || r.sensorType === 'displacement') ? r.value : prev[r.zoneId]?.[r.nodeId]?.water?.value ?? null,
            ml: r.sensorType === 'seismic' ? r.value : null,
            tilt: r.sensorType === 'tilt' ? r.value : prev[r.zoneId]?.[r.nodeId]?.tilt?.value ?? null,
            ax: null,
            ay: null,
            az: null,
          };
          const nodeMeta = { nodeId: r.nodeId, zoneId: r.zoneId };

          if (prevReading && prevReading.value != null && r.value != null) {
            const diff = r.value - prevReading.value;
            const absDiff = Math.abs(diff);

            if ((r.sensorType === 'gas' || r.sensorType === 'ch4') && (diff >= 250 || r.value >= 2800)) {
              triggerSosAlarm(`Sudden gas surge at ${r.nodeId}: ${r.value} ${r.unit} (+${Math.round(diff)})`, nodeSnap, nodeMeta);
            } else if (r.sensorType === 'temperature' && (diff >= 3.0 || r.value >= 46)) {
              triggerSosAlarm(`Sudden temperature jump at ${r.nodeId}: ${r.value} °C (+${diff.toFixed(1)} °C)`, nodeSnap, nodeMeta);
            } else if ((r.sensorType === 'water' || r.sensorType === 'displacement') && (absDiff >= 20 || r.value < 25)) {
              triggerSosAlarm(`Sudden water level displacement at ${r.nodeId}: ${r.value} ${r.unit}`, nodeSnap, nodeMeta);
            } else if (r.sensorType === 'tilt' && absDiff >= 1.5) {
              triggerSosAlarm(`Sudden strata tilt shift at ${r.nodeId}: Δ${absDiff.toFixed(1)}°`, nodeSnap, nodeMeta);
            } else if (r.sensorType === 'seismic' && (diff >= 0.35 || r.value >= 1.2)) {
              triggerSosAlarm(`Sudden seismic tremor at ${r.nodeId}: ${r.value} ML`, nodeSnap, nodeMeta);
            }
          } else if (severity === 'critical') {
            triggerSosAlarm(`Critical emergency reading at ${r.nodeId}: ${r.sensorType} reached ${r.value} ${r.unit}`, nodeSnap, nodeMeta);
          }

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
        const decoded = decodeZoneSnapshot(binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData as ArrayBuffer));
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
        const decoded = decodeSensorReadingBatch(binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData as ArrayBuffer));
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
        const decoded = decodeNodeStatusBatch(binaryData instanceof Uint8Array ? binaryData : new Uint8Array(binaryData as ArrayBuffer));
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
      const elapsed = status.lastLoraPacketAt
        ? Date.now() - new Date(status.lastLoraPacketAt).getTime()
        : null;
      const isStale = elapsed !== null && elapsed > 25000;

      setGatewayStatus(prev => ({
        ...prev,
        ...status,
        loraGatewayConnected: isStale ? false : Boolean(status.loraGatewayConnected ?? prev.loraGatewayConnected),
        status: isStale ? 'offline' : (status.status ?? prev.status),
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
  }, [socket, dispatchMlPrediction, triggerSosAlarm]);

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
      isSerialSupported,
      isSerialConnected,
      connectSerialPort,
      disconnectSerialPort,
      livePortData,
      livePortPeaks,
      isSosAlarmActive,
      sosAlarmReason,
      triggerSosAlarm,
      silenceSosAlarm,
      lastIncidentReport,
      downloadLatestIncidentPdf,
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
      isSerialSupported,
      isSerialConnected,
      connectSerialPort,
      disconnectSerialPort,
      livePortData,
      livePortPeaks,
      isSosAlarmActive,
      sosAlarmReason,
      triggerSosAlarm,
      silenceSosAlarm,
      lastIncidentReport,
      downloadLatestIncidentPdf,
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
