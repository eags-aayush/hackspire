/*
  ESP32 Multi-Sensor + LoRa (RA-02) + ESP-NOW Node
  ----------------------------------------
  UPDATED: FreeRTOS Dual-Core Architecture.
  - Core 1: Sensor Reading (blocking) & Alarms.
  - Core 0: Real-time LoRa Rx/Tx (non-blocking).
*/

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <DHT.h>
#include <MPU9250_asukiaaa.h>
#include <WiFi.h>
#include <esp_now.h>
#include <math.h>
#include <ArduinoJson.h>

// ---------------- Device Identity ----------------
#define DEVICE_ID  "NODE_OP"

// ---------------- Pin Definitions ----------------
// LoRa (RA-02 / SX1278)
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_NSS   5
#define LORA_RST   14
#define LORA_DIO0  26
#define LORA_FREQ  433E6

// IMU
#define IMU_SDA    21
#define IMU_SCL    22
#define IMU_ADDR   0x68

// DHT22
#define DHT_PIN    4
#define DHT_TYPE   DHT22

// RGB LED
#define RGB_R_PIN  25
#define RGB_G_PIN  13
#define RGB_B_PIN  27
#define RGB_COMMON_ANODE true

// HC-SR04
#define TRIG_PIN   17
#define ECHO_PIN   16

// Analog sensors 
#define MQ6_PIN    34
#define WATER_PIN  35
#define POT_PIN    32

// Buzzer (Active-Low)
#define BUZZER_PIN 33

// ---------------- Binary Data Structure ----------------
typedef struct __attribute__((packed)) {
  char id[8];          // 8 bytes 
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
  uint8_t espnow_mac[6]; // 6 bytes
} SensorData;          // Total = 60 bytes

// ---------------- FreeRTOS Objects ----------------
QueueHandle_t sensorQueue;
SemaphoreHandle_t stateMutex;

// ---------------- Objects ----------------
DHT dht(DHT_PIN, DHT_TYPE);
MPU9250_asukiaaa imu;

// ---------------- Timing & State ----------------
unsigned long lastSend = -6000; 
const unsigned long SEND_INTERVAL = 1000; // ms (1 seconds)
uint32_t packetSent = 0;

// ESP-NOW global states
uint8_t last_mac[6] = {0, 0, 0, 0, 0, 0};
bool hasNewEspNowData = false;

// ---------------- Alert State (Controlled by Dashboard) ----------------
String alertLevel;
String alertColor;
String alertBuzzerMode;
String alertLedPattern;

// ==================================================
void OnEspNowDataRecv(const esp_now_recv_info *esp_now_info, const uint8_t *data, int len) {
  memcpy(last_mac, esp_now_info->src_addr, 6);
  hasNewEspNowData = true;
  Serial.printf("ESP-NOW hit from MAC %02X:%02X:%02X:%02X:%02X:%02X\n",
                last_mac[0], last_mac[1], last_mac[2], 
                last_mac[3], last_mac[4], last_mac[5]);
}

// ==================================================
void setupRGB() {
  pinMode(RGB_R_PIN, OUTPUT);
  pinMode(RGB_G_PIN, OUTPUT);
  pinMode(RGB_B_PIN, OUTPUT);
}

void setRGB(int r, int g, int b) {
  if (RGB_COMMON_ANODE) {
    r = 255 - r; g = 255 - g; b = 255 - b;
  }
  analogWrite(RGB_R_PIN, r);
  analogWrite(RGB_G_PIN, g);
  analogWrite(RGB_B_PIN, b);
}

// ==================================================
void setupLoRa() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed! Check wiring.");
    setRGB(255, 0, 0); // RED = LoRa Error
    while (1) {
      digitalWrite(BUZZER_PIN, LOW); delay(500); digitalWrite(BUZZER_PIN, HIGH); delay(500);
    }
  }
  LoRa.setSpreadingFactor(7); 
  LoRa.setSyncWord(0xF3);
  Serial.println("LoRa initialized.");
}

void setupIMU() {
  Wire.begin(IMU_SDA, IMU_SCL);
  imu.setWire(&Wire);
  imu.beginAccel();
  imu.beginGyro();
  delay(100);
  Serial.println("IMU initialized.");
}

void setupEspNow() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  esp_now_register_recv_cb(OnEspNowDataRecv);
  Serial.println("ESP-NOW initialized and listening.");
}

float readDistanceCM() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  if (duration == 0) return -1; 
  return duration * 0.0343 / 2.0; 
}

// ==================================================
// Core 0: LoRa Task (Real-Time Networking)
// ==================================================
void loraTaskCode(void * parameter) {
  for(;;) {
    // 1. Check for incoming packets (non-blocking)
    int packetSize = LoRa.parsePacket();
    if (packetSize) {
      String incoming = "";
      while (LoRa.available()) {
        incoming += (char)LoRa.read();
      }
      
      Serial.print("\n[LORA CORE] ---- Received LoRa Downlink ----\n");
      Serial.print("[LORA CORE] Packet Size: "); Serial.print(packetSize); Serial.println(" bytes");
      Serial.print("[LORA CORE] Payload Content: "); Serial.println(incoming);

      StaticJsonDocument<1024> doc;
      DeserializationError error = deserializeJson(doc, incoming);

      if (error) {
        Serial.print("[LORA CORE] JSON Parse Failed: ");
        Serial.println(error.c_str());
      } else {
        String targetNode = doc["nodeId"] | "";
        String targetType = doc["targetType"] | "node";

        bool isForMe = false;
        if (targetType == "node" && targetNode == String(DEVICE_ID)) isForMe = true;
        if (targetNode == "ALL") isForMe = true;

        if (isForMe) {
          String level = doc["level"] | "NORMAL";
          
          // Protect String mutation with Mutex
          xSemaphoreTake(stateMutex, portMAX_DELAY);
          if (level == "NORMAL") {
            alertLevel = "NORMAL";
            alertColor = "green";
            alertBuzzerMode = "off";
            alertLedPattern = "solid";
          } else {
            alertLevel = level;
            alertColor = doc["color"] | "red";
            alertBuzzerMode = doc["buzzerMode"] | "siren";
            alertLedPattern = doc["ledPattern"] | "strobe";
          }
          xSemaphoreGive(stateMutex);
          
          Serial.println(">>> SOS ALERT APPLIED FROM DASHBOARD <<<");

          // Send ACK back via LoRa
          String cmdId = doc["commandId"] | "";
          if (cmdId != "") {
            vTaskDelay(random(10, 50) / portTICK_PERIOD_MS); // Random backoff to avoid collision
            StaticJsonDocument<200> ackDoc;
            ackDoc["nodeId"] = String(DEVICE_ID);
            ackDoc["commandId"] = cmdId;
            ackDoc["type"] = "ack";
            String ackPayload;
            serializeJson(ackDoc, ackPayload);
            
            LoRa.beginPacket();
            LoRa.print(ackPayload);
            LoRa.endPacket();
            Serial.println("[LORA CORE] ACK sent: " + ackPayload);
          }
        }
      }
    }

    // 2. Check for outgoing packets in Queue (from Core 1)
    SensorData txPayload;
    if (xQueueReceive(sensorQueue, &txPayload, 0) == pdPASS) {
      LoRa.beginPacket();
      LoRa.write((const uint8_t *)&txPayload, sizeof(txPayload));
      LoRa.endPacket();
      Serial.printf("[LORA CORE] Transmitted Packet %d\n", txPayload.packetSeq);
    }

    // Yield to FreeRTOS watchdog
    vTaskDelay(1 / portTICK_PERIOD_MS);
  }
}

// ==================================================
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  // Initialize strings here to prevent global C++ constructor crashes before boot
  alertLevel = "NORMAL";
  alertColor = "green";
  alertBuzzerMode = "off";
  alertLedPattern = "solid";

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH); 

  setupRGB();
  setRGB(255, 255, 255); // WHITE - Booting

  setupLoRa();
  setupIMU();
  dht.begin();
  setupEspNow();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  analogReadResolution(12);

  Serial.print("Setup complete. Device ID: ");
  Serial.println(DEVICE_ID);
  
  digitalWrite(BUZZER_PIN, LOW); delay(100); digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW); delay(100); digitalWrite(BUZZER_PIN, HIGH);

  // Initialize FreeRTOS Objects
  sensorQueue = xQueueCreate(5, sizeof(SensorData));
  stateMutex = xSemaphoreCreateMutex();

  // Pin LoRa Task to Core 0 (PRO_CPU)
  xTaskCreatePinnedToCore(
    loraTaskCode,   /* Task function. */
    "LoRaTask",     /* name of task. */
    10000,          /* Stack size of task */
    NULL,           /* parameter of the task */
    1,              /* priority of the task */
    NULL,           /* Task handle to keep track of created task */
    0);             /* pin task to core 0 */
    
  Serial.println("FreeRTOS LoRa Task started on Core 0.");
}

// ==================================================
// Core 1: Sensor & Alarms Task (APP_CPU)
// ==================================================
void loop() {
  handleAlarms();

  if (millis() - lastSend >= SEND_INTERVAL) {
    lastSend = millis();
    readAndQueue(); // Renamed from readAndSend
  }
}

// --- CORE ALARM LOGIC (ACTIVE-LOW) ---
void handleAlarms() {
  static String lastStateStr = "";
  
  // Safely read String states using Mutex
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  String safeAlertColor = alertColor;
  String safeAlertLedPattern = alertLedPattern;
  String safeAlertBuzzerMode = alertBuzzerMode;
  xSemaphoreGive(stateMutex);

  String currentStateStr = safeAlertColor + "-" + safeAlertLedPattern + "-" + safeAlertBuzzerMode;
  
  if (currentStateStr != lastStateStr) {
    Serial.println("\n[NODE DEBUG] Actuator State Changed:");
    Serial.println("[NODE DEBUG] Target Color: " + safeAlertColor);
    Serial.println("[NODE DEBUG] Target Pattern: " + safeAlertLedPattern);
    Serial.println("[NODE DEBUG] Buzzer Mode: " + safeAlertBuzzerMode);
    lastStateStr = currentStateStr;
  }

  // 1. Determine Color
  int r = 0, g = 0, b = 0;
  if (safeAlertColor == "red") { r = 255; g = 0; b = 0; }
  else if (safeAlertColor == "yellow") { r = 255; g = 255; b = 0; }
  else if (safeAlertColor == "blue") { r = 0; g = 0; b = 255; }
  else if (safeAlertColor == "green") { r = 0; g = 255; b = 0; }

  // 2. LED Pattern
  unsigned long m = millis();
  if (safeAlertLedPattern == "strobe") {
    if (m % 200 < 100) setRGB(r, g, b); else setRGB(0, 0, 0);
  } else if (safeAlertLedPattern == "pulse") {
    if (m % 1000 < 500) setRGB(r, g, b); else setRGB(0, 0, 0);
  } else if (safeAlertLedPattern == "heartbeat") {
    int t = m % 1000;
    if (t < 100 || (t > 200 && t < 300)) setRGB(r, g, b); else setRGB(0, 0, 0);
  } else {
    setRGB(r, g, b); // solid
  }

  // 3. Buzzer Mode (Active Low: LOW = ON, HIGH = OFF)
  if (safeAlertBuzzerMode == "siren") {
    digitalWrite(BUZZER_PIN, LOW); 
  } else if (safeAlertBuzzerMode == "beep") {
    if (m % 1000 < 500) digitalWrite(BUZZER_PIN, LOW); else digitalWrite(BUZZER_PIN, HIGH);
  } else if (safeAlertBuzzerMode == "chirp") {
    if (m % 2000 < 100) digitalWrite(BUZZER_PIN, LOW); else digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(BUZZER_PIN, HIGH);
  }
}

void readAndQueue() {
  float temp = dht.readTemperature(); // This is BLOCKING, but LoRa Task is unaffected!
  float hum  = dht.readHumidity();
  bool dhtOk = !(isnan(temp) || isnan(hum));
  if (!dhtOk) { temp = 0; hum = 0; } 

  float ax = 0, ay = 0, az = 0, gx = 0, gy = 0, gz = 0;
  if (imu.accelUpdate() == 0) {
    ax = imu.accelX(); ay = imu.accelY(); az = imu.accelZ();
  }
  if (imu.gyroUpdate() == 0) {
    gx = imu.gyroX(); gy = imu.gyroY(); gz = imu.gyroZ();
  }

  float distance = readDistanceCM();
  int mq6Raw = analogRead(MQ6_PIN);
  int waterRaw = analogRead(WATER_PIN);
  int potRaw = analogRead(POT_PIN);

  packetSent++;

  SensorData payload;
  memset(&payload, 0, sizeof(payload)); 
  strncpy(payload.id, DEVICE_ID, 7); 
  
  payload.packetSeq = packetSent;
  payload.temp      = dhtOk ? temp : -999.0;
  payload.hum       = dhtOk ? hum : -999.0;
  payload.ax        = ax;
  payload.ay        = ay;
  payload.az        = az;
  payload.gx        = gx;
  payload.gy        = gy;
  payload.gz        = gz;
  payload.dist_cm   = distance;
  payload.mq6_raw   = (int16_t)mq6Raw;
  payload.water_raw = (int16_t)waterRaw;
  payload.pot_raw   = (int16_t)potRaw;

  if (hasNewEspNowData) {
    memcpy(payload.espnow_mac, last_mac, 6);
    hasNewEspNowData = false; 
  } else {
    memset(payload.espnow_mac, 0, 6); 
  }

  // Push to Queue for Core 0 to transmit
  if (xQueueSend(sensorQueue, &payload, 0) == pdPASS) {
    Serial.printf("[SENSOR CORE] Queued Packet %d | Temp: %.2f | Hum: %.2f\n", packetSent, temp, hum);
  } else {
    Serial.println("[SENSOR CORE] ERROR: LoRa Queue Full! Packet Dropped.");
  }
}
