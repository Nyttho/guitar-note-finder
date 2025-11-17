# Guitar Note Finder

Small web app to help guitar students practice finding notes on the fretboard using the device microphone.

## Purpose
This project listens to the user's microphone, detects the pitch (frequency) of the played sound, converts it to a musical note and compares it with a target note selected randomly by the app. It is designed for practice exercises where the student attempts to play a requested note on a particular string.

## Features
- Microphone permission request and simple permission persistence in `localStorage`.
- Selection of which guitar strings are used for the random target.
- Random target note generator (supports sharps/flats).
- Real-time pitch detection (autocorrelation-based detector in `modules/pitch.js`).
- Frequency → note conversion with cents offset and configurable A4 reference.
- Configurable tolerance in cents to decide correctness.
- Success counter (persisted) and a small hold timer to avoid counting vibrato/spikes as multiple successes.
- Modern responsive UI (in `style.css`).

## Files of interest
- `index.html` — main page and UI elements.
- `style.css` — app styling.
- `script.js` — app logic, UI wiring and main detection loop.
- `utils.js` — helper functions (media stream creation, random selection).
- `modules/pitch.js` — pitch detection and frequency→note utilities.

## Quick usage
1. Open the app in your browser.
2. Click `Autoriser le micro` (or your browser's permission prompt) to allow microphone access — the choice is saved.
3. Select the guitar strings you want to use (click the string pills).
4. Adjust the tolerance (cents) and A4 reference if needed.
5. Click `Commencer`. The app will show a random note and string. Play the requested note.
6. Hold the correct note steadily for a short time (the app shows a small hold hint) to register a successful attempt.

Notes on controls and behavior:
- `Tolerance` (cents) controls how strict the app is when deciding if the played pitch matches the target note.
- `A4 reference` allows adjusting the standard tuning reference (default 440 Hz).
- The success counter increases only after the note stays within tolerance for a short hold period to avoid counting vibrato.

## Tuning & accuracy notes
- The built-in pitch detector is a simple autocorrelation approach and works well for clean single-note sounds (plucked guitar notes). It is less robust in noisy environments or with heavy overdrive.
- For improved accuracy you can replace or extend the detector with a YIN algorithm or use an established library, but that requires adding a dependency or porting/embedding a robust implementation.
- If detection is unstable: try increasing the tolerance, ensure the environment is quiet, and play single sustained notes (no heavy tremolo or bending during detection).

## Troubleshooting
- No microphone prompt: check that the page runs over `http://localhost` or `https` and that the browser has microphone permissions globally enabled.
- No pitch detected: check the guitar is close to the microphone, volume is adequate, and the signal is relatively clean.

## Next improvements (ideas)
- Add an auto-advance mode to issue a new target note automatically after a correct detection.
- Add a visual tuner (needle/bar) showing cents offset in real time.
- Use a more robust pitch detection algorithm (YIN) or an audio-processing worker for performance.
- Save session statistics and provide practice modes (timed, streaks, accuracy report).

## Contributing
PRs & suggestions welcome. For small improvements (UI, bugfixes) open a PR. For larger algorithm changes we can discuss design first.

---
Made as a learning/practice tool for guitar students.