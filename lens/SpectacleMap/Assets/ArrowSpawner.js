// ArrowSpawner.js
// @input Asset.ObjectPrefab arrow
// @input Asset.InternetModule internetModule
// @input SceneObject cameraObject
// @input SceneObject spawnParent     // optional: where to put instantiated arrows
// @input float pollInterval = 0.5    // seconds
// @input float arrivalThresholdCm = 100.0  // 1 m = 100 cm
// @input string serverBaseUrl = "http://192.168.1.100:5000"

var spawnedInst = null;
var spawnedId = null;
var pollTimer = 0;

// poll loop
function onUpdate(eventData) {
    var dt = eventData.getDeltaTime();
    pollTimer += dt;
    if (pollTimer >= script.pollInterval) {
        pollTimer = 0;
        pollServerForArrow();
    }

    // if we have an arrow, check proximity to camera
    if (spawnedInst) {
        checkProximity();
    }
}

function pollServerForArrow() {
    var req = RemoteServiceHttpRequest.create();
    req.url = script.serverBaseUrl + "/next_arrow";
    req.method = RemoteServiceHttpRequest.HttpRequestMethod.Get;
    script.internetModule.performHttpRequest(req, function(res) {
        if (res.statusCode !== 200) {
            // handle error or no response
            return;
        }
        try {
            var data = JSON.parse(res.body);
        } catch(e) {
            return;
        }
        if (data.action === "spawn") {
            spawnOrUpdateArrow(data);
        } else if (data.action === "none") {
            // if server says none, destroy/hide existing
            removeArrowLocal();
        }
    });
}

function spawnOrUpdateArrow(data) {
    // data: { id, bearing_deg, distance_m }
    // cap distance for visual (avoid huge world placements)
    var d = Math.min(data.distance_m, 20.0); // cap at 20 m
    if (!spawnedInst) {
        // instantiate prefab under spawnParent or the root
        var parent = script.spawnParent ? script.spawnParent : script.getSceneObject();
        spawnedInst = script.arrowPrefab.instantiate(parent);
        spawnedId = data.id;
    } else {
        spawnedId = data.id;
    }
    // position it relative to the camera
    setPositionFromBearingDistance(spawnedInst.getTransform(), data.bearing_deg, d);
    spawnedInst.enabled = true;
}

function setPositionFromBearingDistance(transform, bearingDeg, distanceMeters) {
    // Camera world pos & orientation
    var camTransform = script.cameraObject.getTransform();
    var camPos = camTransform.getWorldPosition();              // vec3 (in cm)
    var camRot = camTransform.getWorldRotation();              // quat
    // camera forward in world coords
    var camForward = camRot.multiplyVec3(vec3.forward());
    // rotate that forward vector around world-up by bearingDeg
    var yaw = quat.angleAxis(bearingDeg, vec3.up());
    var worldDir = yaw.multiplyVec3(camForward);
    var pos = camPos.add(worldDir.uniformScale(distanceMeters * 100.0)); // convert m -> cm
    transform.setWorldPosition(pos);
    // optionally orient arrow to face camera or point along worldDir
    transform.setWorldRotation(quat.lookAt(pos, camPos, vec3.up())); // make arrow face camera
}

function checkProximity() {
    var camPos = script.cameraObject.getTransform().getWorldPosition();
    var arrowPos = spawnedInst.getTransform().getWorldPosition();
    // distance in cm (Lens uses cm)
    var distCm = camPos.distance(arrowPos);
    if (distCm <= script.arrivalThresholdCm) {
        // notify server and remove local arrow
        notifyArrival(spawnedId);
        removeArrowLocal();
    }
}

function notifyArrival(id) {
    var req = RemoteServiceHttpRequest.create();
    req.url = script.serverBaseUrl + "/arrived";
    req.method = RemoteServiceHttpRequest.HttpRequestMethod.Post;
    req.body = JSON.stringify({id: id});
    req.headers = {"Content-Type": "application/json"};
    script.internetModule.performHttpRequest(req, function(res){
        // optional: handle server ack
    });
}

function removeArrowLocal() {
    if (!spawnedInst) return;
    try {
        spawnedInst.destroy(); // remove from scene
    } catch(e) {
        spawnedInst.enabled = false; // fallback: hide
    }
    spawnedInst = null;
    spawnedId = null;
}

var updateEvent = script.createEvent("UpdateEvent");
updateEvent.bind(onUpdate);
