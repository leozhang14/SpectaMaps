// ArrowManager.js
// @input Asset.ObjectPrefab blueBallPrefab
// @input Asset.ObjectPrefab redBallPrefab
// @input SceneObject cameraObject
// @input float ballScale = 1.0
// @input string serverUrl   // Backend endpoint
// @input Component.DeviceLocationTrackingComponent locationTracker

var balls = {}; // index → SceneObject
var allCoords = []; // Store all coordinates
var maxVisibleBalls = 5; // Number of balls visible at once
var proximityThreshold = 50; // Distance threshold to trigger next ball (in world units)

// Convert relative coords to world space for Lens Studio
function coordToWorld(coord) {
    // coord = [x, y] from backend
    // Place balls at (x, 0, -y) in world space
    return new vec3(coord[0], 0, -coord[1]);
}

// Spawn a ball prefab at given position and scale
function spawnBall(prefab, worldPos, scale) {
    var obj = prefab.instantiate(script.getSceneObject());
    var t = obj.getTransform();
    t.setWorldPosition(worldPos);
    t.setLocalScale(new vec3(scale, scale, scale));
    return obj;
}

// Check proximity to current balls and load next ball if needed
function checkProximityAndUpdate() {
    if (allCoords.length === 0) return;
    
    // Get camera position
    var cameraPos = script.cameraObject.getTransform().getWorldPosition();
    
    // Check distance to each visible ball
    for (var key in balls) {
        var ballIndex = parseInt(key);
        var ball = balls[key];
        
        if (ball) {
            var ballPos = ball.getTransform().getWorldPosition();
            var distance = cameraPos.distance(ballPos);
            
            // If we're close to this ball
            if (distance < proximityThreshold) {
                // Remove this ball since we've reached it
                ball.destroy();
                delete balls[ballIndex];
                
                // Add the next ball if available
                var currentIndices = Object.keys(balls).map(k => parseInt(k));
                var maxIndex = currentIndices.length > 0 ? Math.max(...currentIndices) : -1;
                var nextBallIndex = maxIndex + 1;
                
                if (nextBallIndex < allCoords.length) {
                    var worldPos = coordToWorld(allCoords[nextBallIndex]);
                    
                    // Use red ball if it's the last coordinate, blue otherwise
                    var prefab = (nextBallIndex === allCoords.length - 1) ? 
                        script.redBallPrefab : script.blueBallPrefab;
                    var scale = (nextBallIndex === allCoords.length - 1) ? 
                        script.ballScale * 2.0 : script.ballScale;
                    
                    balls[nextBallIndex] = spawnBall(prefab, worldPos, scale);
                    print("Added ball " + nextBallIndex + ", removed ball " + ballIndex);
                }
                
                break; // Only process one ball per frame
            }
        }
    }
}

// Initialize balls from returned payload
function initializeBalls(payload) {
    var coords = payload.coords;
    if (!coords || coords.length === 0) {
        print("No coordinates returned");
        return;
    }

    // Store all coordinates
    allCoords = coords;
    
    print("Received " + allCoords.length + " coordinates, loading first " + maxVisibleBalls + " balls");
    
    // Load the first 5 balls
    var ballsToLoad = Math.min(maxVisibleBalls, allCoords.length);
    for (var i = 0; i < ballsToLoad; i++) {
        var worldPos = coordToWorld(allCoords[i]);
        
        // Use red ball if it's the last coordinate in the initial set, blue otherwise
        var prefab = (i === ballsToLoad - 1 && i === allCoords.length - 1) ? 
            script.redBallPrefab : script.blueBallPrefab;
        var scale = (i === ballsToLoad - 1 && i === allCoords.length - 1) ? 
            script.ballScale * 2.0 : script.ballScale;
        
        balls[i] = spawnBall(prefab, worldPos, scale);
    }
    
    print("Loaded initial " + ballsToLoad + " balls");
}

// Send GPS + destination to Node.js backend
function sendRouteRequest(startLat, startLng, destLat, destLon) {
    var body = {
        origin: { lat: startLat, lng: startLng },
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
                
                // Handle both formats: direct array or wrapped in points object
                var points = Array.isArray(data) ? data : data.points;
                
                if (!points || points.length === 0) {
                    print("No points returned in response");
                    return;
                }
                
                // Convert {x, y} objects to [x, y] arrays and multiply by 100
                var coordsArray = points.map(function(p) {
                    return [p.x * 100, p.y * 100];
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
            return { lat: location.latitude, lng: location.longitude };
        }
    }
    
    // Fallback coordinates if location not available
    print("Location not available, using fallback coordinates");
    return { lat: 43.47350648033407, lng: -80.5369534236106 };
}

// Get start GPS - Method 2: Try global DeviceLocationTrackingSystem
function getStartLocationMethod2() {
    try {
        var locSystem = global.deviceInfoSystem.locationTrackingSystem;
        if (locSystem) {
            var location = locSystem.getLastKnownLocation();
            if (location) {
                return { lat: location.latitude, lng: location.longitude };
            }
        }
    } catch (e) {
        print("LocationTrackingSystem not available: " + e);
    }
    
    // Fallback coordinates
    print("Location not available, using fallback coordinates");
    return { lat: 43.47350648033407, lng: -80.5369534236106 };
}

// Get start GPS - Method 3: Manual input for testing
function getStartLocationManual() {
    // For testing - replace with actual coordinates in your area
    return { lat: 43.47350648033407, lng: -80.5369534236106 };
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
    var destLat = 43.4729237;
    var destLon = -80.5371223;
    
    print("Using start location: " + start.lat + ", " + start.lng);
    sendRouteRequest(start.lat, start.lng, destLat, destLon);
}

// Wait a bit for location services to initialize
function delayedStart() {
    var startEvent = script.createEvent("DelayedCallbackEvent");
    startEvent.bind(onStart);
    startEvent.reset(1.0); // Wait 1 second
}

// Set up proximity checking
function setupProximityCheck() {
    var updateEvent = script.createEvent("UpdateEvent");
    updateEvent.bind(checkProximityAndUpdate);
}

var initEvent = script.createEvent("OnStartEvent");
initEvent.bind(function() {
    delayedStart();
    setupProximityCheck();
});