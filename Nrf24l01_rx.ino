/*
  ============================================================
  NRF24L01_RX.ino — Receiver Sketch (Bridge Compatible)
  Upload to : Arduino UNO #2
  Libraries : RF24 by TMRh20 · Servo (built-in)
  Baud Rate : 115200

  HOW TO USE WITH THE BROWSER SIMULATOR:
    1. Upload this sketch to your RX Arduino.
    2. Open the simulator in Chrome/Edge.
    3. Set mode to HARDWARE or BRIDGE.
    4. Click "CONNECT RX" and select this Arduino's COM port.
    5. Packets received wirelessly appear in the RX Serial Monitor.
    6. Use the Raw I/O panel to send commands directly.

  SERIAL OUTPUT (Arduino → Browser):
    "RX:<payload>\n"   — wireless packet received
    "CMD:<cmd>\n"      — serial command echoed back

  SUPPORTED WIRELESS COMMANDS:
    LED_ON   → turn on built-in LED (pin 13)
    LED_OFF  → turn off built-in LED
    RELAY:1  → energise relay on D7 (HIGH)
    RELAY:0  → de-energise relay on D7 (LOW)
    SERVO:XX → move servo on D6 to angle XX (0–180)
    PING     → echoes PONG back to Serial

  ADD YOUR OWN ACTUATORS in handleCommand() below.

  NRF24L01 WIRING (3.3 V !):
    VCC  → 3.3V  (add 10µF cap between VCC & GND for stability)
    GND  → GND
    CE   → D9
    CSN  → D10
    SCK  → D13
    MOSI → D11
    MISO → D12
    IRQ  → (optional) D2

  OPTIONAL ACTUATOR WIRING:
    Relay module signal → D7
    Servo signal pin    → D6
  ============================================================
*/

#include <SPI.h>
#include <nRF24L01.h>
#include <RF24.h>
#include <Servo.h>

// ── Configuration ─────────────────────────────────────────
const uint64_t PIPE      = 0xE7E7E7E7E7LL; // Must match TX
const uint8_t  CHANNEL   = 76;
const uint8_t  RELAY_PIN = 7;
const uint8_t  SERVO_PIN = 6;
// ──────────────────────────────────────────────────────────

RF24   radio(9, 10);
Servo  myServo;
char   payload[33];

// ── Command dispatcher ────────────────────────────────────
void handleCommand(const char* cmd) {
  if      (strcmp(cmd, "LED_ON")  == 0) digitalWrite(LED_BUILTIN, HIGH);
  else if (strcmp(cmd, "LED_OFF") == 0) digitalWrite(LED_BUILTIN, LOW);
  else if (strcmp(cmd, "RELAY:1") == 0) digitalWrite(RELAY_PIN, HIGH);
  else if (strcmp(cmd, "RELAY:0") == 0) digitalWrite(RELAY_PIN, LOW);
  else if (strcmp(cmd, "PING")    == 0) Serial.println("PONG");
  else if (strncmp(cmd, "SERVO:", 6) == 0) {
    int angle = atoi(cmd + 6);
    myServo.write(constrain(angle, 0, 180));
    Serial.print("SERVO_SET:"); Serial.println(angle);
  }
  // ── Add your custom commands below ──
  // else if (strcmp(cmd, "BUZZER:ON") == 0) { ... }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(RELAY_PIN,   OUTPUT);
  myServo.attach(SERVO_PIN);

  radio.begin();
  radio.setPALevel(RF24_PA_HIGH);
  radio.setDataRate(RF24_1MBPS);
  radio.setChannel(CHANNEL);
  radio.openReadingPipe(1, PIPE);
  radio.startListening();

  Serial.println("RX_READY");
}

void loop() {
  // ── Wireless receive ──────────────────────────────────
  if (radio.available()) {
    radio.read(payload, sizeof(payload));
    Serial.print("RX:"); Serial.println(payload);
    handleCommand(payload);
  }

  // ── Serial receive (from browser Raw panel) ───────────
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      Serial.print("CMD:"); Serial.println(cmd);
      handleCommand(cmd.c_str());
    }
  }
}
