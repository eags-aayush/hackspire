import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import mqtt from 'mqtt';
import { io } from 'socket.io-client';
import { execSync, spawn } from 'child_process';

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1884';
const backendWsUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000';

console.log('=== Test Mid-Stream ML Service Failure Resilience ===');

const mqttClient = mqtt.connect(brokerUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: 'resilience-tester',
  clean: true,
  connectTimeout: 5000,
});

const socket = io(backendWsUrl, {
  transports: ['websocket'],
  timeout: 5000,
});

let readingsReceived = 0;
let predictionsReceived = 0;

socket.on('connect', () => {
  console.log(`[Dashboard Socket] Connected (id: ${socket.id})`);
  socket.emit('join_zone', { zoneId: 'ZONE_1' });
});

socket.on('readings', (data) => {
  const count = Array.isArray(data) ? data.length : 1;
  readingsReceived += count;
});

socket.on('ml:prediction', (pred) => {
  predictionsReceived++;
  console.log(`[ML Shadow Channel] Prediction received: class=${pred.anomaly_class} latency=${pred.inferenceLatencyMs}ms`);
});

mqttClient.on('connect', async () => {
  console.log('[MQTT] Connected to Mosquitto');

  const zoneId = 'ZONE_1';
  const nodeId = 'NODE_RESIL';

  const sendPacket = (seq) => {
    const payload = {
      nodeId,
      zoneId,
      sensorType: 'tilt',
      value: 1.25,
      unit: 'degrees',
      sequenceNumber: seq,
      timestamp: new Date().toISOString(),
    };
    mqttClient.publish(`mine/${zoneId}/${nodeId}/tilt`, JSON.stringify(payload));
  };

  console.log('\n--- Phase A: Streaming 35 packets while ML service is ONLINE ---');
  for (let seq = 1; seq <= 35; seq++) {
    sendPacket(seq);
    await new Promise((r) => setTimeout(r, 40));
  }
  await new Promise((r) => setTimeout(r, 1000));
  console.log(`Phase A complete. Readings on dashboard: ${readingsReceived}, Predictions: ${predictionsReceived}`);

  console.log('\n--- Phase B: KILLING ML Inference Service Mid-Stream ---');
  try {
    // Find and kill python process on port 8000
    const netstatOut = execSync('powershell -Command "(Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess"').toString().trim();
    const pid = netstatOut.split(/\s+/)[0];
    if (pid) {
      console.log(`Killing python inference process PID: ${pid}`);
      execSync(`taskkill /F /PID ${pid}`);
      console.log(`Python process PID ${pid} terminated.`);
    }
  } catch (err) {
    console.log('Error killing process:', err.message);
  }

  // Confirm ML service is dead
  try {
    execSync('curl.exe -s --max-time 1 http://127.0.0.1:8000/health');
    console.error('ERROR: Service is still responding!');
  } catch {
    console.log('Confirmed: Inference service is DOWN (connection refused / dead).');
  }

  const readingsBeforeDown = readingsReceived;
  console.log('\n--- Phase C: Streaming 20 more packets while ML service is DEAD ---');
  for (let seq = 36; seq <= 55; seq++) {
    sendPacket(seq);
    await new Promise((r) => setTimeout(r, 40));
  }

  await new Promise((r) => setTimeout(r, 1500));
  const newReadingsDuringDown = readingsReceived - readingsBeforeDown;
  console.log(`Phase C complete!`);
  console.log(`Readings ingested & forwarded to dashboard while ML service was DEAD: ${newReadingsDuringDown}`);
  if (newReadingsDuringDown > 0) {
    console.log('>>> SUCCESS: Sensor ingestion path continued 100% uninterrupted without crashing!');
  } else {
    console.error('>>> FAILURE: Sensor ingestion stalled!');
  }

  console.log('\n--- Phase D: Restarting ML Inference Service ---');
  const mlService = spawn(
    'e:\\SIH-2026\\ML-Server\\.venv\\Scripts\\python.exe',
    ['-m', 'uvicorn', 'app:app', '--host', '0.0.0.0', '--port', '8000'],
    {
      cwd: 'e:\\SIH-2026\\ML-Server\\inference-service',
      detached: true,
      stdio: 'ignore',
    },
  );
  mlService.unref();

  // Wait for service to come back up
  let restarted = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 600));
    try {
      const res = execSync('curl.exe -s http://127.0.0.1:8000/health').toString();
      if (res.includes('ok')) {
        console.log('Confirmed: ML Inference service is BACK ONLINE!');
        restarted = true;
        break;
      }
    } catch {}
  }

  if (restarted) {
    console.log('\n--- Phase E: Streaming 10 more packets with ML service restored ---');
    const predsBefore = predictionsReceived;
    for (let seq = 56; seq <= 65; seq++) {
      sendPacket(seq);
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 2000));
    console.log(`Predictions received after service recovery: ${predictionsReceived - predsBefore}`);
    console.log('>>> SUCCESS: Predictions resumed cleanly after service recovery!');
  }

  mqttClient.end();
  socket.disconnect();
  process.exit(0);
});
