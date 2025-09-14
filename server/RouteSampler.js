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
   * expressed RELATIVE TO ORIGIN (simple lat/lng deltas in degrees).
   * @param {{lat:number,lng:number}} origin
   * @param {{lat:number,lng:number}} destination
   * @param {number} intervalMeters
   * @returns {Promise<Array<{lat:number,lng:number}>>} // deltas in degrees
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
      'X-Goog-FieldMask': 'routes.polyline.encodedPolyline' // required by Routes v2
    };

    const resp = await fetch(this.routesURL, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`Routes API error ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    const encoded = data?.routes?.[0]?.polyline?.encodedPolyline;
    if (!encoded) return [];

    const absPoints = decodePolyline(encoded, 5).map(([lat, lng]) => ({ lat, lng }));
    const resampledAbs = resampleEveryMeters(absPoints, intervalMeters);
    const rel = resampledAbs.map(p => ({
      lat: p.lat - origin.lat,
      lng: p.lng - origin.lng
    }));

    // If you prefer meters instead of degree deltas, convert like this:
    // const lat0 = origin.lat * Math.PI / 180;
    // const relMeters = resampledAbs.map(p => ({
    //   x: (p.lng - origin.lng) * Math.cos(lat0) * 111320, // meters east
    //   y: (p.lat - origin.lat) * 111320                   // meters north
    // }));

    return rel;
  }
}

/* ---------------- helpers ---------------- */

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);
  const s = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function interpolateGC(a, b, f) {
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;
  const φ1 = toRad(a.lat), λ1 = toRad(a.lng);
  const φ2 = toRad(b.lat), λ2 = toRad(b.lng);
  const Δ = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1)/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin((λ2 - λ1)/2)**2
  ));
  if (Δ === 0) return { lat: a.lat, lng: a.lng };

  const A = Math.sin((1 - f) * Δ) / Math.sin(Δ);
  const B = Math.sin(f * Δ) / Math.sin(Δ);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  const φ = Math.atan2(z, Math.sqrt(x*x + y*y));
  const λ = Math.atan2(y, x);
  return { lat: toDeg(φ), lng: toDeg(λ) };
}

function resampleEveryMeters(poly, stepMeters) {
  if (!poly?.length) return [];
  if (poly.length === 1) return [poly[0]];

  const out = [poly[0]];
  let total = 0;
  let nextDist = 0;

  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i], b = poly[i+1];
    const segLen = haversineMeters(a, b);
    if (segLen === 0) continue;

    while (nextDist + stepMeters <= total + segLen) {
      nextDist += stepMeters;
      const f = (nextDist - total) / segLen;
      out.push(interpolateGC(a, b, f));
    }
    total += segLen;
  }

  const last = poly[poly.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.lat !== last.lat || lastOut.lng !== last.lng) out.push(last);
  return out;
}
