import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mqtt from 'mqtt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.join(__dirname, '../.env'));
loadEnvFile(path.join(__dirname, '.env'));

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtts://td1cf1ce.ala.asia-southeast1.emqxsl.com:8883';
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

console.log(`[MQTT Sniffer] Connecting to: ${brokerUrl}`);
console.log(`[MQTT Sniffer] User: ${username}`);

const client = mqtt.connect(brokerUrl, {
  username,
  password,
  connectTimeout: 10000,
  rejectUnauthorized: false,
});

const topics = [
  'sensors/lora/#',
  'sensors/lora/binary',
  'sensors/#',
  'mine/#',
  'mine/+/+/#',
  'gateway/#',
  'sensors/gateway/#',
  'mine/gateway/#'
];

let received = [];

client.on('connect', () => {
  console.log('✅ Connected to EMQX Cloud MQTT broker!');
  client.subscribe(topics, { qos: 0 }, (err, granted) => {
    if (err) {
      console.error('Subscription error:', err);
    } else {
      console.log('📡 Subscribed to topics successfully:');
      granted.forEach(g => console.log(`   - ${g.topic} (QoS ${g.qos})`));
      console.log('\nListening for live packets (up to 35 seconds)...\n');
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

client.on('message', (topic, payload) => {
  const now = new Date().toISOString();
  console.log(`\n======================================================`);
  console.log(`⚡ [${now}] INCOMING MQTT PACKET ON TOPIC: ${topic}`);
  console.log(`   Length: ${payload.length} bytes`);
  console.log(`   Hex Dump: ${payload.toString('hex')}`);

  let parsedJson = null;
  try {
    parsedJson = JSON.parse(payload.toString());
    console.log('   Payload Type: JSON');
    console.log('   Decoded Data:');
    console.log(JSON.stringify(parsedJson, null, 2));
  } catch {
    // Check if binary struct (54, 60, or 66 bytes)
    if (payload.length >= 54) {
      console.log('   Payload Type: Packed Binary SensorData Struct');
      try {
        const nodeId = payload.toString('utf8', 0, 8).replace(/\0/g, '').trim();
        const seq = payload.readUInt32LE(8);
        const temp = payload.readFloatLE(12);
        const hum = payload.readFloatLE(16);
        const ax = payload.readFloatLE(20);
        const ay = payload.readFloatLE(24);
        const az = payload.readFloatLE(28);
        const gx = payload.readFloatLE(32);
        const gy = payload.readFloatLE(36);
        const gz = payload.readFloatLE(40);
        const dist_cm = payload.readFloatLE(44);
        const mq6_raw = payload.readInt16LE(48);
        const water_raw = payload.readInt16LE(50);
        const pot_raw = payload.readInt16LE(52);

        let mac = null;
        if (payload.length >= 60) {
          const macBytes = [];
          for (let i = 0; i < 6; i++) macBytes.push(payload[54 + i].toString(16).padStart(2, '0').toUpperCase());
          mac = macBytes.join(':');
        }

        let rssi = null;
        let snr = null;
        if (payload.length >= 66) {
          rssi = payload.readInt16LE(60);
          snr = Math.round(payload.readFloatLE(62) * 10) / 10;
        }

        const decoded = {
          nodeId,
          packetSequence: seq,
          temperature: temp,
          humidity: hum,
          accel: { ax, ay, az },
          gyro: { gx, gy, gz },
          distance_cm: dist_cm,
          mq6_gas_raw: mq6_raw,
          water_level_raw: water_raw,
          potentiometer_raw: pot_raw,
          espnow_mac: mac !== '00:00:00:00:00:00' ? mac : null,
          rssi,
          snr,
        };

        console.log('   Decoded Struct:');
        console.log(JSON.stringify(decoded, null, 2));
      } catch (decodeErr) {
        console.log('   Decode error:', decodeErr.message);
        console.log('   Raw String:', payload.toString('latin1').replace(/[^\x20-\x7E]/g, '.'));
      }
    } else {
      console.log('   Payload Type: Raw / Text');
      console.log('   Raw Text:', payload.toString('utf-8'));
    }
  }
  console.log(`======================================================\n`);
  received.push({ topic, length: payload.length, timestamp: now });
});

setTimeout(() => {
  console.log(`\n=== Capture Finished ===`);
  console.log(`Total live packets received in this window: ${received.length}`);
  client.end(true);
  process.exit(0);
}, 35000);
