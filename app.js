import {
  createPulsePattern,
  createShareUrl,
  decodeShareState,
  DEFAULT_TEXT,
  encodeShareState,
  MODES,
  patternToShareText
} from "./src/pulse.js";

const elements = {
  input: document.querySelector("#poemInput"),
  modeTabs: document.querySelector("#modeTabs"),
  generateButton: document.querySelector("#generateButton"),
  playButton: document.querySelector("#playButton"),
  sampleButton: document.querySelector("#sampleButton"),
  soundTestButton: document.querySelector("#soundTestButton"),
  copyButton: document.querySelector("#copyButton"),
  copyLinkButton: document.querySelector("#copyLinkButton"),
  downloadButton: document.querySelector("#downloadButton"),
  soundToggle: document.querySelector("#soundToggle"),
  vibrateToggle: document.querySelector("#vibrateToggle"),
  supportStatus: document.querySelector("#supportStatus"),
  pulseCount: document.querySelector("#pulseCount"),
  durationReadout: document.querySelector("#durationReadout"),
  signatureReadout: document.querySelector("#signatureReadout"),
  timeline: document.querySelector("#timeline"),
  canvas: document.querySelector("#pulseCanvas")
};

const samples = [
  "rain on glass, one bright idea",
  "coffee sparks a tiny plan",
  "moon bus, late stop, neon shoes",
  "build less, finish more, ship it"
];

let selectedMode = "bright";
let pattern = createPulsePattern(DEFAULT_TEXT, selectedMode);
let activePulse = -1;
let playbackTimers = [];
let audioContext;
let sampleIndex = 0;
let fallbackAudioNoted = false;

const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
const fallbackTickUrls = new Map();
const AUDIO_WARMUP_TIMEOUT_MS = 280;

function getCanvasContext() {
  const canvas = elements.canvas;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function drawPattern() {
  const { context, width, height } = getCanvasContext();
  context.clearRect(0, 0, width, height);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#17150f");
  gradient.addColorStop(0.55, "#27221b");
  gradient.addColorStop(1, "#0d2c2a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.globalAlpha = 0.18;
  context.strokeStyle = "#fff6dc";
  for (let x = 34; x < width; x += 68) {
    context.beginPath();
    context.moveTo(x, 22);
    context.lineTo(x, height - 22);
    context.stroke();
  }
  context.globalAlpha = 1;

  const maxTime = Math.max(pattern.totalDuration, 1);
  const edgePad = width < 700 ? Math.min(96, width * 0.25) : 56;

  pattern.pulses.forEach((pulse, index) => {
    const x = edgePad + (pulse.start / maxTime) * Math.max(1, width - edgePad * 2);
    const lane = index % 3;
    const y = height * (0.32 + lane * 0.2);
    const radius = (width < 700 ? 10 : 12) + pulse.intensity * (width < 700 ? 18 : 28);
    const isActive = index === activePulse;

    context.beginPath();
    context.fillStyle = isActive ? "#de6f52" : index % 2 === 0 ? "#3f9a82" : "#d6a646";
    context.globalAlpha = isActive ? 0.95 : 0.72;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    context.beginPath();
    context.strokeStyle = isActive ? "#fff5de" : "#fff1cf";
    context.lineWidth = isActive ? 5 : 2;
    context.globalAlpha = isActive ? 0.9 : 0.34;
    context.arc(x, y, radius + 8, 0, Math.PI * 2);
    context.stroke();

    context.globalAlpha = 1;
    context.fillStyle = "#fff8e8";
    context.font = "700 13px system-ui, sans-serif";
    context.textAlign = "center";
    const label = pulse.token.slice(0, 10);
    const labelWidth = context.measureText(label).width;
    const labelX = Math.min(width - 10 - labelWidth / 2, Math.max(10 + labelWidth / 2, x));
    context.fillText(label, labelX, Math.min(height - 22, y + radius + 26));
  });
}

function renderTimeline() {
  elements.timeline.replaceChildren();
  for (const pulse of pattern.pulses) {
    const card = document.createElement("div");
    card.className = "pulse-card";
    card.dataset.index = String(pulse.id);
    card.innerHTML = `
      <b>${escapeHtml(pulse.token)}</b>
      <span>${pulse.duration}ms / ${Math.round(pulse.intensity * 100)}%</span>
    `;
    elements.timeline.append(card);
  }
}

function renderStats() {
  elements.pulseCount.textContent = String(pattern.pulses.length);
  elements.durationReadout.textContent = `${(pattern.totalDuration / 1000).toFixed(1)}s`;
  elements.signatureReadout.textContent = pattern.signature;
}

function renderModeTabs() {
  elements.modeTabs.querySelectorAll("button").forEach((button) => {
    const isActive = button.dataset.mode === selectedMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.textContent = MODES[button.dataset.mode].label;
  });
}

function renderSupportStatus(message) {
  if (message) {
    elements.supportStatus.textContent = message;
    return;
  }
  const audio = AudioContextCtor ? "web audio" : typeof Audio === "function" ? "html audio" : "visual only";
  const vibration = "vibrate" in navigator ? "vibration ready" : "visual rhythm";
  elements.supportStatus.textContent = `${audio} + ${vibration}`;
}

function setActivePulse(index) {
  activePulse = index;
  elements.timeline.querySelectorAll(".pulse-card").forEach((card) => {
    card.classList.toggle("is-active", Number(card.dataset.index) === index);
  });
  drawPattern();
}

function regenerate() {
  pattern = createPulsePattern(elements.input.value, selectedMode);
  window.history.replaceState(null, "", encodeShareState(pattern.source, selectedMode));
  renderStats();
  renderTimeline();
  setActivePulse(-1);
}

function resetPlayback() {
  playbackTimers.forEach((timer) => clearTimeout(timer));
  playbackTimers = [];
  elements.playButton.disabled = false;
  elements.playButton.textContent = "Play";
  setActivePulse(-1);
}

function ensureAudioContext() {
  if (!AudioContextCtor) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  return audioContext;
}

async function warmAudio() {
  if (!elements.soundToggle.checked || !AudioContextCtor) {
    return;
  }

  try {
    const context = ensureAudioContext();
    if (context?.state === "suspended") {
      const result = await Promise.race([
        context.resume().then(() => "ready"),
        new Promise((resolve) => window.setTimeout(() => resolve("timeout"), AUDIO_WARMUP_TIMEOUT_MS))
      ]);
      if (result === "timeout") {
        renderSupportStatus(typeof Audio === "function" ? "using html audio" : "visual rhythm");
      }
    }
  } catch {
    renderSupportStatus(typeof Audio === "function" ? "using html audio" : "sound unavailable");
  }
}

function playTick(pulse) {
  if (!elements.soundToggle.checked) {
    return;
  }

  try {
    const context = ensureAudioContext();
    if (context) {
      if (context.state === "suspended") {
        playFallbackTick(pulse);
        return;
      }
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = pulse.accent ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(pulse.pitch, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12 + pulse.intensity * 0.16, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.18, pulse.duration / 1000));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + Math.min(0.22, pulse.duration / 1000 + 0.04));
      return;
    }
  } catch {
    audioContext = null;
  }

  playFallbackTick(pulse);
}

function playFallbackTick(pulse) {
  if (typeof Audio !== "function") {
    renderSupportStatus("sound unavailable");
    return;
  }

  if (!fallbackAudioNoted) {
    renderSupportStatus("using html audio");
    fallbackAudioNoted = true;
  }

  const audio = new Audio(getFallbackTickUrl(pulse));
  audio.volume = Math.min(0.75, 0.18 + pulse.intensity * 0.42);
  audio.play().catch(() => {
    renderSupportStatus("tap again for sound");
  });
}

function getFallbackTickUrl(pulse) {
  const key = `${Math.round(pulse.pitch / 20) * 20}-${Math.round(pulse.duration / 20) * 20}`;
  if (!fallbackTickUrls.has(key)) {
    fallbackTickUrls.set(key, URL.createObjectURL(buildTickWave(pulse.pitch, pulse.duration)));
  }
  return fallbackTickUrls.get(key);
}

function buildTickWave(frequency, durationMs) {
  const sampleRate = 11025;
  const duration = Math.min(0.22, Math.max(0.07, durationMs / 1000));
  const sampleCount = Math.floor(sampleRate * duration);
  const bytes = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(bytes);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.exp(-16 * time);
    const sample = Math.sin(2 * Math.PI * frequency * time) * envelope * 0.45;
    view.setInt16(44 + index * 2, sample * 32767, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function vibrate(pulse) {
  if (!elements.vibrateToggle.checked || !("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(Math.min(180, pulse.duration));
}

async function playPattern() {
  resetPlayback();
  await warmAudio();
  elements.playButton.disabled = true;
  elements.playButton.textContent = "Playing";

  for (const pulse of pattern.pulses) {
    playbackTimers.push(
      setTimeout(() => {
        setActivePulse(pulse.id);
        playTick(pulse);
        vibrate(pulse);
      }, pulse.start)
    );
  }

  playbackTimers.push(
    setTimeout(() => {
      resetPlayback();
      renderSupportStatus("played once");
    }, pattern.totalDuration + 260)
  );
}

async function testSound() {
  await warmAudio();
  const pulse = pattern.pulses[0];
  renderSupportStatus("testing sound");
  setActivePulse(pulse.id);
  playTick(pulse);
  vibrate(pulse);
  window.setTimeout(() => {
    setActivePulse(-1);
    renderSupportStatus();
  }, Math.min(420, pulse.duration + 180));
}

async function copyScore() {
  const text = patternToShareText(pattern);
  try {
    await navigator.clipboard.writeText(text);
    renderSupportStatus("score copied");
  } catch {
    if (!copyWithTextarea(text)) {
      downloadScoreText(text);
      renderSupportStatus("score downloaded");
      return;
    }

    renderSupportStatus("score copied");
  }
}

async function copyShareLink() {
  const url = createShareUrl(window.location.href, pattern.source, selectedMode);
  try {
    await navigator.clipboard.writeText(url);
    renderSupportStatus("link copied");
  } catch {
    renderSupportStatus(copyWithTextarea(url) ? "link copied" : "link unavailable");
  }
}

function copyWithTextarea(text) {
  const helper = document.createElement("textarea");
  try {
    helper.value = text;
    document.body.append(helper);
    helper.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    helper.remove();
  }
}

function downloadScore() {
  downloadScoreText(patternToShareText(pattern));
  renderSupportStatus("score downloaded");
}

function downloadScoreText(text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pulse-poem-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.modeTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-mode]");
  if (!button) {
    return;
  }
  selectedMode = button.dataset.mode;
  renderModeTabs();
  regenerate();
});

elements.generateButton.addEventListener("click", regenerate);
elements.playButton.addEventListener("click", playPattern);
elements.copyButton.addEventListener("click", copyScore);
elements.copyLinkButton.addEventListener("click", copyShareLink);
elements.downloadButton.addEventListener("click", downloadScore);
elements.soundTestButton.addEventListener("click", testSound);
elements.sampleButton.addEventListener("click", () => {
  sampleIndex = (sampleIndex + 1) % samples.length;
  elements.input.value = samples[sampleIndex];
  regenerate();
});
elements.input.addEventListener("input", () => {
  window.clearTimeout(elements.input.pendingTimer);
  elements.input.pendingTimer = window.setTimeout(regenerate, 180);
});
window.addEventListener("resize", drawPattern);

const shared = decodeShareState(window.location.hash);
selectedMode = shared.mode;
elements.input.value = shared.text;
pattern = createPulsePattern(shared.text, selectedMode);
renderModeTabs();
renderSupportStatus();
renderStats();
renderTimeline();
drawPattern();
