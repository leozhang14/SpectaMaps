// @input Asset.InternetModule internetModule
// @input string serverBaseUrl = "http://YOUR-LAPTOP-IP:8080"

type LatLng = { lat: number, lng: number }
type Step = {
  start?: LatLng,
  end?: LatLng,
  instruction: string,
  maneuver: string,
  polyline: LatLng[]
}

export async function fetchRoute(origin: LatLng, destination: LatLng): Promise<Step[]> {
  const url = script.serverBaseUrl + "/route";
  const req = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination })
  }); // Request is wearable-only and supported. 
  // Spectacles-only fetch via InternetModule.
  const resp = await script.internetModule.fetch(req);
  if (resp.status !== 200) {
    print("Route fetch failed: " + resp.status);
    return [];
  }
  const data = await resp.json(); // supported in Response/Request API
  return data.steps as Step[];
}
