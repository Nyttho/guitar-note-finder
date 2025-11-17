async function getLocalStream() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    source.connect(analyser);

    analyser.fftSize = 2048;

    const bufferLength = analyser.fftSize; // pour getFloatTimeDomainData il faut fftSize
    const dataArray = new Float32Array(bufferLength);

    console.log("Flux audio OK :", stream);

    return { audioContext, analyser, dataArray };
  } catch (error) {
    console.error("Impossible d'accéder au micro :", error);
  }
}

function getRandomNote() {
  const sharpNotes = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const flatNotes = [
    "C",
    "Db",
    "D",
    "Eb",
    "E",
    "F",
    "Gb",
    "G",
    "Ab",
    "A",
    "Bb",
    "B",
  ];
  const sharpOrFlat = Math.random() < 0.5 ? "sharp" : "flat";
  const notes = sharpOrFlat === "sharp" ? sharpNotes : flatNotes;
  const randomIndex = Math.floor(Math.random() * notes.length);
  return notes[randomIndex];
}

function getRandomString(enabledStrings) {
  const strings = {
    E: "E",
    A: "A",
    D: "D",
    G: "G",
    B: "B",
    e: "e",
  };

  const filteredStrings = Object.keys(strings).filter((string) =>
    enabledStrings.includes(string)
  );

  const randomIndex = Math.floor(Math.random() * filteredStrings.length);

  const frenchTranslations = {
    E: "Mi grave",
    A: "La",
    D: "Ré",
    G: "Sol",
    B: "Si",
    e: "Mi aigu",
  };

  return frenchTranslations[filteredStrings[randomIndex]];
}

export { getLocalStream, getRandomNote, getRandomString };
