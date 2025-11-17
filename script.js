import { getLocalStream, getRandomNote, getRandomString } from "./utils.js";
import {
  createPitchDetector,
  freqToNoteData,
  areNotesEquivalent,
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

// Tolérance configurable (cents)
let tolerance = parseInt(localStorage.getItem("toleranceCents") || "20", 10);
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
  const randomNote = getRandomNote();

  const enabledStrings = Array.from(
    document.querySelectorAll(".string-selector__box.selected")
  ).map((box) => box.id);

  if (enabledStrings.length === 0) {
    alert("Veuillez sélectionner au moins une corde !");
    return;
  }

  const randomString = getRandomString(enabledStrings);

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
  const minHoldMs = 600; // durée minimale en ms pour valider une réussite

  function update() {
    analyser.getFloatTimeDomainData(dataArray);
    const pitchHz = detector(dataArray);

    if (pitchHz) {
      const noteData = freqToNoteData(pitchHz, referenceA);
      detectedNoteDisplay.textContent = `Note jouée : ${
        noteData.simpleName
      } (${pitchHz.toFixed(1)} Hz, ${noteData.cents} cents)`;

      let status = "incorrect";
      if (areNotesEquivalent(noteData.simpleName, randomNote)) {
        status = Math.abs(noteData.cents) <= tolerance ? "correct" : "partial";
      }

      // Si la round est déjà complétée, on n'incrémente plus le score
      if (roundCompleted) {
        if (status === "correct") {
          detectedNoteDisplay.textContent += ` ✅ Correct (enregistré)`;
          detectedNoteDisplay.style.color = "#7CFC00";
        } else if (status === "partial") {
          const sign = noteData.cents > 0 ? "+" : "";
          detectedNoteDisplay.textContent += ` ⚠️ Note correcte mais ${sign}${noteData.cents} cents hors tolérance`;
          detectedNoteDisplay.style.color = "#FFD700";
        } else {
          detectedNoteDisplay.textContent += " ❌ Incorrect";
          detectedNoteDisplay.style.color = "#FF6B6B";
        }
        lastResult = status;
        requestAnimationFrame(update);
        return;
      }

      // Gestion du maintien (hold) pour éviter les faux positifs dus au vibrato
      if (status === "correct") {
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
            detectedNoteDisplay.textContent += ` ✅ Correct (enregistré)`;
            detectedNoteDisplay.style.color = "#7CFC00";
          } else {
            detectedNoteDisplay.textContent += ` (tenez ${
              Math.ceil((minHoldMs - held) / 100) / 10
            }s)`;
            detectedNoteDisplay.style.color = "#A7F3D0";
          }
        }
      } else {
        // reset du timer si on sort de l'état correct
        correctStartTime = null;
        if (status === "partial") {
          const sign = noteData.cents > 0 ? "+" : "";
          detectedNoteDisplay.textContent += ` ⚠️ Note correcte mais ${sign}${noteData.cents} cents hors tolérance`;
          detectedNoteDisplay.style.color = "#FFD700";
        } else {
          detectedNoteDisplay.textContent += " ❌ Incorrect";
          detectedNoteDisplay.style.color = "#FF6B6B";
        }
      }

      lastResult = status;
    }

    requestAnimationFrame(update);
  }

  update();
});
