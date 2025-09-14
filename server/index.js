// server/index.js (ESM)
import 'dotenv/config';
import express from 'express';
import { RouteSampler } from './RouteSampler.js';

const app = express();
app.use(express.json());

const sampler = new RouteSampler(process.env.GOOGLE_MAPS_API_KEY);

// POST /sampleRoute  { origin:{lat,lng}, destination:{lat,lng}, intervalMeters?:number }
// Returns: { points: [ {lat, lng}, ... ] }  // relative-to-origin in DEGREES (your current sampler)
app.post('/sampleRoute', async (req, res) => {
  try {
    const { origin, destination, intervalMeters = 5 } = req.body || {};
    if (!origin || !destination) return res.status(400).json({ error: 'origin and destination required' });
    const coords = await sampler.sampleRoute(origin, destination, intervalMeters);
    res.json(coords);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

