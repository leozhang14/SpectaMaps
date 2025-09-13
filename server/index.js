import express from "express";
import dotenv from "dotenv";
import { decode } from "@googlemaps/polyline-codec";

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Utility: minimal sanitizer
function asLatLng(x) {
  if (Array.isArray(x) && x.length === 2) {
    return { lat: Number(x[0]), lng: Number(x[1]) };
  }
  if (typeof x === "object" && x) {
    return { lat: Number(x.lat), lng: Number(x.lng) };
  }
  throw new Error("Bad lat/lng");
}

// POST /route { origin:{lat,lng}, destination:{lat,lng} }
app.post("/route", async (req, res) => {
  try {
    const origin = asLatLng(req.body.origin);
    const destination = asLatLng(req.body.destination);

    const body = {
      origin: { location: { latLng: origin } },
      destination: { location: { latLng: destination } },
      travelMode: "WALK"
    };

    // Routes v2 computeRoutes: requires FieldMask and supports WALK. 
    // Endpoint & field mask per docs.
    const routesResp = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_KEY,
          "X-Goog-FieldMask":
            "routes.legs.steps.navigationInstruction,routes.legs.steps.polyline.encodedPolyline,routes.legs.steps.startLocation,routes.legs.steps.endLocation"
        },
        body: JSON.stringify(body)
      }
    );

    if (!routesResp.ok) {
      const txt = await routesResp.text();
      return res.status(500).json({ error: "Routes API error", details: txt });
    }

    const json = await routesResp.json();
    const route = json.routes?.[0];
    const leg = route?.legs?.[0];
    if (!leg) return res.json({ steps: [] });

    const steps = leg.steps.map((s) => {
      const enc = s.polyline?.encodedPolyline || "";
      // decode returns [lat, lng] pairs
      const poly = enc ? decode(enc, 5).map(([lat, lng]) => ({ lat, lng })) : [];
      return {
        start: s.startLocation?.latLng,
        end: s.endLocation?.latLng,
        instruction: s.navigationInstruction?.instructions || "",
        maneuver: s.navigationInstruction?.maneuver || "",
        polyline: poly
      };
    });

    res.json({ steps });
  } catch (e) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
