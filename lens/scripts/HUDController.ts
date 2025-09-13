// @input Component.Text stepText
// @input Component.Image arrowImage

// Simple mapping from maneuver to arrow asset name
const MANEUVER_TO_ARROW = {
  "TURN_LEFT": "arrow_left",
  "TURN_RIGHT": "arrow_right",
  "UTURN_LEFT": "arrow_uturn",
  "UTURN_RIGHT": "arrow_uturn",
  "STRAIGHT": "arrow_straight"
};

export function showStep(instruction: string, maneuver: string) {
  if (script.stepText) {
    script.stepText.text = instruction || "";
  }
  if (script.arrowImage) {
    const name = MANEUVER_TO_ARROW[maneuver] || "arrow_straight";
    // In the Material, set baseTex to a texture named e.g. arrow_left.png
    // You can swap sprites by having multiple Image components,
    // or switch materials. For simplicity, keep one Image and swap textures in Inspector.
    // Here we just print the chosen arrow; swap actual textures via multiple images if preferred.
    print("Arrow: " + name);
  }
}
