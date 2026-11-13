# TODO

## Done
- Phases 1–6: data, sound, map, anomalies + narration, regional instruments +
  animations, accessibility + README
- Sound redesign (gamelan year cycle, slendro melody, layers mute/solo)
- 37 pre-cached city dots

## UI redesign (started 12 Nov), stop after each phase to test
- [x] Phase 1: two-column layout and transport bar
- [x] Phase 2: master + per-lane volume, level meter
- [x] Phase 3: multitrack timeline with playhead and seeking
- [x] Phase 3b: simple view first (big-moments strip), "Show the data" and
  "Mixer" to open more; hover tooltips; fuller screen-reader readout
- [x] Phase 4: animated band driven by the data
- [x] Phase 5: narration timing fix, accessibility check, README update

## Casual Flutter UI (branch `alternative`, 13 Nov)
- [x] Flutter app in `app/`, built into `public/app/`, NASA colours; the
  front page opens it, classic page at /index.html
- Listen through it on a phone-sized screen and check the tiles and controls

## Before the hackathon (14–15 Nov)
- Listen through a few cities and tweak sounds if needed
- Add licensed recordings to `public/samples/` (optional; synths work)
- Test once with Wi-Fi off
- Try it with a screen reader (Windows: Narrator, Ctrl+Win+Enter), including
  the timeline slider (Tab to it, arrow keys, N/P, Enter)

## Ideas for later
- "Compare two places" mode
- Rejected: a different location per variable (breaks the story and narration)
