import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import mqtt from 'mqtt';
import { io } from 'socket.io-client';

function buildLoraPacket(nodeId, seq, macBytes = [0x24, 0x6f, 0x28, 0x11, 0x22, 0x33]) {
  const buf = Buffer.alloc(60);
  buf.write(nodeId.slice(0, 8), 0, 'utf8');
  buf.writeUInt32LE(seq, 8);
  buf.writeFloatLE(26.5, 12); // temp
  buf.writeFloatLE(64.2, 16); // hum
  buf.writeFloatLE(0.08, 20); // ax
  buf.writeFloatLE(0.15, 24); // ay
  buf.writeFloatLE(0.98, 28); // az
  buf.writeFloatLE(0.01, 32); // gx
  buf.writeFloatLE(0.01, 36); // gy
  buf.writeFloatLE(0.02, 40); // gz
  buf.writeFloatLE(15.2, 44); // dist_cm
  buf.writeInt16LE(420, 48);  // mq6_raw
  buf.writeInt16LE(110, 50);  // water_raw
  buf.writeInt16LE(55, 52);   // pot_raw
  for (let i = 0; i < 6; i++) {
    buf[54 + i] = macBytes ? macBytes[i] : 0;
  }
  return buf;
}

async function run() {
  console.log('--- Starting Multi-Node LoRa Test ---');

  // 1. Connect to Socket.IO backend
  const socket = io('http://localhost:3000', {
    transports: ['websocket'],
    timeout: 5000,
  });

  const nodeEvents = {
    NODE_01: { readings: 0, statuses: [] },
    NODE_02: { readings: 0, statuses: [] },
  };

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket.IO connect timeout')), 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      console.log('Socket.IO connected to backend (id=' + socket.id + ')');
      socket.emit('join_zone', { zoneId: 'zone-A' });
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  socket.on('snapshot', (data) => {
    console.log('Received initial snapshot for zone-A:', Object.keys(data || {}));
  });

  socket.on('node:status', (status) => {
    console.log(`[Socket] node:status -> node=${status.nodeId} status=${status.status}`);
    if (nodeEvents[status.nodeId]) {
      nodeEvents[status.nodeId].statuses.push(status.status);
    }
  });

  socket.on('sensor:reading:batch', (data) => {
    const readings = Array.isArray(data) ? data : data.readings || [];
    for (const r of readings) {
      if (nodeEvents[r.nodeId]) {
        nodeEvents[r.nodeId].readings++;
      }
    }
  });

  socket.on('ml:prediction', (pred) => {
    console.log(`[Socket] ml:prediction -> node=${pred.nodeId} class=${pred.anomaly_class} latency=${pred.inferenceLatencyMs}ms`);
  });

  // 2. Connect to MQTT broker (Docker Mosquitto on port 1884)
  const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1884');

  await new Promise((resolve, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD, reject) => {
    const timer = setTimeout(() => reject(new Error('MQTT connect timeout')), 5000);
    mqttClient.on('connect', () => {
      clearTimeout(timer);
      console.log('Connected to Mosquitto MQTT broker');
      resolve();
    });
    mqttClient.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  // 3. Publish alternating packets from NODE_01 and NODE_02
  console.log('\n--- Transmitting Alternating Packets (NODE_01 & NODE_02) ---');
  const rounds = 6;
  for (let i = 1; i <= rounds; i++) {
    // Node 1 transmits
    const p1 = buildLoraPacket('NODE_01', i, true);
    mqttClient.publish('sensors/lora/binary', p1);
    console.log(`Published packet NODE_01 (seq=${i}) [60 bytes]`);
    await new Promise((r) => setTimeout(r, 2000));

    // Node 2 transmits
    const p2 = buildLoraPacket('NODE_02', i, true);
    mqttClient.publish('sensors/lora/binary', p2);
    console.log(`Published packet NODE_02 (seq=${i}) [60 bytes]`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Wait for buffers to settle
  await new Promise((r) => setTimeout(r, 2500));

  // 4. Request snapshot verification
  console.log('\n--- Requesting Final Zone Snapshot ---');
  socket.emit('join_zone', { zoneId: 'zone-A' });

  await new Promise((resolve) => {
    socket.once('snapshot', (snapshot) => {
      console.log('Final zone-A snapshot state:');
      console.log('Nodes in snapshot:', snapshot.nodes ? snapshot.nodes.map(n => `${n.nodeId} (${n.status})`) : 'None');
      console.log('Readings present:', snapshot.readings ? Object.keys(snapshot.readings) : 0);
      resolve();
    });
    setTimeout(resolve, 3000);
  });

  console.log('\n--- Verification Results ---');
  console.log('NODE_01 statuses observed:', nodeEvents.NODE_01.statuses);
  console.log('NODE_02 statuses observed:', nodeEvents.NODE_02.statuses);
  console.log('NODE_01 readings batch count:', nodeEvents.NODE_01.readings);
  console.log('NODE_02 readings batch count:', nodeEvents.NODE_02.readings);

  const node1WentOffline = nodeEvents.NODE_01.statuses.includes('offline');
  const node2WentOffline = nodeEvents.NODE_02.statuses.includes('offline');

  mqttClient.end();
  socket.disconnect();

  if (node1WentOffline || node2WentOffline) {
    console.error('FAIL: At least one node flapped to offline during alternating transmission!');
    process.exit(1);
  }

  console.log('SUCCESS: Both nodes remained online and active during alternating transmissions!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
