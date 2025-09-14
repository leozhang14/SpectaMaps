// ArrowManager.js
// @input Asset.ObjectPrefab arrowPrefab
// @input SceneObject cameraObject
// @input float arrivalThresholdCm = 100.0   // threshold to "reach" an arrow
// @input float arrowScale = 1.0             // scale multiplier
// @input int maxVisibleArrows = 10          // number of arrows shown at once

// Generate 100 coordinates (for testing)
var coordinates = [];
for (var i = 0; i < 100; i++) {
    coordinates.push(new vec3(0, -100, -500 * (i + 1))); // each arrow 5m further away
}

var currentIndex = 0;             // next arrow index to replace
var activeArrows = {};            // dictionary of index → arrow SceneObject

// Spawn an arrow at coordinates[index]
function spawnArrow(index) {
    if (index >= coordinates.length) { return; }

    var arrow = script.arrowPrefab.instantiate(script.getSceneObject());
    var t = arrow.getTransform();

    var camPos = script.cameraObject.getTransform().getWorldPosition();
    var worldPos = camPos.add(coordinates[index]);
    t.setWorldPosition(worldPos);

    // Make arrow face the camera
    t.setWorldRotation(quat.lookAt(worldPos, camPos));

    // Apply scale
    var s = script.arrowScale;
    t.setLocalScale(new vec3(s, s, s));

    activeArrows[index] = arrow;
    print("Spawned arrow " + index + " at " + worldPos.toString());
}

// Remove arrow at given index
function removeArrow(index) {
    if (activeArrows[index]) {
        activeArrows[index].destroy();
        delete activeArrows[index];
    }
}

// Initialize first batch of arrows
for (var i = 0; i < script.maxVisibleArrows; i++) {
    spawnArrow(i);
}

// Per-frame update
function onUpdate(eventData) {
    var camPos = script.cameraObject.getTransform().getWorldPosition();

    // Check each active arrow
    var indices = Object.keys(activeArrows);
    for (var j = 0; j < indices.length; j++) {
        var idx = parseInt(indices[j]);
        var arrowObj = activeArrows[idx];
        if (!arrowObj) { continue; }

        var arrowPos = arrowObj.getTransform().getWorldPosition();
        var dist = camPos.distance(arrowPos);

        // If within arrival distance, replace this arrow with one 10 steps ahead
        if (dist <= script.arrivalThresholdCm) {
            print("Arrived at arrow " + idx);
            removeArrow(idx);

            var newIndex = idx + script.maxVisibleArrows;
            spawnArrow(newIndex);
        }
    }
}

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);
