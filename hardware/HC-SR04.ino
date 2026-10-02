#define TRIG_PIN 5
#define ECHO_PIN 18

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  // Clear trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Send 10us pulse to trigger
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Read echo pulse duration (microseconds)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (~5m max range)

  if (duration == 0) {
    Serial.println("No echo received (out of range or wiring issue)");
  } else {
    // Speed of sound = 343 m/s = 0.0343 cm/us
    // Divide by 2 because sound travels to the object and back
    float distanceCm = (duration * 0.0343) / 2;
    Serial.print("Distance: ");
    Serial.print(distanceCm);
    Serial.println(" cm");
  }

  delay(300);
}