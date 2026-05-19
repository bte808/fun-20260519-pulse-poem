import {
  createPulsePattern,
  decodeShareState,
  DEFAULT_TEXT,
  encodeShareState,
  MODES,
  patternToTapScore
} from "./src/pulse.js";

const elements = {
  input: document.querySelector("#poemInput"),
  modeTabs: document.querySelector("#modeTabs"),
  generateButton: document.querySelector("#generateButton"),
  playButton: document.querySelector("#playButton"),
  sampleButton: document.querySelector("#sampleButton"),
  copyButton: document.querySelector("#copyButton"),
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
  const vibration = "vibrate" in navigator ? "vibration ready" : "visual rhythm";
  elements.supportStatus.textContent = vibration;
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
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTick(pulse) {
  if (!elements.soundToggle.checked) {
    return;
  }

  const context = ensureAudioContext();
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
}

function vibrate(pulse) {
  if (!elements.vibrateToggle.checked || !("vibrate" in navigator)) {
    return;
  }
  navigator.vibrate(Math.min(180, pulse.duration));
}

function playPattern() {
  resetPlayback();
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

async function copyScore() {
  const text = `${pattern.source}\n${pattern.modeLabel}: ${pattern.signature}\n${patternToTapScore(pattern)}`;
  try {
    await navigator.clipboard.writeText(text);
    renderSupportStatus("score copied");
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    renderSupportStatus("score copied");
  }
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
