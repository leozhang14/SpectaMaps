import { fetchRoute } from "./RouteClient";
import { getPose } from "./LocationTracker";
import { showStep } from "./HUDController";

type Step = {
  instruction: string,
  maneuver: string,
  polyline: { lat:number, lng:number }[]
}

let steps: Step[] = [];
let stepIdx = 0;

export async function computeAndStart(dest: { lat:number, lng:number }) {
  const pose = getPose();
  const routeSteps = await fetchRoute({ lat: pose.lat, lng: pose.lng }, dest);
  if (!routeSteps || routeSteps.length === 0) {
    print("No route/steps");
    return;
  }
  steps = routeSteps;
  stepIdx = 0;
  render();
}

export function nextStep() {
  if (steps.length === 0) return;
  stepIdx = Math.min(stepIdx + 1, steps.length - 1);
  render();
}

export function prevStep() {
  if (steps.length === 0) return;
  stepIdx = Math.max(stepIdx - 1, 0);
  render();
}

function render() {
  const s = steps[stepIdx];
  showStep(s.instruction, s.maneuver);
}
