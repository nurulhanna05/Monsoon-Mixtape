"""Monsoon Mixtape API. Run from the project root:

    uvicorn backend.main:app --reload
"""
from pathlib import Path
from urllib.error import URLError

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from backend import analysis, narration, power, regions

DEFAULT_START, DEFAULT_END = 2006, 2025
PUBLIC_DIR = Path(__file__).parent.parent / "public"

app = FastAPI(title="Monsoon Mixtape")


@app.middleware("http")
async def no_stale_files(request, call_next):
    # Make the browser re-check files on each load, so code edits show up
    # after a normal refresh (unchanged files still come back as 304).
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/song")
def song(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    start: int = Query(DEFAULT_START, ge=1981),
    end: int = Query(DEFAULT_END, le=2100),
):
    if start > end:
        raise HTTPException(400, "start must be <= end")
    if end - start > 40:
        raise HTTPException(400, "Please request 40 years or fewer")

    try:
        data = power.get_months(lat, lon, start, end)
    except (URLError, TimeoutError, OSError) as err:
        raise HTTPException(503, f"NASA POWER is unreachable and this location isn't cached yet ({err})")
    except (KeyError, ValueError) as err:
        raise HTTPException(502, f"Unexpected response from NASA POWER ({err})")

    region = regions.lookup(lat, lon)
    anomalies = analysis.find_anomalies(data["months"])  # also adds month["flags"]
    trend = analysis.trends(data["months"])

    return {
        "location": {"lat": lat, "lon": lon},
        "start": start,
        "end": end,
        **data,
        "region": region,
        "anomalies": anomalies,
        "trend": trend,
        "narration": narration.build(region, data["months"], anomalies, trend),
    }


# Serve the frontend (added in Phase 2) from the same server.
if PUBLIC_DIR.exists():
    app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")
