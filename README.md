# Pulse Poem

Pulse Poem turns a short line of text into a tiny playable rhythm. Type a phrase, choose a mood, and play it back as animated pulses with optional Web Audio ticks and mobile vibration.

## Why this exists

I wanted a small browser toy that makes writing feel physical. The idea was sparked by a recent JavaScript community thread where someone showed an audio-to-haptics web experiment: https://www.reddit.com/r/javascript/comments/1tem5bg/showoff_saturday_may_16_2026/

Pulse Poem borrows only the broad idea of tactile browser feedback. The code, design, copy, and rhythm rules here are original.

## What it can do

- Converts words, punctuation, and rough syllable counts into a short pulse pattern.
- Plays the pattern as a canvas animation.
- Adds optional click sounds through the Web Audio API.
- Uses the Vibration API on supported mobile browsers.
- Copies a readable tap score for sharing.
- Stores the current text and mode in the URL hash, so a rhythm can be reopened later.

## Who it is for

It is for writers, students, and bored people who want a quick way to turn a sentence into something they can hear, see, and tap along with. It is also a compact example of a no-dependency interactive web page.

## Why it is useful

It gives instant feedback on the shape of a phrase. Punctuation becomes rests, longer words become heavier pulses, and different modes change the tempo. That makes it handy for checking slogans, poem fragments, short reminders, or presentation lines.

## Why it is fun

The result feels like a pocket drum machine made from your own sentence. A boring line can become a tiny beat, and on phones with vibration support it becomes tactile instead of only visual.

## How to run

Open `index.html` directly in a browser, or run a tiny local server:

```bash
npm start
```

Then open:

```text
http://localhost:5173
```

## Core loop

1. Type a short line or use the sample button.
2. Pick Calm, Bright, or Drumline.
3. Press Generate.
4. Press Play.
5. Copy the score or keep editing the line.

## Checks

```bash
npm test
```

The tests cover tokenization, rhythm generation, punctuation rests, mode differences, tap-score output, and share-state encoding.

## Possible next steps

- Add a small library of saved local rhythms.
- Add an exportable PNG timeline.
- Add a metronome grid for stricter musical timing.
- Add more language-specific syllable heuristics.
