/* ═══════════════════════════════════════════════════════════════════════════
   NRF24L01 Hardware Bridge Simulator — sketches.js
   Holds syntax-highlighted Arduino sketch HTML strings for the in-page viewer.
   Include this BEFORE script.js in index.html.
   ═══════════════════════════════════════════════════════════════════════════ */

const sketches = {

  /* ── TX SKETCH ──────────────────────────────────────────────────────────── */
  tx: `<span class="c-comment">/*
  NRF24L01 TX Sketch — Bridge Compatible
  Upload to Arduino UNO #1 (Transmitter)
  Library : RF24 by TMRh20
  Baud    : 115200

  HOW IT WORKS:
    - Waits for a newline-terminated command on Serial
      (sent by the browser via Web Serial API).
    - Transmits that payload wirelessly via NRF24L01.
    - Echoes TX:&lt;payload&gt;:ACK or TX:&lt;payload&gt;:NOACK back to Serial.
*/</span>

<span class="c-macro">#include</span> <span class="c-string">&lt;SPI.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;nRF24L01.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;RF24.h&gt;</span>

<span class="c-keyword">const</span> <span class="c-keyword">uint64_t</span> PIPE    = <span class="c-num">0xE7E7E7E7E7LL</span>;
<span class="c-keyword">const</span> <span class="c-keyword">uint8_t</span>  CHANNEL = <span class="c-num">76</span>;

RF24  radio(<span class="c-num">9</span>, <span class="c-num">10</span>);   <span class="c-comment">// CE=D9, CSN=D10</span>
<span class="c-keyword">char</span> payload[<span class="c-num">33</span>];     <span class="c-comment">// NRF max payload = 32 bytes + null</span>

<span class="c-keyword">void</span> <span class="c-func">setup</span>() {
  Serial.<span class="c-func">begin</span>(<span class="c-num">115200</span>);

  radio.<span class="c-func">begin</span>();
  radio.<span class="c-func">setPALevel</span>(RF24_PA_HIGH);
  radio.<span class="c-func">setDataRate</span>(RF24_1MBPS);
  radio.<span class="c-func">setChannel</span>(CHANNEL);
  radio.<span class="c-func">openWritingPipe</span>(PIPE);
  radio.<span class="c-func">stopListening</span>();

  Serial.<span class="c-func">println</span>(<span class="c-string">"TX_READY"</span>);
}

<span class="c-keyword">void</span> <span class="c-func">loop</span>() {
  <span class="c-comment">// Read command from browser (newline-terminated)</span>
  <span class="c-keyword">if</span> (Serial.<span class="c-func">available</span>()) {
    <span class="c-keyword">int</span> len = Serial.<span class="c-func">readBytesUntil</span>(<span class="c-string">'\n'</span>, payload, <span class="c-num">32</span>);
    payload[len] = <span class="c-string">'\0'</span>;

    <span class="c-keyword">bool</span> ok = radio.<span class="c-func">write</span>(payload, len + <span class="c-num">1</span>);

    Serial.<span class="c-func">print</span>(<span class="c-string">"TX:"</span>);
    Serial.<span class="c-func">print</span>(payload);
    Serial.<span class="c-func">println</span>(ok ? <span class="c-string">":ACK"</span> : <span class="c-string">":NOACK"</span>);
  }
}`,

  /* ── RX SKETCH ──────────────────────────────────────────────────────────── */
  rx: `<span class="c-comment">/*
  NRF24L01 RX Sketch — Bridge Compatible
  Upload to Arduino UNO #2 (Receiver)
  Library : RF24 by TMRh20
  Baud    : 115200

  HOW IT WORKS:
    - Listens on the NRF24L01 for wireless packets.
    - Prints RX:&lt;payload&gt; to Serial (visible in browser).
    - Parses known commands (LED_ON, LED_OFF, RELAY:x, SERVO:x).
    - Also echoes any raw Serial commands sent by the browser.
*/</span>

<span class="c-macro">#include</span> <span class="c-string">&lt;SPI.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;nRF24L01.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;RF24.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;Servo.h&gt;</span>

<span class="c-keyword">const</span> <span class="c-keyword">uint64_t</span> PIPE     = <span class="c-num">0xE7E7E7E7E7LL</span>;
<span class="c-keyword">const</span> <span class="c-keyword">uint8_t</span>  CHANNEL  = <span class="c-num">76</span>;
<span class="c-keyword">const</span> <span class="c-keyword">uint8_t</span>  RELAY_PIN = <span class="c-num">7</span>;
<span class="c-keyword">const</span> <span class="c-keyword">uint8_t</span>  SERVO_PIN = <span class="c-num">6</span>;

RF24  radio(<span class="c-num">9</span>, <span class="c-num">10</span>);
Servo myServo;
<span class="c-keyword">char</span> payload[<span class="c-num">33</span>];

<span class="c-keyword">void</span> <span class="c-func">setup</span>() {
  Serial.<span class="c-func">begin</span>(<span class="c-num">115200</span>);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(RELAY_PIN,   OUTPUT);
  myServo.<span class="c-func">attach</span>(SERVO_PIN);

  radio.<span class="c-func">begin</span>();
  radio.<span class="c-func">setPALevel</span>(RF24_PA_HIGH);
  radio.<span class="c-func">setDataRate</span>(RF24_1MBPS);
  radio.<span class="c-func">setChannel</span>(CHANNEL);
  radio.<span class="c-func">openReadingPipe</span>(<span class="c-num">1</span>, PIPE);
  radio.<span class="c-func">startListening</span>();

  Serial.<span class="c-func">println</span>(<span class="c-string">"RX_READY"</span>);
}

<span class="c-keyword">void</span> <span class="c-func">handleCommand</span>(<span class="c-keyword">const char</span>* cmd) {
  <span class="c-keyword">if</span>      (<span class="c-func">strcmp</span>(cmd, <span class="c-string">"LED_ON"</span>)  == <span class="c-num">0</span>) digitalWrite(LED_BUILTIN, HIGH);
  <span class="c-keyword">else if</span> (<span class="c-func">strcmp</span>(cmd, <span class="c-string">"LED_OFF"</span>) == <span class="c-num">0</span>) digitalWrite(LED_BUILTIN, LOW);
  <span class="c-keyword">else if</span> (<span class="c-func">strcmp</span>(cmd, <span class="c-string">"RELAY:1"</span>) == <span class="c-num">0</span>) digitalWrite(RELAY_PIN, HIGH);
  <span class="c-keyword">else if</span> (<span class="c-func">strcmp</span>(cmd, <span class="c-string">"RELAY:0"</span>) == <span class="c-num">0</span>) digitalWrite(RELAY_PIN, LOW);
  <span class="c-keyword">else if</span> (<span class="c-func">strncmp</span>(cmd, <span class="c-string">"SERVO:"</span>, <span class="c-num">6</span>) == <span class="c-num">0</span>) {
    <span class="c-keyword">int</span> angle = <span class="c-func">atoi</span>(cmd + <span class="c-num">6</span>);
    myServo.<span class="c-func">write</span>(<span class="c-func">constrain</span>(angle, <span class="c-num">0</span>, <span class="c-num">180</span>));
  }
  <span class="c-comment">// Add more commands here…</span>
}

<span class="c-keyword">void</span> <span class="c-func">loop</span>() {
  <span class="c-comment">// ── Wireless receive ──</span>
  <span class="c-keyword">if</span> (radio.<span class="c-func">available</span>()) {
    radio.<span class="c-func">read</span>(payload, <span class="c-keyword">sizeof</span>(payload));
    Serial.<span class="c-func">print</span>(<span class="c-string">"RX:"</span>);
    Serial.<span class="c-func">println</span>(payload);
    <span class="c-func">handleCommand</span>(payload);
  }

  <span class="c-comment">// ── Serial receive (from browser Raw panel) ──</span>
  <span class="c-keyword">if</span> (Serial.<span class="c-func">available</span>()) {
    String cmd = Serial.<span class="c-func">readStringUntil</span>(<span class="c-string">'\n'</span>);
    cmd.<span class="c-func">trim</span>();
    Serial.<span class="c-func">print</span>(<span class="c-string">"CMD:"</span>); Serial.<span class="c-func">println</span>(cmd);
    <span class="c-func">handleCommand</span>(cmd.<span class="c-func">c_str</span>());
  }
}`,

  /* ── SENSOR TX SKETCH ───────────────────────────────────────────────────── */
  sensor: `<span class="c-comment">/*
  NRF24L01 Sensor TX Sketch
  Reads DHT22 (temp + humidity) and sends wirelessly every 2 s.
  Upload to Arduino UNO #1 (Sensor node / TX).
  Libraries: RF24 by TMRh20 · DHT sensor library by Adafruit
  Baud: 115200

  Wiring:
    DHT22 DATA → A0
    NRF24L01   → standard SPI (CE=D9, CSN=D10)

  Output format on RX: "T:28.5C H:62%"
  Output on Serial   : "TX:T:28.5C H:62%:ACK"
*/</span>

<span class="c-macro">#include</span> <span class="c-string">&lt;SPI.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;nRF24L01.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;RF24.h&gt;</span>
<span class="c-macro">#include</span> <span class="c-string">&lt;DHT.h&gt;</span>

<span class="c-macro">#define</span> DHT_PIN   A0
<span class="c-macro">#define</span> DHT_TYPE  DHT22

<span class="c-keyword">const</span> <span class="c-keyword">uint64_t</span> PIPE    = <span class="c-num">0xE7E7E7E7E7LL</span>;
<span class="c-keyword">const</span> <span class="c-keyword">uint8_t</span>  CHANNEL = <span class="c-num">76</span>;

RF24  radio(<span class="c-num">9</span>, <span class="c-num">10</span>);
DHT   dht(DHT_PIN, DHT_TYPE);
<span class="c-keyword">char</span>  payload[<span class="c-num">33</span>];

<span class="c-keyword">void</span> <span class="c-func">setup</span>() {
  Serial.<span class="c-func">begin</span>(<span class="c-num">115200</span>);
  dht.<span class="c-func">begin</span>();

  radio.<span class="c-func">begin</span>();
  radio.<span class="c-func">setPALevel</span>(RF24_PA_HIGH);
  radio.<span class="c-func">setDataRate</span>(RF24_1MBPS);
  radio.<span class="c-func">setChannel</span>(CHANNEL);
  radio.<span class="c-func">openWritingPipe</span>(PIPE);
  radio.<span class="c-func">stopListening</span>();

  Serial.<span class="c-func">println</span>(<span class="c-string">"SENSOR_TX_READY"</span>);
}

<span class="c-keyword">void</span> <span class="c-func">loop</span>() {
  <span class="c-keyword">float</span> t = dht.<span class="c-func">readTemperature</span>();   <span class="c-comment">// °C</span>
  <span class="c-keyword">float</span> h = dht.<span class="c-func">readHumidity</span>();       <span class="c-comment">// %RH</span>

  <span class="c-keyword">if</span> (!<span class="c-func">isnan</span>(t) &amp;&amp; !<span class="c-func">isnan</span>(h)) {
    <span class="c-func">snprintf</span>(payload, <span class="c-keyword">sizeof</span>(payload),
             <span class="c-string">"T:%.1fC H:%.0f%%"</span>, t, h);

    <span class="c-keyword">bool</span> ok = radio.<span class="c-func">write</span>(payload, <span class="c-func">strlen</span>(payload) + <span class="c-num">1</span>);
    Serial.<span class="c-func">print</span>(<span class="c-string">"TX:"</span>);
    Serial.<span class="c-func">print</span>(payload);
    Serial.<span class="c-func">println</span>(ok ? <span class="c-string">":ACK"</span> : <span class="c-string">":FAIL"</span>);
  } <span class="c-keyword">else</span> {
    Serial.<span class="c-func">println</span>(<span class="c-string">"DHT_ERR"</span>);
  }

  <span class="c-func">delay</span>(<span class="c-num">2000</span>);
}`

}; // end sketches