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

console.log(`Connecting to MQTT broker: ${brokerUrl}`);
console.log(`Username: ${username ? username : '(none)'}`);

const client = mqtt.connect(brokerUrl, {
  username,
  password,
  connectTimeout: 8000,
  rejectUnauthorized: false,
});

const receivedMessages = [];

client.on('connect', () => {
  console.log('✅ Connected successfully to MQTT broker!');
  console.log('Subscribing to wildcard topics "#", "$SYS/#" ...');
  client.subscribe(['#', '$SYS/#'], { qos: 0 }, (err) => {
    if (err) {
      console.error('Subscription error:', err);
    } else {
      console.log('📡 Subscribed to "#". Listening for live telemetry / MQTT packets (12s)...\n');
    }
  });
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

client.on('message', (topic, message) => {
  const rawStr = message.toString();
  let parsed = null;
  try {
    parsed = JSON.parse(rawStr);
  } catch (e) {
    // not JSON
  }

  const record = {
    topic,
    length: message.length,
    timestamp: new Date().toISOString(),
    payload: parsed !== null ? parsed : rawStr,
  };

  receivedMessages.push(record);
  console.log(`[${record.timestamp}] Topic: ${topic} (${message.length} bytes)`);
  if (parsed) {
    console.log(JSON.stringify(parsed, null, 2));
  } else {
    console.log(rawStr);
  }
  console.log('----------------------------------------------------');
});

setTimeout(() => {
  console.log(`\n=== Capture Summary ===`);
  console.log(`Total messages received: ${receivedMessages.length}`);
  if (receivedMessages.length === 0) {
    console.log('No messages were broadcast during the listening window.');
  }
  client.end(true);
  process.exit(0);
}, 12000);
