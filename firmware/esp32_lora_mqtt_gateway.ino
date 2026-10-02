/*
  ESP32 LoRa (RA-02) <-> MQTT Gateway (Bidirectional)
  ----------------------------------------
  UPDATED: Added bidirectional support. 
  1. Forwards 60-byte binary telemetry payloads from LoRa to MQTT.
  2. Forwards JSON ACKs from LoRa to MQTT.
  3. Listens to SOS downlinks on MQTT and broadcasts them over LoRa.
*/

#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ---------------- WiFi credentials ----------------
const char* WIFI_SSID     = "iQOO Z7s 5G";
const char* WIFI_PASSWORD = "";

// ---------------- MQTT broker settings ----------------
const char* MQTT_BROKER    = "10.216.64.161";   // broker IP or hostname
const int   MQTT_PORT      = 1883;
const char* MQTT_CLIENT_ID = "esp32-lora-gateway";

// --- MQTT Topics ---
const char* MQTT_TOPIC          = "sensors/lora/binary";  // uplink binary topic
const char* MQTT_ACK_TOPIC      = "mine/lora/gateway/alert/ack"; // uplink ack topic
const char* MQTT_DOWNLINK_TOPIC = "sensors/lora/downlink"; // downlink SOS topic

// Optional, leave blank ("") if your broker doesn't require auth
const char* MQTT_USER      = "";
const char* MQTT_PASS      = "";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ---------------- LoRa pins (must match transmitter) ----------------
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_NSS   5
#define LORA_RST   14
#define LORA_DIO0  26
#define LORA_FREQ  433E6   // must match transmitter exactly

// ---------------- Binary Data Structure ----------------
// NEW SIZE: 60 bytes. MUST match the transmitter EXACTLY!
typedef struct __attribute__((packed)) {
  char id[8];          // 8 bytes (e.g., "NODE_01\0")
  uint32_t packetSeq;  // 4 bytes
  float temp;          // 4 bytes
  float hum;           // 4 bytes
  float ax;            // 4 bytes
  float ay;            // 4 bytes
  float az;            // 4 bytes
  float gx;            // 4 bytes
  float gy;            // 4 bytes
  float gz;            // 4 bytes
  float dist_cm;       // 4 bytes
  int16_t mq6_raw;     // 2 bytes
  int16_t water_raw;   // 2 bytes
  int16_t pot_raw;     // 2 bytes
  uint8_t espnow_mac[6]; // 6 bytes (NEW)
} SensorData;          // Total = 60 bytes

// ---------------- Packet tracking ----------------
uint32_t packetsReceived = 0;
uint32_t packetsSent     = 0;

// ==================================================
// ---------------- MQTT Callback (Downlink) --------
// ==================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (String(topic) == MQTT_DOWNLINK_TOPIC) {
    Serial.println("\n[GATEWAY DEBUG] >>> Received MQTT Downlink from Dashboard!");
    Serial.print("[GATEWAY DEBUG] Topic: ");
    Serial.println(topic);

    String payloadStr = "";
    for (unsigned int i = 0; i < length; i++) {
      payloadStr += (char)payload[i];
    }
    Serial.print("[GATEWAY DEBUG] Payload: ");
    Serial.println(payloadStr);

    Serial.println("[GATEWAY DEBUG] >>> Broadcasting command to LoRa network...");
    
    // Broadcast exactly what the backend sent to the LoRa nodes
    LoRa.beginPacket();
    LoRa.write(payload, length);
    LoRa.endPacket();
    
    Serial.println("[GATEWAY DEBUG] >>> LoRa transmission complete.");
  }
}

// ==================================================
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  setupWiFi();
  setupMQTT();
  setupLoRa();

  Serial.println("Gateway ready: bridging LoRa and MQTT (Bidirectional)...");
}

// ==================================================
void loop() {
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 10000) {
    Serial.println("...still listening for LoRa...");
    lastHeartbeat = millis();
  }
  // --------------------------

  // Keep WiFi + MQTT alive
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();   // required for PubSubClient housekeeping

  int packetSize = LoRa.parsePacket();
  if (packetSize == 0) return;   // nothing received this cycle

  // Peek at the first byte to determine if it's JSON (ACK) or Binary (Telemetry)
  int firstByte = LoRa.peek();

  if (firstByte == '{') {
    // ---------------- Handle JSON ACK ----------------
    uint8_t buffer[512];
    int len = 0;
    while (LoRa.available() && len < 512) {
      buffer[len++] = LoRa.read();
    }
    buffer[len] = '\0';
    String jsonStr = String((char*)buffer);
    
    Serial.println("\n---- JSON ACK Received ----");
    Serial.println(jsonStr);
    
    if (mqttClient.connected()) {
      bool pub = mqttClient.publish(MQTT_ACK_TOPIC, (uint8_t*)jsonStr.c_str(), jsonStr.length());
      Serial.print("MQTT publish ["); Serial.print(MQTT_ACK_TOPIC); Serial.println(pub ? "]: OK" : "]: FAILED");
    }
    Serial.println("--------------------------------");
    
  } else {
    // ---------------- Handle Binary Telemetry ----------------
    SensorData rxData;

    if (packetSize == sizeof(rxData)) {
      LoRa.readBytes((uint8_t*)&rxData, sizeof(rxData));

      int rssi  = LoRa.packetRssi();
      float snr = LoRa.packetSnr();

      packetsReceived++;
      packetsSent = rxData.packetSeq;

      // Ensure the char array is null-terminated before printing
      char safeId[9];
      memcpy(safeId, rxData.id, 8);
      safeId[8] = '\0';

      // ---------------- Serial log ----------------
      Serial.println("\n---- Binary Packet Received ----");
      Serial.print("Device: ");
      Serial.println(safeId);
      Serial.print("LoRa RSSI: "); Serial.print(rssi);
      Serial.print(" dBm | SNR: "); Serial.println(snr);
      Serial.printf("Temp: %.1f C | Hum: %.1f %%\n", rxData.temp, rxData.hum);
      Serial.printf("Accel: %.2f, %.2f, %.2f\n", rxData.ax, rxData.ay, rxData.az);
      Serial.printf("Gyro:  %.2f, %.2f, %.2f\n", rxData.gx, rxData.gy, rxData.gz);
      Serial.printf("Distance: %.1f cm\n", rxData.dist_cm);
      Serial.printf("MQ6 raw: %d | Water raw: %d | Pot raw: %d\n",
                    rxData.mq6_raw, rxData.water_raw, rxData.pot_raw);
                    
      // Check if the MAC array contains anything other than zeros
      bool hasMac = false;
      for (int i = 0; i < 6; i++) {
        if (rxData.espnow_mac[i] != 0) hasMac = true;
      }

      if (hasMac) {
        Serial.printf("ESP-NOW Hit! MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                      rxData.espnow_mac[0], rxData.espnow_mac[1], rxData.espnow_mac[2], 
                      rxData.espnow_mac[3], rxData.espnow_mac[4], rxData.espnow_mac[5]);
      } else {
        Serial.println("ESP-NOW: No devices detected in this cycle.");
      }
      
      Serial.printf("Packets Received: %lu / %lu\n", packetsReceived, packetsSent);
      Serial.println("--------------------------------");

      // ---------------- Publish raw binary to MQTT ----------------
      publishToMQTT(rxData);

    } else {
      Serial.print("\n---- Invalid Packet ----\nExpected ");
      Serial.print(sizeof(rxData));
      Serial.print(" bytes, but received ");
      Serial.print(packetSize);
      Serial.println(" bytes. Dropping.");
      Serial.println("------------------------");
    }
  }
}

// ==================================================
// ---------------- WiFi ----------------
void setupWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    // avoid hanging forever if credentials are wrong
    if (millis() - startAttempt > 20000) {
      Serial.println("\nWiFi connect timed out. Retrying in background...");
      break;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("WiFi connected. IP address: ");
    Serial.println(WiFi.localIP());
  }
}

void reconnectWiFi() {
  static unsigned long lastAttempt = 0;
  // don't spam reconnect attempts every loop
  if (millis() - lastAttempt < 5000) return;
  lastAttempt = millis();

  Serial.println("WiFi disconnected. Attempting reconnect...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ---------------- MQTT ----------------
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback); // Attach the Downlink Listener
  
  // VERY IMPORTANT: The SOS JSON payload from the backend is ~320 bytes.
  // The default PubSubClient buffer is only 256 bytes, which causes it to silently drop the message!
  mqttClient.setBufferSize(512);
}

void reconnectMQTT() {
  static unsigned long lastAttempt = 0;
  if (millis() - lastAttempt < 5000) return;  // retry every 5s, non-blocking
  lastAttempt = millis();

  if (WiFi.status() != WL_CONNECTED) return;  // no point without WiFi

  Serial.print("Connecting to MQTT broker: ");
  Serial.println(MQTT_BROKER);

  bool connected;
  if (strlen(MQTT_USER) > 0) {
    connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS);
  } else {
    connected = mqttClient.connect(MQTT_CLIENT_ID);
  }

  if (connected) {
    Serial.println("MQTT connected.");
    // Subscribe to Downlinks when reconnected!
    mqttClient.subscribe(MQTT_DOWNLINK_TOPIC);
    Serial.print("Subscribed to "); Serial.println(MQTT_DOWNLINK_TOPIC);
  } else {
    Serial.print("MQTT connect failed, state=");
    Serial.println(mqttClient.state());
    // state codes: -4 timeout, -3 connection lost, -2 connect failed,
    // -1 disconnected, 1-5 = broker-side rejection reasons
  }
}

// ---------------- Publish raw binary sensor reading over MQTT ----------------
void publishToMQTT(const SensorData &d) {
  if (!mqttClient.connected()) {
    Serial.println("MQTT not connected — skipping publish for this packet.");
    return;
  }

  // Publish the raw struct bytes directly — no JSON conversion.
  // PubSubClient's publish(topic, payload*, length) overload handles
  // arbitrary binary data.
  bool published = mqttClient.publish(
    MQTT_TOPIC,
    (const uint8_t*)&d,
    sizeof(d)
  );

  Serial.print("MQTT publish [");
  Serial.print(MQTT_TOPIC);
  Serial.print("]: ");
  Serial.print(published ? "OK" : "FAILED");
  Serial.print(" (");
  Serial.print(sizeof(d));
  Serial.println(" bytes, binary)");
}

// ---------------- LoRa ----------------
void setupLoRa() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed. Check wiring.");
    while (1) delay(10);
  }
  LoRa.setSpreadingFactor(7); // Lock the speed
  LoRa.setSyncWord(0xF3);
  Serial.println("LoRa initialized.");
}
