"""Find unusual months and overall trends.

A month is unusual when it is far from the average for that calendar month
(e.g. this December vs all Decembers), measured as a z-score.
"""
import statistics

Z_LIMIT = 2.0
DRY_RATIO = 0.35  # "dry" = under 35% of the usual rainfall for that month

# Order also sets which kind leads a sentence when severities tie.
KINDS = ["wet", "dry", "hot", "cool", "humid", "windy", "hazy"]


def climatology(months, key):
    """Mean and standard deviation of `key` for each calendar month (1-12)."""
    stats = {}
    for cal in range(1, 13):
        values = [m[key] for m in months if m["month"] == cal]
        mean = statistics.fmean(values)
        std = statistics.pstdev(values) if len(values) > 1 else 0
        stats[cal] = (mean, std)
    return stats


def zscore(value, mean, std):
    return 0.0 if std == 0 else (value - mean) / std


def flag_month(m, clim):
    """Return {kind: details} for every way this month was unusual."""
    flags = {}
    cal = m["month"]

    def z(key):
        mean, std = clim[key][cal]
        return zscore(m[key], mean, std), mean

    zt, normal_t = z("temp")
    if zt > Z_LIMIT:
        flags["hot"] = {"z": zt, "diff": m["temp"] - normal_t}
    elif zt < -Z_LIMIT:
        flags["cool"] = {"z": zt, "diff": m["temp"] - normal_t}

    zr, normal_r = z("rain")
    ratio = m["rain"] / normal_r if normal_r else 1
    if zr > Z_LIMIT:
        flags["wet"] = {"z": zr, "ratio": ratio}
    elif ratio < DRY_RATIO and zr < -1:
        # Rain can't drop far below zero, so z-scores rarely pass -2 for
        # dry months; use the ratio plus a milder z-score instead.
        flags["dry"] = {"z": zr, "ratio": ratio}

    zh, normal_h = z("humidity")
    if zh > Z_LIMIT:
        flags["humid"] = {"z": zh, "value": m["humidity"], "diff": m["humidity"] - normal_h}

    zw, normal_w = z("wind")
    if zw > Z_LIMIT:
        flags["windy"] = {"z": zw, "ratio": m["wind"] / normal_w if normal_w else 1}

    za, normal_a = z("aod")
    if za > Z_LIMIT:
        flags["hazy"] = {"z": za, "ratio": m["aod"] / normal_a if normal_a else 1}

    return flags


def find_anomalies(months):
    """Flag each month, then group consecutive months that share a kind
    (e.g. three hot months in a row) into one event."""
    clim = {key: climatology(months, key) for key in ("temp", "rain", "humidity", "wind", "aod")}
    per_month = [flag_month(m, clim) for m in months]
    for m, flags in zip(months, per_month):
        m["flags"] = [k for k in KINDS if k in flags]

    events, current = [], None
    for i, flags in enumerate(per_month):
        if not flags:
            current = None
            continue
        if current is None or not set(flags) & set(current["months"][-1]):
            current = {"start_index": i, "end_index": i, "months": []}
            events.append(current)
        current["end_index"] = i
        current["months"].append(flags)

    return [summarise_event(e, months) for e in events]


def summarise_event(event, months):
    """Average each kind's details over the months where it appeared."""
    details = {}
    for kind in KINDS:
        found = [f[kind] for f in event["months"] if kind in f]
        if found:
            details[kind] = {key: round(statistics.fmean(d[key] for d in found), 2) for key in found[0]}
            details[kind]["months"] = len(found)
    # Lead with the most extreme kind.
    kinds = sorted(details, key=lambda k: (-abs(details[k]["z"]), KINDS.index(k)))
    start, end = event["start_index"], event["end_index"]
    return {
        "start_index": start,
        "end_index": end,
        "start_date": months[start]["date"],
        "end_date": months[end]["date"],
        "kinds": kinds,
        "details": details,
        "severity": round(max(abs(d["z"]) for d in details.values()), 2),
    }


def linear_change(xs, ys):
    """Total change of the best-fit straight line from first to last x."""
    mx, my = statistics.fmean(xs), statistics.fmean(ys)
    denom = sum((x - mx) ** 2 for x in xs)
    slope = 0 if denom == 0 else sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / denom
    return slope * (xs[-1] - xs[0])


def trends(months):
    years = sorted({m["year"] for m in months})
    full = [y for y in years if sum(m["year"] == y for m in months) == 12]
    yearly_temp = [statistics.fmean(m["temp"] for m in months if m["year"] == y) for y in full]
    yearly_rain = [statistics.fmean(m["rain"] for m in months if m["year"] == y) for y in full]

    half = len(full) // 2
    first, second = statistics.fmean(yearly_rain[:half]), statistics.fmean(yearly_rain[half:])
    wettest = full[yearly_rain.index(max(yearly_rain))]
    hottest = full[yearly_temp.index(max(yearly_temp))]

    return {
        "temp_change": round(linear_change(full, yearly_temp), 2),
        "rain_change_pct": round((second - first) / first * 100, 1) if first else 0,
        "wettest_year": wettest,
        "hottest_year": hottest,
        "first_year": full[0],
        "last_year": full[-1],
    }
