# Instrument recordings

Each folder holds recordings for one instrument. While a folder's
`manifest.json` has no notes, the app uses a built-in synth instead, so
everything works with no recordings at all.

## Adding recordings

1. Put your audio files (`.mp3`, `.ogg` or `.wav`) in the instrument's folder.
2. List them in that folder's `manifest.json`, mapping a note name to a file:

```json
{
  "notes": {
    "C4": "saron-c4.mp3",
    "G4": "saron-g4.mp3",
    "C5": "saron-c5.mp3"
  },
  "release": 1,
  "volume": -6
}
```

- **Pitched instruments** (`gamelan`, `sape`, `rebab`, `seruling`): add a few
  notes across the range. Tone.js re-pitches the nearest recording for the
  notes in between, so 3–6 recordings is plenty. Name each note by the pitch
  actually recorded (e.g. `"A4"`).
- **Drums and gong** (`kompang`, `gendang`, `gong`): one recording is enough.
  The note name doesn't matter, e.g. `{"notes": {"C3": "kompang-hit.wav"}}`.
- `release` (seconds) and `volume` (dB) are optional.

3. Refresh the page. The browser console says
   `[instruments] sape: using recordings` when it worked.

Only use recordings you're licensed to use, and credit them in the main README.
