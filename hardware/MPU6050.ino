#include <Wire.h>
#include <MPU6050_light.h>

MPU6050 mpu(Wire);

unsigned long timer = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(21, 22);

  Serial.println("Initializing MPU6050...");

  byte status = mpu.begin();
  Serial.print("MPU6050 status: ");
  Serial.println(status);
  while (status != 0) { } // stop if init failed

  Serial.println("Calculating offsets, do not move MPU6050");
  delay(1000);
  mpu.calcOffsets(); // gyro and accelero
  Serial.println("Done!\n");
}

void loop() {
  mpu.update();

  if (millis() - timer > 500) { // print every 500ms
    Serial.print("X: ");
    Serial.print(mpu.getAngleX());
    Serial.print("\tY: ");
    Serial.print(mpu.getAngleY());
    Serial.print("\tZ: ");
    Serial.println(mpu.getAngleZ());

    timer = millis();
  }
}