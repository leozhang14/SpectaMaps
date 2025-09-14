import 'dotenv/config';
import { RouteSampler } from './RouteSampler.js';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in .env');
  process.exit(1);
}

const sampler = new RouteSampler(API_KEY);

const origin = { lat: 37.7937, lng: -122.3965 };
const dest   = { lat: 37.7952, lng: -122.3937 };

function bearingDegrees(p1, p2) {
  // Calculate bearing in degrees from p1 → p2
  const toRad = (x) => (x * Math.PI) / 180;
  const toDeg = (x) => (x * 180) / Math.PI;

  const φ1 = toRad(p1.lat);
  const φ2 = toRad(p2.lat);
  const Δλ = toRad(p2.lng - p1.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360; // normalize 0–360
}

const ptsAbs = await sampler.sampleRoute(origin, dest, 5);

// Convert relative to meters
const lat0 = origin.lat * Math.PI / 180;
const ptsMeters = ptsAbs.map(p => ({
  x: (p.lng) * Math.cos(lat0) * 111320,
  y: (p.lat) * 111320
}));

// Compute initial direction using the very first meter
// Take origin and interpolate 1m along first step
const first = ptsAbs[0];
const second = ptsAbs[1];

// Haversine distance first->second
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lng - a.lng);
  const s = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Fraction along first segment that corresponds to 1 meter
const dist = haversineMeters(first, second);
const f = Math.min(1, 1 / dist); // fraction of 1m along segment

// Linear interpolate in lat/lng
const interp = {
  lat: first.lat + (second.lat - first.lat) * f,
  lng: first.lng + (second.lng - first.lng) * f
};

const direction = bearingDegrees(origin, interp);

// Prepend direction as first element
const result = [{ direction }, ...ptsMeters.slice(0, 10)];

console.log(result);
