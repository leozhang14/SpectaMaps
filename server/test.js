// server/test.js
import 'dotenv/config';
import { RouteSampler } from './RouteSampler.js';

// ---- config (edit these or pass via CLI) ----
const origin = cliCoord(2, 3) || { lat: 43.47326929451526, lng: -80.5369396475174 };
const dest   = cliCoord(4, 5) || { lat: 43.47335985377343, lng: -80.54014746779931 };
const intervalMeters = Number(process.argv[6] || 5); // optional 3rd arg

function cliCoord(latIdx, lngIdx) {
  const lat = parseFloat(process.argv[latIdx]);
  const lng = parseFloat(process.argv[lngIdx]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// ---- sanity: key present? ----
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in .env (server/.env if running from server/).');
  process.exit(1);
}

const sampler = new RouteSampler(API_KEY);

try {
  const coords = await sampler.sampleRoute(origin, dest, intervalMeters);

  console.log('origin:', origin);
  console.log('dest  :', dest);
  console.log('intervalMeters:', intervalMeters);
  console.log('points:', coords.length);

  if (coords.length > 0) {
    console.log('first :', coords[0]);                // should be { x: 0, y: 0 }
    console.log('second:', coords[1] || null);

    // Verify "faces forward": bearing of first step should be ~0° (toward +Y)
    if (coords.length >= 2) {
      const dx = coords[1].x - coords[0].x;
      const dy = coords[1].y - coords[0].y;
      const directionDeg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      console.log('first-step bearing (deg, 0=N/+Y):', Math.round(directionDeg * 100) / 100);
    }

    console.log('last  :', coords[coords.length - 1]);
    console.log('preview (first 10):', coords.slice(0, 10));
  } else {
    console.log('No coordinates returned (empty route or API issue).');
  }
} catch (e) {
  console.error('Test failed:', e?.message || e);
  process.exit(1);
}

/*
Usage:

# run with defaults (hardcoded coords, 5 m spacing)
cd server
node test.js

# or pass origin/dest (lat lng lat lng) and optional spacing:
node test.js 43.473269 -80.53694 43.473360 -80.54015 5
*/
