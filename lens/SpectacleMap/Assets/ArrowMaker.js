// ArrowManager.js
// @input Asset.ObjectPrefab arrowPrefab
// @input SceneObject cameraObject
// @input float arrivalThresholdCm = 100.0   // 1m = 100 cm
// @input float arrowScale = 1.0             // custom scale multiplier

var coordinates = [
    new vec3(0, 0, -500),   // 5m ahead
    new vec3(0, 0, -1000),
    new vec3(0, 0, -1500),
    new vec3(0, 0, -2000),
    new vec3(0, 0, -2500),
    new vec3(0, 0, -3000),
    new vec3(0, 0, -3500),
    new vec3(0, 0, -4000),
    new vec3(0, 0, -4500),
    new vec3(0, 0, -5000)   // 30m ahead
];

var currentIndex = 0;
var currentArrow = null;

// Spawn arrow at given index
function spawnArrow(index) {
    if (index >= coordinates.length) {
        print("All arrows visited!");
        return;
    }

    // instantiate prefab
    currentArrow = script.arrowPrefab.instantiate(script.getSceneObject());
    var t = currentArrow.getTransform();

    // place relative to camera
    var camPos = script.cameraObject.getTransform().getWorldPosition();
    var worldPos = camPos.add(coordinates[index]); // offset from camera
    t.setWorldPosition(worldPos);

    // face the camera
    t.setWorldRotation(quat.lookAt(worldPos, camPos));

    // apply custom scale
    var s = script.arrowScale;
    t.setLocalScale(new vec3(s, s, s));

    print("Spawned arrow " + index + " at " + worldPos.toString());
}

// Remove arrow
function removeArrow() {
    if (currentArrow) {
        currentArrow.destroy();
        currentArrow = null;
    }
}

// Called every frame
function onUpdate(eventData) {
    if (!currentArrow) { return; }

    var camPos = script.cameraObject.getTransform().getWorldPosition();
    var arrowPos = currentArrow.getTransform().getWorldPosition();
    var dist = camPos.distance(arrowPos);

    if (dist <= script.arrivalThresholdCm) {
        print("Arrived at arrow " + currentIndex);
        removeArrow();
        currentIndex++;
        spawnArrow(currentIndex);
    }
}

// Kick things off
spawnArrow(currentIndex);

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);
