/* ═══════════════════════════════════════════════════════════════════════════
   NRF24L01 Hardware Bridge Simulator — script.js
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────────────────────────
let sent = 0, recv = 0, dropped = 0, bytes = 0, hwIn = 0, hwOut = 0;
let autoInterval  = null;
let packetCounter = 0;
let currentMode   = 'sim';

// Web Serial port handles
let txPort = null, txWriter = null, txReader = null, txReading = false;
let rxPort = null, rxWriter = null, rxReader = null, rxReading = false;

// ─── Timestamp ───────────────────────────────────────────────────────────────
function ts() {
  const n = new Date();
  return (
    String(n.getHours()).padStart(2, '0')   + ':' +
    String(n.getMinutes()).padStart(2, '0') + ':' +
    String(n.getSeconds()).padStart(2, '0') + '.' +
    String(n.getMilliseconds()).padStart(3, '0')
  );
}

// ─── Logging helpers ─────────────────────────────────────────────────────────
function log(elId, msg, cls = 'sys') {
  const el   = document.getElementById(elId);
  const line = document.createElement('span');
  line.className   = `log-line ${cls}`;
  line.textContent = msg;
  el.appendChild(line);
  el.appendChild(document.createTextNode('\n'));
  el.scrollTop = el.scrollHeight;
}

const txLog  = (m, c = 'tx')  => log('txSerial', m, c);
const rxLog  = (m, c = 'rx')  => log('rxSerial', m, c);

function rawLog(msg, cls = 'sys') {
  const el   = document.getElementById('rawLog');
  const line = document.createElement('span');
  line.className   = `log-line ${cls}`;
  line.textContent = msg;
  el.appendChild(line);
  el.appendChild(document.createTextNode('\n'));
  el.scrollTop = el.scrollHeight;
}

// ─── LED helper ──────────────────────────────────────────────────────────────
function flashLed(id, cls, dur = 300) {
  const el = document.getElementById(id);
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), dur);
}

// ─── Signal / animation helpers ──────────────────────────────────────────────
function setRSSI(val) {
  const pct = Math.round(val * 100);
  document.getElementById('rssiBar').style.width = pct + '%';
  const dbm = Math.round(-40 - (1 - val) * 55);
  document.getElementById('rssiLabel').textContent = `RSSI: ${dbm} dBm`;
}

function animateWaves(on) {
  document.getElementById('waveAnim').classList.toggle('active', on);
}

function flyPacket(msg) {
  const node = document.getElementById('packetNode');
  node.textContent   = msg.length > 8 ? msg.slice(0, 7) + '…' : msg;
  node.style.background = '#ff990033';
  node.style.color      = '#ff9900';
  node.style.border     = '1px solid #ff990066';
  node.classList.remove('flying');
  void node.offsetWidth; // force reflow to restart animation
  node.classList.add('flying');
}

// ─── Stats panel ─────────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('statSent').textContent  = sent;
  document.getElementById('statRecv').textContent  = recv;
  document.getElementById('statDrop').textContent  = dropped;
  document.getElementById('statBytes').textContent = bytes;
  document.getElementById('statHwIn').textContent  = hwIn;
  document.getElementById('statHwOut').textContent = hwOut;

  const rate   = sent > 0 ? ((recv / sent) * 100).toFixed(1) + '%' : '—';
  const rateEl = document.getElementById('statRate');
  rateEl.textContent = rate;
  rateEl.className   = 'stat-value' + (sent > 0 ? (recv / sent > 0.8 ? ' green' : ' red') : '');
}

// ─── Channel display update ───────────────────────────────────────────────────
function updateChannel() {
  const ch   = document.getElementById('chanInput').value;
  const freq = (2.400 + parseInt(ch || 0) * 0.001).toFixed(3);
  document.getElementById('freqDisplay').textContent = freq + ' GHz';
  document.getElementById('chanDisplay').textContent = ch;
}

// ─── Mode switcher ────────────────────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;

  // Toggle pill styles
  ['sim', 'hw', 'bridge'].forEach(m => {
    const id  = 'mode' + m.charAt(0).toUpperCase() + m.slice(1) + 'Btn';
    document.getElementById(id).classList.toggle('active', m === mode);
  });

  // Show/hide hardware panel
  document.getElementById('hwPanel').classList.toggle('visible', mode !== 'sim');

  // Mode display badge
  document.getElementById('modeDisplay').textContent =
    mode === 'sim' ? 'SIMULATION' : mode === 'hw' ? 'HARDWARE' : 'BRIDGE';

  // Board badges
  const txBadge = document.getElementById('txBoardBadge');
  const rxBadge = document.getElementById('rxBoardBadge');
  if (mode === 'sim') {
    txBadge.textContent = 'SIM'; txBadge.className = 'board-badge sim-badge';
    rxBadge.textContent = 'SIM'; rxBadge.className = 'board-badge sim-badge';
    document.getElementById('txHwTag').textContent = '';
    document.getElementById('rxHwTag').textContent = '';
  } else {
    txBadge.textContent = 'HW';  txBadge.className = 'board-badge hw-badge';
    rxBadge.textContent = 'HW';  rxBadge.className = 'board-badge hw-badge';
    document.getElementById('txHwTag').textContent = '[HARDWARE CONNECTED]';
    document.getElementById('rxHwTag').textContent = '[HARDWARE CONNECTED]';
  }

  // Check Web Serial support
  if (!('serial' in navigator)) {
    document.getElementById('noSerialWarn').classList.add('show');
  }
}

// ─── Web Serial — connect ─────────────────────────────────────────────────────
async function connectPort(side) {
  if (!('serial' in navigator)) {
    alert('Web Serial API not supported. Use Chrome or Edge (desktop).');
    return;
  }
  try {
    const baud = parseInt(document.getElementById(side + 'Baud').value);
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baud });

    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();

    if (side === 'tx') {
      txPort = port; txWriter = writer; txReader = reader;
      setPortStatus('tx', 'connected', 'Port open @ ' + baud + ' baud');
      document.getElementById('txBoard').classList.add('hw-linked');
      flashLed('txHwLed', 'on-green', 2000);
      txLog(`[${ts()}] 🔌 Hardware TX port connected (${baud} baud)`, 'hw');
    } else {
      rxPort = port; rxWriter = writer; rxReader = reader;
      setPortStatus('rx', 'connected', 'Port open @ ' + baud + ' baud');
      document.getElementById('rxBoard').classList.add('hw-linked');
      flashLed('rxHwLed', 'on-green', 2000);
      rxLog(`[${ts()}] 🔌 Hardware RX port connected (${baud} baud)`, 'hw');
    }

    toggleConnectBtns(side, true);
    startReading(side);

  } catch (e) {
    setPortStatus(side, 'error', e.message || 'Connection failed');
  }
}

// ─── Web Serial — disconnect ──────────────────────────────────────────────────
async function disconnectPort(side) {
  try {
    if (side === 'tx') {
      txReading = false;
      if (txReader) { try { await txReader.cancel(); } catch (_) {} txReader = null; }
      if (txWriter) { try { await txWriter.close();  } catch (_) {} txWriter = null; }
      if (txPort)   { try { await txPort.close();    } catch (_) {} txPort   = null; }
      setPortStatus('tx', '', 'Disconnected');
      document.getElementById('txBoard').classList.remove('hw-linked');
      document.getElementById('txHwLed').className = 'led-dot';
      txLog(`[${ts()}] 🔌 Hardware TX port disconnected`, 'warn');
    } else {
      rxReading = false;
      if (rxReader) { try { await rxReader.cancel(); } catch (_) {} rxReader = null; }
      if (rxWriter) { try { await rxWriter.close();  } catch (_) {} rxWriter = null; }
      if (rxPort)   { try { await rxPort.close();    } catch (_) {} rxPort   = null; }
      setPortStatus('rx', '', 'Disconnected');
      document.getElementById('rxBoard').classList.remove('hw-linked');
      document.getElementById('rxHwLed').className = 'led-dot';
      rxLog(`[${ts()}] 🔌 Hardware RX port disconnected`, 'warn');
    }
    toggleConnectBtns(side, false);
  } catch (e) {
    console.error('Disconnect error:', e);
  }
}

function setPortStatus(side, state, text) {
  const dot = document.getElementById(side + 'HwDot');
  const txt = document.getElementById(side + 'HwStatusText');
  dot.className = 'hw-dot' +
    (state === 'connected' ? ' connected' : state === 'error' ? ' error' : '');
  txt.textContent = text;
}

function toggleConnectBtns(side, connected) {
  document.getElementById(side + 'ConnectBtn').style.display    = connected ? 'none' : '';
  document.getElementById(side + 'DisconnectBtn').style.display = connected ? ''     : 'none';
}

// ─── Continuous read loop ────────────────────────────────────────────────────
async function startReading(side) {
  const isT = side === 'tx';
  if (isT) txReading = true; else rxReading = true;

  const reader  = isT ? txReader : rxReader;
  const decoder = new TextDecoder();
  let buffer    = '';

  try {
    while (isT ? txReading : rxReading) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        hwIn++;
        const logMsg = `[${ts()}] 🔌 HW← "${trimmed}"`;
        if (isT) txLog(logMsg, 'hw');
        else     rxLog(logMsg, 'hw');
        rawLog(`[${ts()}] ${side.toUpperCase()} ← "${trimmed}"`, 'hw');

        // In bridge mode: ripple RX hardware signal visually
        if (currentMode === 'bridge' && !isT) {
          animateWaves(true);
          setTimeout(() => animateWaves(false), 800);
          flashLed('rxRxLed', 'on-green', 300);
        }
        updateStats();
      }
    }
  } catch (e) {
    if (isT ? txReading : rxReading) {
      setPortStatus(side, 'error', 'Read error: ' + e.message);
    }
  }
}

// ─── Write to hardware port ───────────────────────────────────────────────────
async function writeToPort(side, text) {
  const writer = side === 'tx' ? txWriter : rxWriter;
  if (!writer) return false;
  try {
    await writer.write(new TextEncoder().encode(text + '\n'));
    hwOut++;
    updateStats();
    return true;
  } catch (e) {
    rawLog(`[${ts()}] ERROR writing to ${side.toUpperCase()}: ${e.message}`, 'err');
    return false;
  }
}

// ─── Raw serial send ─────────────────────────────────────────────────────────
async function sendRaw() {
  const cmd    = document.getElementById('rawInput').value.trim();
  const target = document.getElementById('rawTarget').value;
  if (!cmd) return;

  rawLog(`[${ts()}] ${target.toUpperCase()} → "${cmd}"`, 'tx');
  const ok = await writeToPort(target, cmd);
  if (!ok) rawLog('  [!] Port not connected — command not sent', 'err');
  document.getElementById('rawInput').value = '';
}

// ─── Transmit packet (simulation + optional hardware) ────────────────────────
async function sendPacket() {
  const msg     = document.getElementById('msgInput').value.trim().slice(0, 32);
  if (!msg) return;

  const noise   = parseFloat(document.getElementById('noiseSelect').value);
  const channel = document.getElementById('chanInput').value;
  const pktId   = ++packetCounter;
  const tsnow   = ts();
  const rssi    = 0.6 + Math.random() * 0.4 - noise * 0.4;
  const latency = Math.round(1 + Math.random() * 8 + noise * 20);

  sent++;
  bytes += msg.length;

  // ── TX LEDs ──
  flashLed('txSpiLed', 'on-blue',   200);
  setTimeout(() => flashLed('txTxLed', 'on-orange', 400), 100);

  // ── TX log ──
  const payloadClass = (msg.startsWith('LED') || msg.startsWith('SERVO') || msg.startsWith('RELAY'))
    ? 'warn' : 'tx';
  txLog(`[${tsnow}] >> Packet #${pktId}`, 'info');
  txLog(`  Payload : "${msg}"`, payloadClass);
  txLog(`  Size    : ${msg.length} bytes`, 'tx');
  txLog(`  Channel : ${channel}`, 'tx');
  txLog(`  CE HIGH → SPI write → CE LOW`, 'sys');

  // ── If hardware TX connected, forward to real board ──
  if ((currentMode === 'hw' || currentMode === 'bridge') && txWriter) {
    const ok = await writeToPort('tx', msg);
    txLog(ok ? '  🔌 Forwarded to HW TX port' : '  ⚠ TX port not connected', ok ? 'hw' : 'warn');
  }

  // ── RF animation ──
  animateWaves(true);
  flyPacket(msg);
  setRSSI(rssi);
  setTimeout(() => animateWaves(false), 1200);

  // ── Packet drop logic (only in sim / bridge modes) ──
  const isDropped = (currentMode === 'sim' || currentMode === 'bridge') && Math.random() < noise;

  setTimeout(async () => {
    if (isDropped) {
      dropped++;
      txLog('  [!] No ACK — packet DROPPED', 'err');
      rxLog(`[${ts()}] -- No signal (dropped)`, 'err');
      flashLed('txAckLed', 'on-orange', 200);
    } else {
      recv++;
      const rxTs = ts();

      // RX LEDs
      flashLed('rxSpiLed', 'on-blue',   200);
      setTimeout(() => flashLed('rxRxLed',  'on-green', 500), 100);
      setTimeout(() => flashLed('rxAckLed', 'on-green', 300), 400);
      setTimeout(() => flashLed('txAckLed', 'on-green', 300), 600);

      rxLog(`[${rxTs}] << Packet #${pktId} received`, 'info');
      rxLog(`  Data    : "${msg}"`, 'rx');
      rxLog(`  RSSI    : ${Math.round(-40 - (1 - rssi) * 55)} dBm`, 'rx');
      rxLog(`  Latency : ~${latency} ms`, 'rx');
      rxLog('  ACK sent ✓', 'sys');
      txLog(`  ACK received ✓ (${latency}ms)`, 'sys');
      document.getElementById('statLatency').textContent = latency + ' ms';

      // Bridge: also forward to RX hardware
      if ((currentMode === 'hw' || currentMode === 'bridge') && rxWriter) {
        const ok = await writeToPort('rx', msg);
        rxLog(ok ? '  🔌 Forwarded to HW RX port' : '  ⚠ RX port not connected', ok ? 'hw' : 'warn');
      }
    }
    updateStats();
  }, latency + 800);
}

// ─── Auto-transmit ───────────────────────────────────────────────────────────
function toggleAuto() {
  const btn = document.getElementById('autoBtn');
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
    btn.textContent = '⟳ AUTO';
    btn.classList.remove('running');
  } else {
    btn.textContent = '⏹ STOP';
    btn.classList.add('running');
    autoInterval = setInterval(sendPacket, 2000);
    sendPacket(); // fire immediately
  }
}

// ─── Preset messages ─────────────────────────────────────────────────────────
function applyPreset() {
  const v = document.getElementById('presetSelect').value;
  if (v) document.getElementById('msgInput').value = v;
}

// ─── Clear logs ───────────────────────────────────────────────────────────────
function clearLogs() {
  document.getElementById('txSerial').innerHTML = '';
  document.getElementById('rxSerial').innerHTML = '';
  document.getElementById('rawLog').innerHTML   = '';
  sent = recv = dropped = bytes = hwIn = hwOut = packetCounter = 0;
  document.getElementById('statLatency').textContent = '—';
  setRSSI(0);
  updateStats();
  init();
}

// ─── Arduino sketch viewer ────────────────────────────────────────────────────
function showSketch(key, btn) {
  document.querySelectorAll('.sketch-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('sketchCode').innerHTML = sketches[key];
}

// ─── Boot sequence ────────────────────────────────────────────────────────────
function init() {
  document.getElementById('txPowerLed').classList.add('on-green');
  document.getElementById('rxPowerLed').classList.add('on-green');

  txLog('[BOOT] Arduino UNO — TX', 'info');
  txLog('  RF24 radio.begin()', 'sys');
  txLog('  setPALevel(RF24_PA_HIGH)', 'sys');
  txLog('  setDataRate(RF24_1MBPS)', 'sys');
  txLog('  openWritingPipe(0xE7E7E7E7E7)', 'sys');
  txLog('  stopListening()', 'sys');
  txLog('  >> Ready to transmit', 'tx');

  rxLog('[BOOT] Arduino UNO — RX', 'info');
  rxLog('  RF24 radio.begin()', 'sys');
  rxLog('  setPALevel(RF24_PA_HIGH)', 'sys');
  rxLog('  setDataRate(RF24_1MBPS)', 'sys');
  rxLog('  openReadingPipe(1, 0xE7E7E7E7E7)', 'sys');
  rxLog('  startListening()', 'sys');
  rxLog('  << Listening for packets...', 'rx');
}

// ─── Page ready ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sketchCode').innerHTML = sketches.tx;
  init();
});