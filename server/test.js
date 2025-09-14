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

const pts = await sampler.sampleRoute(origin, dest, 5);
console.log(pts.slice(0, 10));
