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
   * Fetch a walking route and return points every `intervalMeters` along it,
   * expressed as PLANAR coordinates (meters) RELATIVE TO ORIGIN.
   * Output shape: Array<{ x:number, y:number }> with [0] = {0,0}.
   */
  async sampleRoute(origin, destination, intervalMeters = 5) {
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

    // Decode to absolute lat/lng points
    const absPoints = decodePolyline(encoded, 5).map(([lat, lng]) => ({ lat, lng }));

    // Resample at fixed planar distances (uses local flat metric)
    const resampledAbs = resampleEveryMetersPlanar(absPoints, intervalMeters);

    // Convert to planar meters relative to origin (east/north)
    const lat0 = origin.lat * Math.PI / 180;
    const toMetersFromOrigin = (p) => ({
      x: (p.lng - origin.lng) * Math.cos(lat0) * 111320, // east
      y: (p.lat - origin.lat) * 111320                   // north
    });

    const planar = resampledAbs.map(toMetersFromOrigin);

    // Ensure first point is exactly zeroed (kill any sub-mm noise)
    if (planar.length) {
      const o = planar[0];
      if (o.x !== 0 || o.y !== 0) {
        for (let i = 0; i < planar.length; i++) {
          planar[i] = { x: planar[i].x - o.x, y: planar[i].y - o.y };
        }
      }
    }
    return planar;
  }
}

/* ---------------- helpers ---------------- */

/**
 * Resample polyline at fixed stepMeters using a planar metric:
 * distances measured in meters in a local flat projection (east/north),
 * linear interpolation in lat/lng space (adequate for small steps).
 */
function resampleEveryMetersPlanar(poly, stepMeters) {
  if (!poly?.length) return [];
  if (poly.length === 1) return [poly[0]];

  const out = [poly[0]];
  let accumulated = 0;
  let nextTarget = stepMeters;

  // Helper to get planar distance between two lat/lng points near mid-lat
  const planarDist = (a, b) => {
    const lat0 = ((a.lat + b.lat) / 2) * Math.PI / 180;
    const dx = (b.lng - a.lng) * Math.cos(lat0) * 111320;
    const dy = (b.lat - a.lat) * 111320;
    return Math.hypot(dx, dy);
  };

  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i+1];
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

  // Ensure the final vertex is included
  const last = poly[poly.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.lat !== last.lat || lastOut.lng !== last.lng) out.push(last);
  return out;
}
