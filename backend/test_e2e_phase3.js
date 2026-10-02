import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import mqtt from 'mqtt';
import { io } from 'socket.io-client';

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1884';
const backendWsUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000';

console.log('=== Phase 3 End-to-End Verification Test ===');
console.log(`Connecting to MQTT Broker: ${brokerUrl}`);
console.log(`Connecting to Backend Socket.IO: ${backendWsUrl}`);

const mqttClient = mqtt.connect(brokerUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: 'e2e-tester-phase3',
  clean: true,
  connectTimeout: 5000,
});

const socket = io(backendWsUrl, {
  transports: ['websocket'],
  timeout: 5000,
});

let predictionsReceived = 0;
let readingsReceived = 0;
const recordedLatencies = [];

socket.on('connect', () => {
  console.log(`[Dashboard Socket] Connected to Backend (socket id: ${socket.id})`);
  socket.emit('join_zone', { zoneId: 'ZONE_1' });
});

socket.on('readings', (data) => {
  readingsReceived += Array.isArray(data) ? data.length : 1;
});

socket.on('ml:prediction', (pred) => {
  predictionsReceived++;
  recordedLatencies.push(pred.inferenceLatencyMs);
  console.log(`\n[Dashboard ML Shadow Channel] Received Prediction #${predictionsReceived}:`);
  console.log(`  -> Node: ${pred.nodeId} | Zone: ${pred.zoneId}`);
  console.log(`  -> Class: ${pred.anomaly_class} (${(pred.class_probs[pred.anomaly_class] * 100).toFixed(1)}%)`);
  console.log(`  -> Severity: ${pred.severity} | Shadow Alert Level: ${pred.alert_level}`);
  console.log(`  -> Latency: ${pred.inferenceLatencyMs} ms`);
  console.log(`  -> Shadow Mode: ${pred.isShadowMode} (Informational only)`);
});

mqttClient.on('connect', async () => {
  console.log('[MQTT] Connected to Mosquitto broker');

  const zoneId = 'ZONE_1';
  const nodeId = 'NODE_01';

  // Publish node online status
  mqttClient.publish(
    `mine/${zoneId}/${nodeId}/status`,
    JSON.stringify({ nodeId, zoneId, status: 'online', timestamp: new Date().toISOString() }),
    { qos: 1 },
  );

  console.log('\n--- Step 1: Streaming 35 Readings (Window Fill -> Prediction) ---');

  for (let seq = 1; seq <= 35; seq++) {
    const isAnomaly = seq >= 28;
    const tiltX = isAnomaly ? 4.2 + (seq - 28) * 0.4 : 0.05 + Math.sin(seq * 0.2) * 0.03;
    const tiltY = isAnomaly ? 3.8 + (seq - 28) * 0.3 : 0.02;
    const vibeAmp = isAnomaly ? 0.45 : 0.025;
    const vibeFreq = isAnomaly ? 14.5 : 5.2;
    const crackDisp = isAnomaly ? 8.5 : 2.9;
    const waterLvl = isAnomaly ? 4.8 : 1.4;
    const gas = isAnomaly ? 185.0 : 95.0;
    const temp = 26.5;
    const hum = 74.0;

    const channels = [
      { type: 'tilt_x_deg', val: tiltX, unit: 'deg' },
      { type: 'tilt_y_deg', val: tiltY, unit: 'deg' },
      { type: 'vibration_amplitude_g', val: vibeAmp, unit: 'g' },
      { type: 'vibration_freq_hz', val: vibeFreq, unit: 'Hz' },
      { type: 'crack_displacement_mm', val: crackDisp, unit: 'mm' },
      { type: 'water_level_cm', val: waterLvl, unit: 'cm' },
      { type: 'gas_ppm', val: gas, unit: 'ppm' },
      { type: 'temperature_c', val: temp, unit: '°C' },
      { type: 'humidity_pct', val: hum, unit: '%' },
      // Also publish legacy names for dashboard gauges
      { type: 'tilt', val: Math.sqrt(tiltX * tiltX + tiltY * tiltY), unit: 'degrees' },
      { type: 'vibration', val: vibeAmp, unit: 'g' },
    ];

    for (const ch of channels) {
      mqttClient.publish(
        `mine/${zoneId}/${nodeId}/${ch.type}`,
        JSON.stringify({
          nodeId,
          zoneId,
          sensorType: ch.type,
          value: ch.val,
          unit: ch.unit,
          sequenceNumber: seq,
          timestamp: new Date().toISOString(),
        }),
        { qos: 1 },
      );
    }

    if (seq % 8 === 0 || seq === 32 || seq === 35) {
      console.log(`Published packet #${seq}/35 (buffer count: ${Math.min(seq, 32)}/32)`);
    }

    // Small delay between packets
    await new Promise((r) => setTimeout(r, 60));
  }

  // Allow events to propagate and process
  await new Promise((r) => setTimeout(r, 2000));

  console.log('\n=== Summary of Step 1 ===');
  console.log(`Total Readings Received on Dashboard: ${readingsReceived}`);
  console.log(`Total Predictions Received on Shadow Channel: ${predictionsReceived}`);
  if (recordedLatencies.length > 0) {
    const avg = recordedLatencies.reduce((a, b) => a + b, 0) / recordedLatencies.length;
    console.log(`Latency Stats: Min=${Math.min(...recordedLatencies)}ms, Max=${Math.max(...recordedLatencies)}ms, Avg=${avg.toFixed(2)}ms`);
  }

  mqttClient.end();
  socket.disconnect();
  process.exit(0);
});
