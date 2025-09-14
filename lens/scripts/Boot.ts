// @input Component.Text stepText
// @input Component.Image arrowImage
// @input Asset.InternetModule internetModule
// @input string serverBaseUrl
// @input bool autoStart = false
// @input float destLat = 43.6426
// @input float destLng = -79.3871

import * as Actions from "./ActionService";
import { fetchRoute } from "./RouteClient";

// Wire up Inspector inputs to modules/scripts
// (Assign InternetModule and serverBaseUrl in the Inspector)
global.Nav = Actions;

script.createEvent("OnStartEvent").bind(() => {
  if (script.autoStart) {
    Actions.computeAndStart({ lat: script.destLat, lng: script.destLng });
  }
});
