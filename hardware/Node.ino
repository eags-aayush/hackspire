/*
  ESP32 Multi-Sensor + LoRa (RA-02) + ESP-NOW Node
  ----------------------------------------
  UPDATED: ESP-NOW RSSI removed for ESP32 Core 2.x compatibility.
  Struct size is now 60 bytes.
*/

#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <DHT.h>
#include <MPU9250_asukiaaa.h>
#include <WiFi.h>
#include <esp_now.h>

// ---------------- Device Identity ----------------
#define DEVICE_ID  "NODE_01"

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
#define RGB_COMMON_ANODE false

// HC-SR04
#define TRIG_PIN   17
#define ECHO_PIN   16

// Analog sensors 
#define MQ6_PIN    34
#define WATER_PIN  35
#define POT_PIN    32

// Buzzer
#define BUZZER_PIN 33

// ---------------- Binary Data Structure ----------------
// NEW SIZE: 60 bytes total. MUST mirror this on the receiver!
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

// ---------------- Objects ----------------
DHT dht(DHT_PIN, DHT_TYPE);
MPU9250_asukiaaa imu;

// ---------------- Timing & State ----------------
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL = 5000; // ms
uint32_t packetSent = 0;

// ESP-NOW global states
uint8_t last_mac[6] = {0, 0, 0, 0, 0, 0};
bool hasNewEspNowData = false;

// ==================================================
// ESP-NOW Callback (Safe version for ESP32 Core 2.x)
void OnEspNowDataRecv(const uint8_t *mac_addr, const uint8_t *data, int len) {
  memcpy(last_mac, mac_addr, 6);
  hasNewEspNowData = true;
  
  Serial.printf("ESP-NOW hit from MAC %02X:%02X:%02X:%02X:%02X:%02X\n",
                last_mac[0], last_mac[1], last_mac[2], 
                last_mac[3], last_mac[4], last_mac[5]);
}

// ==================================================
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  setupRGB();
  setupLoRa();
  setupIMU();
  dht.begin();
  setupEspNow();

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  analogReadResolution(12);

  Serial.print("Setup complete. Device ID: ");
  Serial.println(DEVICE_ID);
  
  setRGB(0, 255, 0); 
  
  beep(100); delay(100); beep(100);
}

// ==================================================
void loop() {
  if (millis() - lastSend >= SEND_INTERVAL) {
    lastSend = millis();
    readAndSend();
  }

  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    Serial.print("Received LoRa: ");
    Serial.println(incoming);
  }
}

// ==================================================
void beep(int duration_ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(duration_ms);
  digitalWrite(BUZZER_PIN, LOW);
}

void setupLoRa() {
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_NSS);
  LoRa.setPins(LORA_NSS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println("LoRa init failed! Check wiring.");
    setRGB(255, 0, 0);
    while (1) {
      beep(500);
      delay(500);
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
  // ESP-NOW requires WiFi in Station Mode
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 

  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  
  // Register callback
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

void setupRGB() {
  pinMode(RGB_R_PIN, OUTPUT);
  pinMode(RGB_G_PIN, OUTPUT);
  pinMode(RGB_B_PIN, OUTPUT);
  setRGB(0, 0, 0);
}

void setRGB(int r, int g, int b) {
  if (RGB_COMMON_ANODE) {
    r = 255 - r; g = 255 - g; b = 255 - b;
  }
  analogWrite(RGB_R_PIN, r);
  analogWrite(RGB_G_PIN, g);
  analogWrite(RGB_B_PIN, b);
}

// ---------------- Read all sensors + send ----------------
void readAndSend() {
  float temp = dht.readTemperature();
  float hum  = dht.readHumidity();
  bool dhtOk = !(isnan(temp) || isnan(hum));

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

  // Append ESP-NOW data if anything was detected since last loop
  if (hasNewEspNowData) {
    memcpy(payload.espnow_mac, last_mac, 6);
    hasNewEspNowData = false; // Reset until next device is detected
  } else {
    memset(payload.espnow_mac, 0, 6); // Zeros indicate no device
  }

  Serial.printf("Sending Packet %d (Binary 60 bytes)...\n", packetSent);

  setRGB(0, 0, 255); 
  beep(50);          
  LoRa.beginPacket();
  LoRa.write((const uint8_t *)&payload, sizeof(payload));
  LoRa.endPacket();
  setRGB(0, 255, 0); 
}