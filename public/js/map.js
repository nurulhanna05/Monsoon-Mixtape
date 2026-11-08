// Leaflet map of Malaysia. OpenStreetMap tiles need internet; the bundled
// state outlines and city dots keep the map usable offline.

const MALAYSIA_BOUNDS = [[-1.5, 98.0], [8.5, 120.5]];

export async function createMap(elementId, towns, onPick) {
  const map = L.map(elementId, {
    maxBounds: MALAYSIA_BOUNDS,
    maxBoundsViscosity: 0.8,
    minZoom: 5,
    maxZoom: 12,
  }).fitBounds([[0.8, 99.6], [7.4, 119.3]]);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const states = await fetch("data/malaysia_states.geojson").then((r) => r.json());
  L.geoJSON(states, {
    style: { color: "#a4452c", weight: 1, fillColor: "#e9dcc4", fillOpacity: 0.25 },
    interactive: false, // clicks fall through to the map
  }).addTo(map);
  map.attributionControl.addAttribution(
    'States: <a href="https://www.geoboundaries.org/">geoBoundaries</a>');

  // City dots: click to play that city. All pre-cached. They're left out of
  // the Tab order (37 stops would be tiring); keyboard users get the same
  // list in the City dropdown.
  for (const town of towns) {
    L.marker([town.lat, town.lon], {
      icon: L.divIcon({ className: "town-dot", iconSize: [14, 14] }),
      title: `${town.name}, ${town.state}`,
      keyboard: false,
    }).on("click", () => onPick(town.lat, town.lon)).addTo(map);
  }

  const marker = L.marker([0, 0], { keyboard: false, zIndexOffset: 1000 });

  map.on("click", (e) => onPick(e.latlng.lat, e.latlng.lng));

  // Keyboard: arrow keys pan and +/- zoom (built into Leaflet); Enter or
  // Space plays the place under the crosshair in the middle of the map.
  const container = map.getContainer();
  const crosshair = document.createElement("div");
  crosshair.className = "crosshair";
  crosshair.setAttribute("aria-hidden", "true");
  container.append(crosshair);
  container.addEventListener("keydown", (e) => {
    if (e.target !== container || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    const center = map.getCenter();
    onPick(center.lat, center.lng);
  });

  return {
    setMarker(lat, lon, label) {
      marker.setLatLng([lat, lon]).addTo(map);
      marker.unbindTooltip();
      if (label) marker.bindTooltip(label, { permanent: true, direction: "top", offset: [0, -36] }).openTooltip();
    },
    flyTo(lat, lon) {
      map.flyTo([lat, lon], Math.max(map.getZoom(), 7), { duration: 0.8 });
    },
  };
}
