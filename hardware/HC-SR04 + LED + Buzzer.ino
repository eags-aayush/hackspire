#define TRIG_PIN 5
#define ECHO_PIN 18

#define RED_PIN   25
#define GREEN_PIN 26
#define BLUE_PIN  27

#define BUZZER_PIN 4

// PWM channels (ESP32 LEDC)
#define RED_CHANNEL   0
#define GREEN_CHANNEL 1
#define BLUE_CHANNEL  2
#define PWM_FREQ      5000
#define PWM_RES       8   // 8-bit: 0-255

// Distance thresholds (cm)
#define SAFE_DISTANCE    65
#define WARNING_DISTANCE 35

// Colors as hex (0xRRGGBB)
#define COLOR_GREEN  0x00FF00
#define COLOR_YELLOW 0xFFFF00
#define COLOR_RED    0xFF0000
#define COLOR_OFF    0x000000

unsigned long lastBeepToggle = 0;
bool beepState = false;
const int yellowBeepInterval = 300;

void setColorHex(uint32_t hexColor) {
  uint8_t r = (hexColor >> 16) & 0xFF;
  uint8_t g = (hexColor >> 8) & 0xFF;
  uint8_t b = hexColor & 0xFF;

  // Common anode: invert values (255 - value)
  ledcWrite(RED_CHANNEL, 255 - r);
  ledcWrite(GREEN_CHANNEL, 255 - g);
  ledcWrite(BLUE_CHANNEL, 255 - b);
}

float getDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  return (duration * 0.0343) / 2;
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  ledcSetup(RED_CHANNEL, PWM_FREQ, PWM_RES);
  ledcSetup(GREEN_CHANNEL, PWM_FREQ, PWM_RES);
  ledcSetup(BLUE_CHANNEL, PWM_FREQ, PWM_RES);

  ledcAttachPin(RED_PIN, RED_CHANNEL);
  ledcAttachPin(GREEN_PIN, GREEN_CHANNEL);
  ledcAttachPin(BLUE_PIN, BLUE_CHANNEL);

  setColorHex(COLOR_OFF);
  digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  float distance = getDistanceCm();

  if (distance < 0) {
    Serial.println("No echo received");
    setColorHex(COLOR_OFF);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
    return;
  }

  Serial.print("Distance: ");
  Serial.print(distance);
  Serial.println(" cm");

  if (distance > SAFE_DISTANCE) {
    setColorHex(COLOR_GREEN);
    digitalWrite(BUZZER_PIN, LOW);

  } else if (distance > WARNING_DISTANCE) {
    setColorHex(COLOR_YELLOW);

    if (millis() - lastBeepToggle >= yellowBeepInterval) {
      beepState = !beepState;
      digitalWrite(BUZZER_PIN, beepState);
      lastBeepToggle = millis();
    }

  } else {
    setColorHex(COLOR_RED);
    digitalWrite(BUZZER_PIN, HIGH);
  }

  delay(50);
}