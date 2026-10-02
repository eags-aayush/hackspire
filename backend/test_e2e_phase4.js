import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import mqtt from 'mqtt';
import { io } from 'socket.io-client';

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1884';
const backendWsUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
const backendHttpUrl = process.env.BACKEND_HTTP_URL || 'http://127.0.0.1:3000';

console.log('=== Phase 4 End-to-End Verification Test (Prediction Log Store) ===');
console.log(`Connecting to MQTT Broker: ${brokerUrl}`);
console.log(`Connecting to Backend Socket.IO: ${backendWsUrl}`);

const mqttClient = mqtt.connect(brokerUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: 'e2e-tester-phase4',
  clean: true,
  connectTimeout: 5000,
});

const socket = io(backendWsUrl, {
  transports: ['websocket'],
  timeout: 5000,
});

let predictionsReceived = 0;
let readingsReceived = 0;
const recordedPredictions = [];

socket.on('connect', () => {
  console.log(`[Dashboard Socket] Connected to Backend (socket id: ${socket.id})`);
  socket.emit('join_zone', { zoneId: 'ZONE_1' });
});

socket.on('readings', (data) => {
  readingsReceived += Array.isArray(data) ? data.length : 1;
});

socket.on('ml:prediction', (pred) => {
  predictionsReceived++;
  recordedPredictions.push(pred);
  if (predictionsReceived === 1 || predictionsReceived % 10 === 0 || predictionsReceived === 44) {
    console.log(`[Dashboard Shadow Channel] Received Prediction #${predictionsReceived}: Node ${pred.nodeId} | Pred: ${pred.anomaly_class} (${(pred.class_probs[pred.anomaly_class] * 100).toFixed(1)}%) | Sev: ${pred.severity} | Alert: ${pred.alert_level} | Latency: ${pred.inferenceLatencyMs}ms`);
  }
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

  console.log('\n--- Step 1: Streaming 35 Packets (385 Readings) Through Pipeline ---');

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
      // Legacy channels
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

    if (seq % 10 === 0 || seq === 32 || seq === 35) {
      console.log(`Published packet #${seq}/35 (buffer primed: ${seq >= 32})`);
    }

    await new Promise((r) => setTimeout(r, 60));
  }

  // Allow async write queue to persist to SQLite
  console.log('\n--- Waiting 3.5s for persistence and pipeline flush ---');
  await new Promise((r) => setTimeout(r, 3500));

  console.log('\n=== Pipeline Telemetry Results ===');
  console.log(`Total Readings Received on Dashboard: ${readingsReceived}`);
  console.log(`Total Predictions Received on Dashboard: ${predictionsReceived}`);

  // Query Prediction Store via REST API
  console.log('\n--- Step 2: Querying Prediction Store Statistics via REST API ---');
  try {
    const statsRes = await fetch(`${backendHttpUrl}/ml/predictions/stats`);
    const stats = await statsRes.json();
    console.log('Prediction Store Stats:', stats);

    const listRes = await fetch(`${backendHttpUrl}/ml/predictions?nodeId=NODE_01&limit=5`);
    const listData = await listRes.json();
    console.log(`Total Logged Rows for NODE_01: ${listData.total}`);

    if (listData.records && listData.records.length > 0) {
      const sample = listData.records[0];
      console.log('\nSample Logged Row:');
      console.log(`  prediction_id:        ${sample.prediction_id}`);
      console.log(`  node_id:              ${sample.node_id}`);
      console.log(`  zone_id:              ${sample.zone_id}`);
      console.log(`  timestamp:            ${sample.timestamp}`);
      console.log(`  predicted_class:      ${sample.predicted_class}`);
      console.log(`  severity:             ${sample.severity}`);
      console.log(`  alert_level:          ${sample.alert_level}`);
      console.log(`  model_version:        ${sample.model_version}`);
      console.log(`  inference_latency_ms: ${sample.inference_latency_ms}`);
      console.log(`  confirmed_label:      ${sample.confirmed_label}`);

      // Verify input_window round-trip
      const parsedWindow = JSON.parse(sample.input_window);
      console.log(`\nInput Window Validation:`);
      console.log(`  Is Array:             ${Array.isArray(parsedWindow)}`);
      console.log(`  Timesteps (Length):   ${parsedWindow.length} (Expected: 32)`);
      console.log(`  Channels per Step:    ${parsedWindow[0]?.length} (Expected: 9)`);
      console.log(`  First Timestep Vector: [${parsedWindow[0]?.map((v) => Number(v).toFixed(3)).join(', ')}]`);
      console.log(`  Last Timestep Vector:  [${parsedWindow[31]?.map((v) => Number(v).toFixed(3)).join(', ')}]`);

      if (parsedWindow.length === 32 && parsedWindow[0]?.length === 9) {
        console.log('  [PASS] Window round-trips correctly as a valid (32, 9) float matrix!');
      } else {
        console.error('  [FAIL] Window shape mismatch!');
      }

      // Test Attaching Confirmed Label
      console.log('\n--- Step 3: Testing Ground-Truth Label Hook ---');
      const patchRes = await fetch(`${backendHttpUrl}/ml/predictions/${sample.prediction_id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_label: 'subsidence_risk' }),
      });
      const patchData = await patchRes.json();
      console.log('PATCH confirm response:', patchData);
    }
  } catch (err) {
    console.error('API Verification failed:', err);
  }

  mqttClient.end();
  socket.disconnect();
  process.exit(0);
});
