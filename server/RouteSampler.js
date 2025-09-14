// server/RouteSampler.js
// Node 18+ (uses built-in fetch)

import polyline from '@googlemaps/polyline-codec';
const { decode: decodePolyline } = polyline;

export class RouteSampler {
  constructor(apiKey) {
    if (!apiKey) throw new Error('Google API key required');
    this.apiKey = apiKey;
    this.routesURL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  }

  /**
   * Fetch a walking route and return coords:
   * Array<{ x:number, y:number }> in METERS,
   * - relative to origin (0,0)
   * - rotated so the first step faces +Y
   * - rounded to 2 decimals
   */
  async sampleRoute(origin, destination, intervalMeters = 5) {
    // --- Routes API ---
    const body = {
      origin:      { location: { latLng: { latitude: origin.lat,      longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'WALK',
      polylineEncoding: 'ENCODED_POLYLINE',
      polylineQuality: 'HIGH_QUALITY'
    };
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': this.apiKey,
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline'
    };

    const resp = await fetch(this.routesURL, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`Routes API error ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    const encoded = data?.routes?.[0]?.polyline?.encodedPolyline;
    if (!encoded) return [];

    // --- decode absolute lat/lng, resample, convert to planar meters from origin ---
    const absPoints = decodePolyline(encoded, 5).map(([lat, lng]) => ({ lat, lng }));
    const resampledAbs = resampleEveryMetersPlanar(absPoints, intervalMeters);

    const lat0 = origin.lat * Math.PI / 180;
    let planar = resampledAbs.map(p => ({
      x: (p.lng - origin.lng) * Math.cos(lat0) * 111320, // east
      y: (p.lat - origin.lat) * 111320                   // north
    }));

    // zero origin
    if (planar.length) {
      const o = planar[0];
      if (o.x !== 0 || o.y !== 0) {
        for (let i = 0; i < planar.length; i++) {
          planar[i] = { x: planar[i].x - o.x, y: planar[i].y - o.y };
        }
      }
    }

    // rotate so first step is along +Y
    if (planar.length >= 2) {
      const dx = planar[1].x - planar[0].x;
      const dy = planar[1].y - planar[0].y;
      const segLen = Math.hypot(dx, dy);
      if (segLen > 0) {
        const theta = Math.atan2(dx, dy); // rotate about Z: first step → +Y
        const c = Math.cos(theta), s = Math.sin(theta);
        for (let i = 0; i < planar.length; i++) {
          const { x, y } = planar[i];
          planar[i] = { x: x * c - y * s, y: x * s + y * c };
        }
        // re-zero after rotation to kill drift
        const o2 = planar[0];
        if (o2.x !== 0 || o2.y !== 0) {
          for (let i = 0; i < planar.length; i++) {
            planar[i] = { x: planar[i].x - o2.x, y: planar[i].y - o2.y };
          }
        }
      }
    }

    // round to centimeters
    const m = 100;
    for (let i = 0; i < planar.length; i++) {
      planar[i] = { x: Math.round(planar[i].x * m) / m, y: Math.round(planar[i].y * m) / m };
    }

    return planar; // ONLY coords
  }
}

/* -------- helpers -------- */

/**
 * Resample polyline at fixed stepMeters using a planar metric (local flat approximation).
 * Interpolates linearly in lat/lng (adequate for small steps).
 */
function resampleEveryMetersPlanar(poly, stepMeters) {
  if (!poly?.length) return [];
  if (poly.length === 1) return [poly[0]];

  const out = [poly[0]];
  let accumulated = 0;
  let nextTarget = stepMeters;

  const planarDist = (a, b) => {
    const lat0 = ((a.lat + b.lat) / 2) * Math.PI / 180;
    const dx = (b.lng - a.lng) * Math.cos(lat0) * 111320;
    const dy = (b.lat - a.lat) * 111320;
    return Math.hypot(dx, dy);
  };

  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i + 1];
    const segLen = planarDist(a, b);
    if (segLen === 0) continue;

    while (nextTarget <= accumulated + segLen) {
      const f = (nextTarget - accumulated) / segLen;
      out.push({
        lat: a.lat + (b.lat - a.lat) * f,
        lng: a.lng + (b.lng - a.lng) * f
      });
      nextTarget += stepMeters;
    }
    accumulated += segLen;
  }

  const last = poly[poly.length - 1];
  const tail = out[out.length - 1];
  if (!tail || tail.lat !== last.lat || tail.lng !== last.lng) out.push(last);
  return out;
}
