export const DEFAULT_TEXT = "rain on glass, one bright idea";

export const MODES = {
  calm: {
    label: "Calm",
    base: 118,
    syllable: 34,
    gap: 72,
    pause: 190,
    swing: 0.84,
    pitch: 380
  },
  bright: {
    label: "Bright",
    base: 96,
    syllable: 26,
    gap: 48,
    pause: 132,
    swing: 1.06,
    pitch: 540
  },
  drumline: {
    label: "Drumline",
    base: 86,
    syllable: 42,
    gap: 42,
    pause: 110,
    swing: 1.24,
    pitch: 240
  }
};

const PUNCTUATION_PAUSES = new Map([
  [".", 2.2],
  ["!", 2.2],
  ["?", 2.2],
  [",", 1.35],
  [";", 1.7],
  [":", 1.7],
  ["-", 1.25],
  ["--", 1.55],
  ["(", 1.05],
  [")", 1.3]
]);

const unicodeTokenPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|--|[^\s\p{L}\p{N}]/gu;

export function normalizeText(text) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length ? clean.slice(0, 160) : DEFAULT_TEXT;
}

export function tokenize(text) {
  return normalizeText(text).match(unicodeTokenPattern) ?? [DEFAULT_TEXT];
}

export function estimateSyllables(token) {
  const word = token.toLowerCase();
  const latin = word.match(/[a-z]+/g)?.join("") ?? "";
  if (!latin) {
    return Math.min(5, Math.max(1, Array.from(token).length));
  }

  const clusters = latin
    .replace(/(?:e|es|ed)$/u, "")
    .match(/[aeiouy]+/g);
  return Math.min(5, Math.max(1, clusters ? clusters.length : 1));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashToken(token) {
  let hash = 0;
  for (const char of token) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash;
}

function isPunctuation(token) {
  return PUNCTUATION_PAUSES.has(token) || /^[^\p{L}\p{N}]+$/u.test(token);
}

export function createPulsePattern(text = DEFAULT_TEXT, modeName = "bright") {
  const mode = MODES[modeName] ? modeName : "bright";
  const config = MODES[mode];
  const tokens = tokenize(text);
  const pulses = [];
  let cursor = 0;
  let previousWasPause = false;

  tokens.forEach((token, tokenIndex) => {
    if (isPunctuation(token)) {
      const pauseScale = PUNCTUATION_PAUSES.get(token) ?? 1.25;
      cursor += Math.round(config.pause * pauseScale);
      previousWasPause = true;
      return;
    }

    const syllables = estimateSyllables(token);
    const hash = hashToken(token);
    const longWordLift = clamp(Array.from(token).length / 12, 0, 0.65);
    const accent = tokenIndex === 0 || syllables > 2 || hash % 5 === 0;
    const swing = tokenIndex % 2 === 0 ? config.swing : 1 / config.swing;
    const duration = clamp(
      Math.round((config.base + syllables * config.syllable + longWordLift * 70) * swing),
      74,
      380
    );
    const intensity = clamp(
      0.38 + syllables * 0.12 + (accent ? 0.2 : 0) + (hash % 17) / 100,
      0.35,
      1
    );
    const gap = Math.round(config.gap * (previousWasPause ? 0.72 : 1) + (hash % 24));

    pulses.push({
      id: pulses.length,
      token,
      start: cursor,
      duration,
      gap,
      syllables,
      intensity: Number(intensity.toFixed(2)),
      accent,
      pitch: Math.round(config.pitch + syllables * 38 + (hash % 90))
    });

    cursor += duration + gap;
    previousWasPause = false;
  });

  if (!pulses.length) {
    return createPulsePattern(DEFAULT_TEXT, mode);
  }

  return {
    source: normalizeText(text),
    mode,
    modeLabel: config.label,
    pulses,
    totalDuration: Math.round(pulses.at(-1).start + pulses.at(-1).duration),
    signature: summarizePattern(pulses)
  };
}

export function summarizePattern(pulses) {
  const groups = pulses.map((pulse) => {
    const mark = pulse.accent ? "B" : pulse.intensity > 0.62 ? "t" : ".";
    const rests = pulse.gap > 90 ? "_" : pulse.gap > 56 ? "-" : "";
    return `${mark}${rests}`;
  });
  return groups.join(" ");
}

export function patternToTapScore(pattern) {
  return pattern.pulses
    .map((pulse) => {
      const hit = pulse.accent ? "THUMP" : pulse.intensity > 0.62 ? "tap" : "tick";
      return `${hit} ${pulse.duration}ms (${pulse.token})`;
    })
    .join(" | ");
}

export function patternToShareText(pattern) {
  return `${pattern.source}\n${pattern.modeLabel}: ${pattern.signature}\n${patternToTapScore(pattern)}`;
}

export function encodeShareState(text, mode) {
  const params = new URLSearchParams();
  params.set("text", normalizeText(text));
  params.set("mode", MODES[mode] ? mode : "bright");
  return `#${params.toString()}`;
}

export function decodeShareState(hash = "") {
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  return {
    text: normalizeText(params.get("text") || DEFAULT_TEXT),
    mode: MODES[params.get("mode")] ? params.get("mode") : "bright"
  };
}
