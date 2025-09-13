// Provides current lat/lng and heading degrees (0..360)
// Uses GeoLocation LocationService (docs show example with onNorthAlignedOrientationUpdate)
export type Pose = { lat: number, lng: number, headingDeg: number }

let headingDeg = 0;
let lat = 0;
let lng = 0;

export function getPose(): Pose {
  return { lat, lng, headingDeg };
}

function startLocation() {
  // Create LocationService & configure accuracy per docs
  const ls = GeoLocation.createLocationService();
  ls.accuracy = GeoLocationAccuracy.Navigation;

  // Heading callback (north-aligned quaternion -> heading degrees)
  const onOrient = function(q) {
    headingDeg = GeoLocation.getNorthAlignedHeading(q);
  };
  ls.onNorthAlignedOrientationUpdate.add(onOrient);

  // Poll current position every 1s (as in docs)
  const tick = script.createEvent('DelayedCallbackEvent');
  tick.bind(() => {
    ls.getCurrentPosition(
      (geo) => {
        lat = geo.latitude;
        lng = geo.longitude;
      },
      (err) => { print("loc err: " + err); }
    );
    tick.reset(1.0);
  });
  tick.reset(0.0);
}

script.createEvent('OnStartEvent').bind(startLocation);
