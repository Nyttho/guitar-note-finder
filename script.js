import { getLocalStream, getRandomNote, getRandomString } from "./utils.js";
import {
  createPitchDetector,
  freqToNoteData,
  areNotesEquivalent,
  getEnharmonicNames,
} from "./modules/pitch.js";

function toggleStringSelection(event) {
  const box = event.currentTarget;
  box.classList.toggle("selected");
}
const stringBoxes = document.querySelectorAll(".string-selector__box");
stringBoxes.forEach((box) => {
  box.addEventListener("click", toggleStringSelection);
});

const startButton = document.getElementById("start-button");
const permissionButton = document.getElementById("permission-button");
const randomNoteDisplay = document.getElementById("note-display");
const detectedNoteDisplay = document.getElementById("detected-note");
const toleranceRange = document.getElementById("tolerance-range");
const toleranceValue = document.getElementById("tolerance-value");

// Tolérance configurable (cents) — default increased to reduce flicker for learners
let tolerance = parseInt(localStorage.getItem("toleranceCents") || "30", 10);
if (toleranceRange) {
  toleranceRange.value = String(tolerance);
  toleranceValue.textContent = String(tolerance);
  toleranceRange.addEventListener("input", (e) => {
    tolerance = parseInt(e.target.value, 10);
    toleranceValue.textContent = String(tolerance);
    localStorage.setItem("toleranceCents", String(tolerance));
  });
}
// Référence A4 configurable
const referenceInput = document.getElementById("reference-a");
let referenceA = parseFloat(localStorage.getItem("referenceA") || "440");
if (referenceInput) {
  referenceInput.value = String(referenceA);
  referenceInput.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      referenceA = val;
      localStorage.setItem("referenceA", String(referenceA));
    }
  });
}

// Score des réussites (persisté)
const scoreDisplay = document.getElementById("score-display");
const resetScoreButton = document.getElementById("reset-score");
let score = parseInt(localStorage.getItem("score") || "0", 10);
function updateScoreDisplay() {
  if (scoreDisplay) scoreDisplay.textContent = `Succès: ${score}`;
}
updateScoreDisplay();
if (resetScoreButton) {
  resetScoreButton.addEventListener("click", () => {
    score = 0;
    localStorage.setItem("score", String(score));
    updateScoreDisplay();
  });
}

// Gérer la permission sauvegardée
const savedMic = localStorage.getItem("micPermission");
if (savedMic === "granted") {
  permissionButton.textContent = "Micro : autorisé";
  permissionButton.disabled = true;
}

permissionButton.addEventListener("click", async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    localStorage.setItem("micPermission", "granted");
    permissionButton.textContent = "Micro : autorisé";
    permissionButton.disabled = true;
  } catch (err) {
    localStorage.setItem("micPermission", "denied");
    alert(
      "Autorisation micro refusée — l'application ne peut pas fonctionner."
    );
  }
});

startButton.addEventListener("click", async () => {
  let randomNote = getRandomNote();

  const enabledStrings = Array.from(
    document.querySelectorAll(".string-selector__box.selected")
  ).map((box) => box.id);

  if (enabledStrings.length === 0) {
    alert("Veuillez sélectionner au moins une corde !");
    return;
  }

  let randomString = getRandomString(enabledStrings);

  randomNoteDisplay.textContent = `Joue la note ${randomNote} sur la corde de ${randomString}!`;

  const streamData = await getLocalStream();
  if (!streamData) {
    detectedNoteDisplay.textContent = "Impossible d'accéder au micro.";
    return;
  }

  const { analyser, dataArray, audioContext } = streamData;
  const detector = createPitchDetector(audioContext.sampleRate);
  // protection contre vibrato: nécessite de tenir la note correcte pendant un délai
  let lastResult = null; // 'correct' | 'partial' | 'incorrect' | null
  let roundCompleted = false;
  let correctStartTime = null;
  const minHoldMs = 450; // durée minimale en ms pour valider une réussite
  // stability check: keep recent cents values and require low variance to avoid vibrato
  const stabilityWindow = 8; // number of recent frames to consider
  const stabilityThreshold = 12; // cents stdev threshold
  // smoothing for displayed note to avoid flicker: keep recent detected names
  const recentDetections = [];
  const displayWindow = 6;

  // helper to start a new target (after success)
  function newRound() {
    randomNote = getRandomNote();
    randomString = getRandomString(enabledStrings);
    randomNoteDisplay.textContent = `Joue la note ${randomNote} sur la corde de ${randomString}!`;
    roundCompleted = false;
    lastResult = null;
    correctStartTime = null;
    // remove success styles
    detectedNoteDisplay.classList.remove("pulse-success", "note-success");
    detectedNoteDisplay.style.color = "";
    // small reset text
    // keep the template but reset values
    const nameEl = detectedNoteDisplay.querySelector(".detected-note__name");
    const metaEl = detectedNoteDisplay.querySelector(".detected-note__meta");
    const centsEl = detectedNoteDisplay.querySelector(".detected-cents");
    const fillEl = detectedNoteDisplay.querySelector(".detected-meter__fill");
    const statusEl = detectedNoteDisplay.querySelector(".detected-status");
    if (nameEl) nameEl.textContent = "—";
    if (metaEl) metaEl.textContent = "—";
    if (centsEl) centsEl.textContent = "—";
    if (fillEl) fillEl.style.width = "0%";
    if (statusEl) statusEl.innerHTML = "";
  }

  // ensure the detected-note contains the richer template
  if (
    detectedNoteDisplay &&
    !detectedNoteDisplay.querySelector(".detected-note__name")
  ) {
    detectedNoteDisplay.innerHTML = `
      <div class="detected-main">
        <div class="detected-note__name">—</div>
        <div class="detected-note__meta">—</div>
      </div>
      <div class="detected-meter">
        <div class="detected-meter__bar"><div class="detected-meter__fill" style="width:0%"></div></div>
        <div class="detected-cents">—</div>
      </div>
      <div class="detected-status" aria-hidden="true"></div>
    `;
  }

  // cache sub-elements for efficient updates
  const nameEl = detectedNoteDisplay.querySelector(".detected-note__name");
  const metaEl = detectedNoteDisplay.querySelector(".detected-note__meta");
  const centsEl = detectedNoteDisplay.querySelector(".detected-cents");
  const fillEl = detectedNoteDisplay.querySelector(".detected-meter__fill");
  const statusEl = detectedNoteDisplay.querySelector(".detected-status");

  function update() {
    try {
      analyser.getFloatTimeDomainData(dataArray);
      const pitchHz = detector(dataArray);

      if (pitchHz) {
        const noteData = freqToNoteData(pitchHz, referenceA);

        // push into smoothing window for display
        recentDetections.push({
          name: noteData.simpleName,
          cents: noteData.cents,
          hz: pitchHz,
        });
        if (recentDetections.length > displayWindow) recentDetections.shift();

        // compute average frequency over window, then convert that avgHz -> note
        const avgHz =
          recentDetections.reduce((s, d) => s + d.hz, 0) /
          recentDetections.length;
        const smoothed = freqToNoteData(avgHz, referenceA);

        // compute stdev of cents within window (for stability feedback)
        const centsValues = recentDetections.map((d) => d.cents);
        const meanC =
          centsValues.length > 0
            ? centsValues.reduce((s, v) => s + v, 0) / centsValues.length
            : 0;
        const varianceC =
          centsValues.length > 0
            ? centsValues.reduce((s, v) => s + (v - meanC) * (v - meanC), 0) /
              centsValues.length
            : 0;
        const stdev = Math.sqrt(varianceC || 0);

        // update template pieces
        if (nameEl) {
          const enh = getEnharmonicNames(smoothed.simpleName);
          const displayName = enh.length > 1 ? `${enh[0]} / ${enh[1]}` : enh[0];
          nameEl.textContent = displayName;
        }
        if (metaEl)
          metaEl.textContent = `${avgHz.toFixed(1)} Hz · ${smoothed.octave}`;
        if (centsEl) centsEl.textContent = `${smoothed.cents} cents`;

        // determine status using smoothed note and its cents
        let status = "incorrect";
        if (areNotesEquivalent(smoothed.simpleName, randomNote)) {
          status =
            Math.abs(smoothed.cents) <= tolerance ? "correct" : "partial";
        }

        // Si la round est déjà complétée, on n'incrémente plus le score
        if (roundCompleted) {
          // round already completed: show subtle state
          detectedNoteDisplay.classList.remove(
            "status-correct",
            "status-partial",
            "status-incorrect"
          );
          if (status === "correct") {
            detectedNoteDisplay.classList.add("status-correct");
            if (statusEl)
              statusEl.innerHTML = `<span class="icon">✅ Correct (enregistré)</span>`;
          } else if (status === "partial") {
            detectedNoteDisplay.classList.add("status-partial");
            const sign = noteData.cents > 0 ? "+" : "";
            if (statusEl)
              statusEl.innerHTML = `<span class="icon">⚠️ ${sign}${noteData.cents} cents</span>`;
          } else {
            detectedNoteDisplay.classList.add("status-incorrect");
            if (statusEl)
              statusEl.innerHTML = `<span class="icon">❌ Incorrect</span>`;
          }
          lastResult = status;
          return;
        }

        // Gestion du maintien (hold) et stabilité pour éviter les faux positifs dus au vibrato
        if (status === "correct") {
          // use previously computed stdev and centsValues
          if (
            stdev <= stabilityThreshold &&
            centsValues.length >= Math.min(4, stabilityWindow)
          ) {
            // stable enough
            if (lastResult !== "correct") {
              correctStartTime = performance.now();
            } else if (correctStartTime) {
              const held = performance.now() - correctStartTime;
              if (held >= minHoldMs) {
                // Valide la réussite une seule fois par round
                score += 1;
                localStorage.setItem("score", String(score));
                updateScoreDisplay();
                roundCompleted = true;
                // add visual feedback
                detectedNoteDisplay.classList.add(
                  "status-correct",
                  "pulse-success"
                );
                if (statusEl)
                  statusEl.innerHTML = `<span class="icon">✅ Correct (enregistré)</span>`;
                // auto-advance to the next note after a short delay
                setTimeout(() => {
                  newRound();
                  recentDetections.length = 0;
                }, 900);
              } else {
                // update hold meter progress
                const percent = Math.min(100, (held / minHoldMs) * 100);
                if (fillEl) fillEl.style.width = `${percent}%`;
                detectedNoteDisplay.classList.remove(
                  "status-correct",
                  "status-partial",
                  "status-incorrect"
                );
                detectedNoteDisplay.classList.add("status-correct");
                if (statusEl)
                  statusEl.innerHTML = `<span class="icon">⏳ Tenez ${
                    Math.ceil((minHoldMs - held) / 100) / 10
                  }s</span>`;
              }
            }
          } else {
            // unstable (vibrato or noisy), reset timer and show hint
            correctStartTime = null;
            if (fillEl) fillEl.style.width = "0%";
            detectedNoteDisplay.classList.remove(
              "status-correct",
              "status-partial",
              "status-incorrect"
            );
            detectedNoteDisplay.classList.add("status-partial");
            if (statusEl)
              statusEl.innerHTML = `<span class="icon">🎸 Signal instable — tenez plus steady</span>`;
          }
        } else {
          // reset timer if not correct but keep recentDetections so display remains
          correctStartTime = null;
          if (fillEl) fillEl.style.width = "0%";
          detectedNoteDisplay.classList.remove(
            "status-correct",
            "status-partial",
            "status-incorrect"
          );
          if (status === "partial") {
            detectedNoteDisplay.classList.add("status-partial");
            const sign = noteData.cents > 0 ? "+" : "";
            if (statusEl)
              statusEl.innerHTML = `<span class="icon">⚠️ ${sign}${noteData.cents} cents hors tolérance</span>`;
          } else {
            detectedNoteDisplay.classList.add("status-incorrect");
            if (statusEl)
              statusEl.innerHTML = `<span class="icon">❌ Incorrect</span>`;
          }
        }

        lastResult = status;
      }
    } catch (err) {
      console.error("Error in update loop:", err);
    } finally {
      requestAnimationFrame(update);
    }
  }

  update();
});
