import 'dotenv/config';
import { RouteSampler } from './RouteSampler.js';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in .env');
  process.exit(1);
}

const sampler = new RouteSampler(API_KEY);

// Hardcoded origin & destination
const origin = { lat: 43.472401457564594, lng: -80.53597907446802 };
const dest   = { lat: 43.47299896633174, lng: -80.53728163622365 };

// Compass: 0°=North (+Y), 90°=East (+X)
function planarBearingDeg(dx, dy) {
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

const ptsPlanar = await sampler.sampleRoute(origin, dest, 5);
if (ptsPlanar.length < 2) {
  console.log("Not enough points.");
  process.exit(0);
}

// Direction from origin → first step
const dx = ptsPlanar[1].x - ptsPlanar[0].x;
const dy = ptsPlanar[1].y - ptsPlanar[0].y;
const directionDeg = planarBearingDeg(dx, dy);

// Rotation so first step = (0, d)
const theta = Math.atan2(dx, dy);
let ptsFacing = ptsPlanar.map(({ x, y }) => {
  const xr =  x * Math.cos(theta) - y * Math.sin(theta);
  const yr =  x * Math.sin(theta) + y * Math.cos(theta);
  return { x: xr, y: yr };
});

// Force exact origin (0,0)
const o = ptsFacing[0];
ptsFacing = ptsFacing.map(({ x, y }) => ({ x: x - o.x, y: y - o.y }));

// Round to cm
const round2 = (v) => Math.round(v * 100) / 100;
const ptsFacingRounded = ptsFacing.map(({ x, y }) => ({ x: round2(x), y: round2(y) }));

// Absolute end coordinates
const endCoords = { lat: dest.lat, lng: dest.lng };

// Final JSON output
console.log({
  direction: Math.round(directionDeg * 100) / 100,
  end: endCoords,
  coords: ptsFacingRounded
});
