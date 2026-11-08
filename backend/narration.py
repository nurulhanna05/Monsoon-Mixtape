"""Rule-based narration: plain-English sentences built from templates.

Only describes what the data shows; never names real-world events.
"""
import zlib

MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]

# Leave enough months between lines to read each one (~2.5 s at normal tempo).
MIN_GAP = 10

# {when} is a date phrase; other fields come from the anomaly details.
TEMPLATES = {
    "wet": [
        "{when} was much wetter than usual: {ratio:.1f}× the normal rainfall.",
        "Heavy rain in {when}: about {ratio:.1f} times what's typical for that time of year.",
        "{when} brought a downpour, with {ratio:.1f}× the usual rain.",
        "The drums get busy here: {when} had {ratio:.1f}× the normal rainfall.",
    ],
    "dry": [
        "{when} was unusually dry, with only {pct:.0f}% of the normal rainfall.",
        "Rain almost stopped in {when}: just {pct:.0f}% of what's typical.",
        "A dry spell in {when}: rainfall fell to {pct:.0f}% of normal.",
    ],
    "hot": [
        "{when} was unusually hot: {diff:.1f}°C above normal for that time of year.",
        "Hear the melody climb: {when} ran {diff:.1f}°C warmer than usual.",
        "{when} was one of the hotter stretches, {diff:.1f}°C above average.",
    ],
    "cool": [
        "{when} was unusually cool: {diff:.1f}°C below normal.",
        "The melody dips: {when} was {diff:.1f}°C cooler than usual.",
        "A cool spell in {when}, {diff:.1f}°C below average for that time of year.",
    ],
    "humid": [
        "{when} was unusually humid, with humidity around {value:.0f}%.",
        "Muggy air in {when}: humidity reached {value:.0f}%, above the usual.",
        "The echo deepens: {when} was especially humid ({value:.0f}%).",
    ],
    "windy": [
        "{when} was unusually windy: winds {ratio:.1f}× stronger than normal.",
        "Stronger winds than usual in {when}, about {ratio:.1f}× the norm.",
        "{when} was a gusty time, with winds {ratio:.1f}× the usual speed.",
    ],
    "hazy": [
        "{when} was unusually hazy: aerosol levels {ratio:.1f}× normal. Listen for the muffled flute.",
        "Hazy air in {when}: NASA measured {ratio:.1f}× the usual aerosol levels.",
        "The flute goes muffled: {when} had {ratio:.1f}× the normal amount of haze in the air.",
    ],
}

ADJECTIVES = {"wet": "wet", "dry": "dry", "hot": "hot", "cool": "cool",
              "humid": "humid", "windy": "windy", "hazy": "hazy"}


def when_phrase(months, start, end):
    a, b = months[start], months[end]
    first, last = MONTH_NAMES[a["month"] - 1], MONTH_NAMES[b["month"] - 1]
    if start == end:
        return f"{first} {a['year']}"
    if a["year"] == b["year"]:
        return f"{first} to {last} {a['year']}"
    return f"{first} {a['year']} to {last} {b['year']}"


def anomaly_sentence(event, months, counters, seed):
    lead = event["kinds"][0]
    d = dict(event["details"][lead])
    d["diff"] = abs(d.get("diff", 0))
    d["pct"] = d.get("ratio", 0) * 100

    # Rotate through the variations so repeats don't sound the same.
    options = TEMPLATES[lead]
    choice = options[(counters.get(lead, 0) + seed) % len(options)]
    counters[lead] = counters.get(lead, 0) + 1

    when = when_phrase(months, event["start_index"], event["end_index"])
    text = choice.format(when=when, **d)
    text = text[0].upper() + text[1:]

    others = [ADJECTIVES[k] for k in event["kinds"][1:]]
    if others:
        joined = others[0] if len(others) == 1 else ", ".join(others[:-1]) + " and " + others[-1]
        text += f" It was also unusually {joined}."
    return text


def intro(region, months):
    years = months[-1]["year"] - months[0]["year"] + 1
    name = region["name"]
    where = name if name.startswith(("near ", "off the coast")) or "°" in name else f"in {name}"
    return f"This is {years} years of climate {where}, {months[0]['year']} to {months[-1]['year']}."


def summary(trend):
    change = trend["temp_change"]
    if abs(change) < 0.2:
        temp = "Temperatures stayed roughly steady over this period"
    else:
        temp = f"Temperatures {'rose' if change > 0 else 'fell'} about {abs(change):.1f}°C over this period"

    rain = trend["rain_change_pct"]
    if abs(rain) < 5:
        rain_text = "yearly rainfall stayed about the same"
    else:
        rain_text = (f"the second half was about {abs(rain):.0f}% "
                     f"{'wetter' if rain > 0 else 'drier'} than the first")
    return f"{temp}, and {rain_text}. The hottest year was {trend['hottest_year']}."


def worth_saying(event):
    """Statistically unusual isn't always noticeable: '1.1× the usual wind'
    sounds like nothing. Such events still get a gong, just no sentence."""
    d = event["details"][event["kinds"][0]]
    return "ratio" not in d or d["ratio"] >= 1.3 or d["ratio"] <= 0.5


def build(region, months, events, trend):
    """Return timed narration lines: [{month_index, date, kind, text}]."""
    seed = zlib.crc32(region["name"].encode())
    last = len(months) - 1

    # Pick the most severe events first, keeping lines MIN_GAP months apart.
    taken = [0, last]
    chosen = []
    for e in sorted(events, key=lambda e: -e["severity"]):
        if not worth_saying(e):
            continue
        i = e["start_index"]
        if all(abs(i - t) >= MIN_GAP for t in taken):
            taken.append(i)
            chosen.append(e)
    chosen.sort(key=lambda e: e["start_index"])

    counters = {}
    lines = [{"month_index": 0, "date": months[0]["date"], "kind": "intro",
              "text": intro(region, months)}]
    for e in chosen:
        lines.append({
            "month_index": e["start_index"],
            "date": e["start_date"],
            "kind": e["kinds"][0],
            "text": anomaly_sentence(e, months, counters, seed),
        })
    lines.append({"month_index": last, "date": months[last]["date"], "kind": "summary",
                  "text": summary(trend)})
    return lines
