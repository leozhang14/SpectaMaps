// ArrowManager.js
// @input Asset.ObjectPrefab blueBallPrefab
// @input Asset.ObjectPrefab redBallPrefab
// @input SceneObject cameraObject
// @input float ballScale = 1.0
// @input string serverUrl   // Flask backend endpoint
// @input Component.DeviceLocationTrackingComponent locationTracker

var balls = {}; // index → SceneObject

// Convert relative coords (meters) to world space for Lens Studio
function coordToWorld(coord) {
    // coord = [x, z] relative in meters
    // y is fixed at -100 for visibility
    return new vec3(coord[0], -100, -coord[1]);
}

// Spawn a ball prefab at given position and scale
function spawnBall(prefab, worldPos, scale) {
    var obj = prefab.instantiate(script.getSceneObject());
    var t = obj.getTransform();
    t.setWorldPosition(worldPos);
    t.setLocalScale(new vec3(scale, scale, scale));
    return obj;
}

// Initialize balls from returned payload
function initializeBalls(payload) {
    var coords = payload.coords;
    if (!coords || coords.length === 0) {   // <-- fixed here
        print("No coordinates returned");
        return;
    }

    // Spawn blue balls
    for (var i = 0; i < coords.length - 1; i++) {
        var worldPos = coordToWorld(coords[i]);
        balls[i] = spawnBall(script.blueBallPrefab, worldPos, script.ballScale);
    }

    // Spawn big red ball at last coordinate
    var lastIndex = coords.length - 1;
    var lastWorldPos = coordToWorld(coords[lastIndex]);
    balls[lastIndex] = spawnBall(script.redBallPrefab, lastWorldPos, script.ballScale * 2.0);

    print("Spawned " + coords.length + " balls.");
}


// Send GPS + destination to Node.js backend
function sendRouteRequest(startLat, startLon, destLat, destLon) {
    var body = {
        origin: { lat: startLat, lng: startLon },
        destination: { lat: destLat, lng: destLon },
        intervalMeters: 5
    };

    var request = RemoteServiceHttpRequest.create();
    request.url = script.serverUrl + "/sampleRoute";  // Add the endpoint
    request.method = RemoteServiceHttpRequest.HttpRequestMethod.Post;
    request.setHeader("Content-Type", "application/json");
    request.body = JSON.stringify(body);

    print("Sending request to: " + request.url);
    print("Request body: " + request.body);

    var internetModule = require("LensStudio:InternetModule");
    
    internetModule.performHttpRequest(request, function(response) {
        print("Response status: " + response.statusCode);
        print("Response body: " + response.body);
        
        if (response.statusCode === 200) {
            try {
                var data = JSON.parse(response.body);
                // Convert {x, y} objects to [x, y] arrays
                var coordsArray = data.points.map(function(p) {
                    return [p.x, p.y];
                });
                var payload = { coords: coordsArray };
                initializeBalls(payload);
            } catch (e) {
                print("Failed to parse JSON response: " + e);
            }
        } else {
            print("HTTP error: " + response.statusCode + " - " + response.body);
        }
    });
}

// Get start GPS - Method 1: Using DeviceLocationTrackingComponent
function getStartLocationMethod1() {
    if (script.locationTracker) {
        var location = script.locationTracker.getLastKnownLocation();
        if (location) {
            return { lat: location.latitude, lon: location.longitude };
        }
    }
    
    // Fallback coordinates if location not available
    print("Location not available, using fallback coordinates");
    return { lat: 40.1234, lon: -80.4567 }; // Replace with your area
}

// Get start GPS - Method 2: Try global DeviceLocationTrackingSystem
function getStartLocationMethod2() {
    try {
        var locSystem = global.deviceInfoSystem.locationTrackingSystem;
        if (locSystem) {
            var location = locSystem.getLastKnownLocation();
            if (location) {
                return { lat: location.latitude, lon: location.longitude };
            }
        }
    } catch (e) {
        print("LocationTrackingSystem not available: " + e);
    }
    
    // Fallback coordinates
    print("Location not available, using fallback coordinates");
    return { lat: 40.1234, lon: -80.4567 }; // Replace with your area
}

// Get start GPS - Method 3: Manual input for testing
function getStartLocationManual() {
    // For testing - replace with actual coordinates in your area
    return { lat: 40.1234, lon: -80.4567 };
}

// Start sequence
function onStart() {
    // Try different methods to get location
    var start;
    
    try {
        start = getStartLocationMethod1();
    } catch (e) {
        print("Method 1 failed: " + e);
        try {
            start = getStartLocationMethod2();
        } catch (e2) {
            print("Method 2 failed: " + e2);
            start = getStartLocationManual();
        }
    }
    
    // destination is hard-coded here for testing
    var destLat = 40.1312412;
    var destLon = -80.45571;
    
    print("Using start location: " + start.lat + ", " + start.lon);
    sendRouteRequest(start.lat, start.lon, destLat, destLon);
}

// Wait a bit for location services to initialize
function delayedStart() {
    var startEvent = script.createEvent("DelayedCallbackEvent");
    startEvent.bind(onStart);
    startEvent.reset(1.0); // Wait 1 second
}

var initEvent = script.createEvent("OnStartEvent");
initEvent.bind(delayedStart);