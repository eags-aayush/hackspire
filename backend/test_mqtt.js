import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import mqtt from 'mqtt';

// Default to 1884 (dedicated Docker port to avoid Windows native service collision),
// then fallback to 1883 or env var.
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1884';

console.log(`[Simulator] Connecting to MQTT broker at ${brokerUrl}...`);

const client = mqtt.connect(brokerUrl, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: 'test-simulator-node-99',
  clean: true,
  connectTimeout: 5000,
});

client.on('error', (err) => {
  console.error(`[Simulator] Connection error on ${brokerUrl}:`, err.message);
  console.log('[Simulator] If port 1884 is unavailable, try setting MQTT_BROKER_URL=mqtt://10.189.148.161:1883 or check docker ps.');
});

client.on('connect', () => {
  console.log(`[Simulator] Successfully connected to Mosquitto Broker at ${brokerUrl}`);
  
  // ─── Subscribe to Edge Alert Downlink Topics ───
  const alertTopics = ['mine/+/+/alert', 'sensors/lora/downlink'];
  client.subscribe(alertTopics, { qos: 1 }, (err) => {
    if (!err) {
      console.log('[Simulator] 📡 Subscribed to edge alert downlink topics');
    }
  });

  // ─── Edge Alert Downlink Handler ───
  client.on('message', (topic, payload) => {
    if (topic.endsWith('/alert') || topic === 'sensors/lora/downlink') {
      try {
        const cmd = JSON.parse(payload.toString());
        if (!cmd.level || !cmd.commandId) return;

        const LED_ICONS = { red: '🔴', yellow: '🟡', blue: '🔵', green: '🟢' };
        const BUZZER_ICONS = { siren: '🔊 CONTINUOUS SIREN', beep: '🔔 INTERMITTENT BEEP', chirp: '🔕 SINGLE CHIRP', off: '🔇 OFF' };
        const led = LED_ICONS[cmd.color] || '⚪';
        const buzzer = BUZZER_ICONS[cmd.buzzerMode] || '🔇 OFF';

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║     ⚡ EDGE NODE HARDWARE SIMULATOR — LoRa DOWNLINK ⚡      ║');
        console.log('╠══════════════════════════════════════════════════════════════╣');
        console.log(`║  Node:    ${(cmd.nodeId || 'ALL').padEnd(14)} Zone: ${(cmd.zoneId || '-').padEnd(24)} ║`);
        console.log(`║  Level:   ${cmd.level.padEnd(48)} ║`);
        console.log(`║  LED:     ${led} ${(cmd.color?.toUpperCase() + ' ' + (cmd.ledPattern || '')).padEnd(46)} ║`);
        console.log(`║  Buzzer:  ${buzzer.padEnd(48)} ║`);
        console.log(`║  Message: ${(cmd.message || '').substring(0, 48).padEnd(48)} ║`);
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');

        // Send ACK back
        if (cmd.nodeId && cmd.zoneId) {
          const ackTopic = `mine/${cmd.zoneId}/${cmd.nodeId}/alert/ack`;
          const ackPayload = JSON.stringify({
            nodeId: cmd.nodeId,
            zoneId: cmd.zoneId,
            commandId: cmd.commandId,
            acknowledged: true,
            timestamp: new Date().toISOString(),
          });
          client.publish(ackTopic, ackPayload, { qos: 1 });
          console.log(`  -> ACK sent on ${ackTopic}`);
        }
      } catch {
        // Not an alert command, ignore
      }
    }
  });

  const zoneId = 'ZONE_1';
  const nodeId = 'NODE_99';
  let currentSeq = 1;

  const publishReading = (seq, type = 'tilt', value = 1.0, unit = 'degrees') => {
    const topic = `mine/${zoneId}/${nodeId}/${type}`;
    const payload = JSON.stringify({
      nodeId,
      zoneId,
      sensorType: type,
      value,
      unit,
      timestamp: new Date().toISOString(),
      sequenceNumber: seq,
    });
    client.publish(topic, payload, { qos: 1 });
    console.log(`  -> Published [${type}] value=${value}${unit} seq=${seq}`);
  };

  const publishStatus = (status) => {
    const topic = `mine/${zoneId}/${nodeId}/status`;
    const payload = JSON.stringify({
      nodeId,
      zoneId,
      status,
      timestamp: new Date().toISOString(),
    });
    client.publish(topic, payload, { qos: 1 });
    console.log(`  -> Published node status=${status}`);
  };

  console.log('\n=== Step 1: Executing Initial Fault & Resilience Test Sequence ===');

  setTimeout(() => {
    publishStatus('online');
  }, 100);

  setTimeout(() => {
    publishReading(1, 'tilt', 1.2, '°');
  }, 500);

  setTimeout(() => {
    console.log('  [Test] Publishing duplicate reading (seq=1)...');
    publishReading(1, 'tilt', 1.2, '°'); // Duplicate
  }, 1000);

  setTimeout(() => {
    console.log('  [Test] Publishing gap reading (seq=3, skipping 2)...');
    publishReading(3, 'tilt', 1.4, '°'); // Gap of 1
  }, 1500);

  setTimeout(() => {
    console.log('  [Test] Massive forward jump (>10k, hardware reboot connect)...');
    publishReading(3707764729, 'tilt', 1.5, '°');
  }, 2000);

  setTimeout(() => {
    publishReading(3707764730, 'tilt', 1.6, '°');
  }, 2500);

  setTimeout(() => {
    console.log('  [Test] Massive backward jump (counter reset)...');
    publishReading(5, 'tilt', 1.7, '°');
  }, 3000);

  setTimeout(() => {
    currentSeq = 6;
    publishReading(currentSeq, 'tilt', 1.8, '°');
  }, 3500);

  // Check if --once was passed
  const isOnce = process.argv.includes('--once');

  if (isOnce) {
    setTimeout(() => {
      console.log('\n[Simulator] Test sequence complete (--once mode). Exiting.');
      client.end();
    }, 4500);
  } else {
    setTimeout(() => {
      console.log('\n=== Step 2: Streaming Continuous Multi-Sensor Telemetry ===');
      console.log('[Simulator] Node NODE_99 is now streaming live data to Zone ZONE_1.');
      console.log('[Simulator] Open http://localhost:3001/monitoring to watch in real time!');
      console.log('[Simulator] Press Ctrl+C anytime to stop simulation.\n');

      let tick = 0;
      setInterval(() => {
        currentSeq++;
        tick++;

        // Realistic variations
        const tiltVal = Number((1.2 + Math.sin(tick * 0.3) * 0.6).toFixed(2));
        const vibeVal = Number((3.5 + Math.cos(tick * 0.5) * 2.1).toFixed(2));
        const dispVal = Number((12.4 + (tick % 10) * 0.2).toFixed(2));
        const gasVal = Math.round(45 + Math.random() * 20);
        const waterVal = Number((180 + Math.sin(tick * 0.2) * 15).toFixed(1));
        const crackVal = tick % 15 === 0 ? 1 : 0; // occasional fissure event

        publishReading(currentSeq, 'tilt', tiltVal, '°');
        publishReading(currentSeq, 'vibration', vibeVal, 'mm/s');
        publishReading(currentSeq, 'displacement', dispVal, 'mm');
        publishReading(currentSeq, 'gas', gasVal, 'ppm');
        publishReading(currentSeq, 'water', waterVal, 'cm');
        publishReading(currentSeq, 'crack', crackVal, 'state');

        // ML 9-channel feature representations
        publishReading(currentSeq, 'tilt_x_deg', tiltVal, 'deg');
        publishReading(currentSeq, 'tilt_y_deg', Number((tiltVal * 0.2).toFixed(2)), 'deg');
        publishReading(currentSeq, 'vibration_amplitude_g', Number((vibeVal * 0.01).toFixed(4)), 'g');
        publishReading(currentSeq, 'vibration_freq_hz', 5.4, 'Hz');
        publishReading(currentSeq, 'crack_displacement_mm', dispVal, 'mm');
        publishReading(currentSeq, 'water_level_cm', waterVal, 'cm');
        publishReading(currentSeq, 'gas_ppm', gasVal, 'ppm');
        publishReading(currentSeq, 'temperature_c', 26.2, '°C');
        publishReading(currentSeq, 'humidity_pct', 72.5, '%');
      }, 1500);
    }, 4500);
  }
});
