/*
  ============================================================
  NRF24L01_Sensor_TX.ino — DHT22 Sensor Transmitter
  Upload to : Arduino UNO #1 (sensor node)
  Libraries : RF24 by TMRh20 · DHT sensor library by Adafruit
  Baud Rate : 115200

  Reads temperature and humidity from a DHT22 sensor every 2 s
  and transmits the reading wirelessly via NRF24L01.

  HOW TO USE:
    1. Wire DHT22 DATA pin to A0.
    2. Upload this sketch to the TX Arduino.
    3. Upload NRF24L01_RX.ino to the RX Arduino.
    4. Connect TX Arduino to browser via Web Serial.
    5. Incoming sensor readings appear in the TX serial monitor.

  WIRELESS PAYLOAD FORMAT:
    "T:28.5C H:62%"

  SERIAL OUTPUT:
    "TX:T:28.5C H:62%:ACK\n"   — successful transmission
    "TX:T:28.5C H:62%:FAIL\n"  — no ACK from receiver
    "DHT_ERR\n"                 — sensor read failed

  DHT22 WIRING:
    Pin 1 (VCC)  → 5V
    Pin 2 (DATA) → A0  (with 10kΩ pull-up to 5V)
    Pin 3 (NC)   → not connected
    Pin 4 (GND)  → GND

  NRF24L01 WIRING (3.3 V !):
    VCC  → 3.3V
    GND  → GND
    CE   → D9
    CSN  → D10
    SCK  → D13
    MOSI → D11
    MISO → D12
  ============================================================
*/

#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>
#include <DHT.h>

// ── Configuration ─────────────────────────────────────────
#define DHT_PIN   A0
#define DHT_TYPE  DHT22

const uint64_t PIPE         = 0xE7E7E7E7E7LL;
const uint8_t  CHANNEL      = 76;
const uint16_t SEND_INTERVAL_MS = 2000;   // transmission interval
// ──────────────────────────────────────────────────────────

RF24  radio(9, 10);
DHT   dht(DHT_PIN, DHT_TYPE);
char  payload[33];

void setup() {
  Serial.begin(115200);
  dht.begin();

  radio.begin();
  radio.setPALevel(RF24_PA_HIGH);
  radio.setDataRate(RF24_1MBPS);
  radio.setChannel(CHANNEL);
  radio.openWritingPipe(PIPE);
  radio.stopListening();

  Serial.println("SENSOR_TX_READY");
}

void loop() {
  float temperature = dht.readTemperature();  // Celsius
  float humidity    = dht.readHumidity();     // %RH

  if (!isnan(temperature) && !isnan(humidity)) {
    snprintf(payload, sizeof(payload),
             "T:%.1fC H:%.0f%%", temperature, humidity);

    bool ok = radio.write(payload, strlen(payload) + 1);

    // Echo to browser Serial monitor
    Serial.print("TX:");
    Serial.print(payload);
    Serial.println(ok ? ":ACK" : ":FAIL");
  } else {
    Serial.println("DHT_ERR");
  }

  delay(SEND_INTERVAL_MS);
}
