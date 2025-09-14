// server/index.js (ESM)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { RouteSampler } from './RouteSampler.js';

const app = express();

app.use(cors({
  origin: '*', // Allow all origins (for development)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const sampler = new RouteSampler(process.env.GOOGLE_MAPS_API_KEY);

// POST /sampleRoute  { origin:{lat,lng}, destination:{lat,lng}, intervalMeters?:number }
// Returns: { points: [ {lat, lng}, ... ] }  // relative-to-origin in DEGREES (your current sampler)
app.options('*', cors());

// Your existing route
app.post('/sampleRoute', async (req, res) => {
  try {
    const { origin, destination, intervalMeters = 5 } = req.body || {};
    if (!origin || !destination) return res.status(400).json({ error: 'origin and destination required' });
    
    console.log('Received request:', { origin, destination, intervalMeters });
    
    const coords = await sampler.sampleRoute(origin, destination, intervalMeters);
    console.log('Sampler returned:', coords.slice(0, 3)); // Log first 3 coordinates
    
    res.json(coords);
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));

