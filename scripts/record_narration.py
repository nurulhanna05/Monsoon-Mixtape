"""Record the spoken narration for the saved cities with Qwen3-TTS.

The app plays these recordings when a narration line appears; lines that
aren't recorded (places tapped on the map) use the browser's own voice.

Needs its own environment (a few GB, CPU is fine but slow):

    python -m venv .venv-tts
    .venv-tts/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
    .venv-tts/Scripts/python -m pip install qwen-tts soundfile

Then, from the project root:

    .venv-tts/Scripts/python scripts/record_narration.py "Kuala Lumpur" Kuching
    .venv-tts/Scripts/python scripts/record_narration.py --all

Recordings go to public/narration/ as <hash>.ogg, listed in manifest.json
(narration text -> file). Lines already recorded are skipped, so it can be
stopped and restarted.
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from backend import analysis, narration, power, regions  # noqa: E402

START, END = 2006, 2025  # same as backend/main.py
OUT = ROOT / "public" / "narration"
MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
SPEAKER = "Ryan"
STYLE = ("Speak like a calm, warm nature-documentary narrator: unhurried, clear and gently "
         "curious, with natural pauses.")


def lines_for(town):
    """The narration the server builds for this town (same steps as /song)."""
    # The app sends coordinates rounded to 4 decimals, so do the same here.
    lat, lon = round(town["lat"], 4), round(town["lon"], 4)
    data = power.get_months(lat, lon, START, END)
    region = regions.lookup(lat, lon)
    events = analysis.find_anomalies(data["months"])
    trend = analysis.trends(data["months"])
    return [line["text"] for line in narration.build(region, data["months"], events, trend)]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("cities", nargs="*", help="city names from public/data/towns.json")
    parser.add_argument("--all", action="store_true", help="record every saved city")
    args = parser.parse_args()

    towns = regions.TOWNS if args.all else [t for t in regions.TOWNS if t["name"] in args.cities]
    missing = set(args.cities) - {t["name"] for t in towns}
    if missing or not towns:
        sys.exit(f"Unknown or no cities: {', '.join(missing) or '(none given)'}")

    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8")) if manifest_path.exists() else {}

    todo = []
    for town in towns:
        for text in lines_for(town):
            if text not in manifest and text not in todo:
                todo.append(text)
    print(f"{len(todo)} lines to record for {len(towns)} cities.")
    if not todo:
        return

    # Imported late so --help and "nothing to do" are quick.
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    print(f"Loading {MODEL} (the first run downloads it)…")
    model = Qwen3TTSModel.from_pretrained(MODEL, device_map="cpu", dtype=torch.float32)

    for n, text in enumerate(todo, 1):
        began = time.time()
        wavs, rate = model.generate_custom_voice(text=text, language="English", speaker=SPEAKER, instruct=STYLE)
        name = hashlib.sha1(text.encode("utf-8")).hexdigest()[:12] + ".ogg"
        sf.write(OUT / name, wavs[0], rate, format="OGG", subtype="VORBIS")
        manifest[text] = name
        # Save after every line so a stopped run keeps its work.
        manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False), "utf-8")
        seconds = len(wavs[0]) / rate
        print(f"[{n}/{len(todo)}] {seconds:.1f}s of speech in {time.time() - began:.0f}s: {text[:60]}")


if __name__ == "__main__":
    main()
