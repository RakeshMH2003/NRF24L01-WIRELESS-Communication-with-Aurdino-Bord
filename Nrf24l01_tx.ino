/*
  ============================================================
  NRF24L01_TX.ino — Transmitter Sketch (Bridge Compatible)
  Upload to : Arduino UNO #1
  Library   : RF24 by TMRh20 (install via Library Manager)
  Baud Rate : 115200

  HOW TO USE WITH THE BROWSER SIMULATOR:
    1. Upload this sketch to your TX Arduino.
    2. Open the simulator in Chrome/Edge.
    3. Set mode to HARDWARE or BRIDGE.
    4. Click "CONNECT TX" and select this Arduino's COM port.
    5. Type a message and click TRANSMIT — the browser sends
       it via Web Serial → this Arduino → NRF24L01 → wireless.

  SERIAL PROTOCOL:
    Browser → Arduino : "<payload>\n"
    Arduino → Browser : "TX:<payload>:ACK\n"  or  "TX:<payload>:NOACK\n"

  NRF24L01 WIRING (3.3 V !):
    VCC  → 3.3V  (add 10µF cap between VCC & GND for stability)
    GND  → GND
    CE   → D9
    CSN  → D10
    SCK  → D13
    MOSI → D11
    MISO → D12
    IRQ  → (optional) D2
  ============================================================
*/

#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>

// ── Configuration ─────────────────────────────────────────
const uint64_t PIPE    = 0xE7E7E7E7E7LL;  // Must match RX
const uint8_t  CHANNEL = 76;              // 2.476 GHz
// ──────────────────────────────────────────────────────────

RF24  radio(9, 10);         // CE=D9, CSN=D10
char  payload[33];          // NRF max payload = 32 bytes

void setup() {
  Serial.begin(115200);

  radio.begin();
  radio.setPALevel(RF24_PA_HIGH);
  radio.setDataRate(RF24_1MBPS);
  radio.setChannel(CHANNEL);
  radio.openWritingPipe(PIPE);
  radio.stopListening();

  Serial.println("TX_READY");
}

void loop() {
  // Wait for a command from the browser (newline-terminated)
  if (Serial.available()) {
    int len = Serial.readBytesUntil('\n', payload, 32);
    payload[len] = '\0';

    // Transmit wirelessly
    bool ok = radio.write(payload, len + 1);

    // Echo result back to browser
    Serial.print("TX:");
    Serial.print(payload);
    Serial.println(ok ? ":ACK" : ":NOACK");
  }
}
