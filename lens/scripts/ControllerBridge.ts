import * as Actions from "./ActionService";

// This script expects you to drag it onto the same object that exposes
// gamepad events from Snap's BLE Game Controller sample (e.g., “onSouthButtonDown”, etc.).
// Connect those events in the Inspector to these functions:

// Example handlers you can wire in the Inspector:
export function onSouthButtonDown() { // A
  Actions.nextStep();
}
export function onEastButtonDown() { // B
  Actions.prevStep();
}
export function onStartButtonDown() { // options/start
  // Recompute the route to a hard-coded dest or prompt user flow
}
