// RouteArrowReceiver_fixed.js
// Lens Studio Script Component
// Listens for WebSocket messages with positions in METERS and instantiates an arrow prefab there.
//
// Expected message format:
// { "type": "points", "positions": [ { "x": 3.2, "y": 0.0, "z": 12.4 }, ... ] }
//

// @input string wsUrl = "ws://192.168.0.100:8080"
// @input SceneObject arrowPrefab
// @input float arrowScale = 1.0
// @input bool reuseSingleArrow = true   // if true, we move one arrow instead of creating many

var ws = null;
var singleArrow = null;
var arrows = [];

/** Safe logging that always calls print with a single string */
function toStr(x) {
    try {
        if (x === undefined) return "undefined";
        if (x === null) return "null";
        if (typeof x === "object") {
            try { return JSON.stringify(x); } catch (e) { return String(x); }
        }
        return String(x);
    } catch (e) {
        return String(x);
    }
}
function logMsg() {
    var out = "";
    for (var i = 0; i < arguments.length; i++) {
        if (i) out += " ";
        out += toStr(arguments[i]);
    }
    print(out); // single argument
}

/** Clone and place a new arrow */
function createArrowAt(x, y, z) {
    if (!script.arrowPrefab) {
        logMsg("No arrowPrefab set on script");
        return null;
    }

    var newObj;
    if (script.arrowPrefab.copyWholeHierarchy) {
        newObj = script.arrowPrefab.copyWholeHierarchy();
    } else if (script.arrowPrefab.instantiate) {
        newObj = script.arrowPrefab.instantiate();
    } else if (script.arrowPrefab.copy) {
        newObj = script.arrowPrefab.copy();
    } else {
        newObj = script.getSceneObject().createChild("arrowClone");
    }

    var t = newObj.getTransform ? newObj.getTransform() : null;
    if (t) {
        t.setWorldPosition(new vec3(x, y, z));
        t.setLocalScale(new vec3(script.arrowScale, script.arrowScale, script.arrowScale));
    } else {
        logMsg("Warning: couldn't get transform on new arrow object");
    }

    return newObj;
}

/** Update existing or create a new arrow */
function updateOrCreateArrowAt(x, y, z) {
    if (script.reuseSingleArrow) {
        if (!singleArrow) {
            singleArrow = createArrowAt(x, y, z);
            if (singleArrow) arrows.push(singleArrow);
        } else {
            var t = singleArrow.getTransform ? singleArrow.getTransform() : null;
            if (t) t.setWorldPosition(new vec3(x, y, z));
        }
        return singleArrow;
    } else {
        var newA = createArrowAt(x, y, z);
        if (newA) arrows.push(newA);
        return newA;
    }
}

/** Clear all arrows */
function clearArrows() {
    for (var i = 0; i < arrows.length; i++) {
        var obj = arrows[i];
        if (!obj) continue;
        if (obj.destroy) obj.destroy();
        else if (obj.enabled !== undefined) obj.enabled = false;
    }
    arrows = [];
    singleArrow = null;
}

/** Handle incoming JSON messages */
function handleMessageObj(msgObj) {
    if (!msgObj) return;

    if (msgObj.clear) {
        clearArrows();
        return;
    }

    var posArray = msgObj.positions || [];
    if (!Array.isArray(posArray)) return;

    for (var i = 0; i < posArray.length; i++) {
        var p = posArray[i] || {};
        // Use typeof checks to allow zero values
        var x = (typeof p.x === "number") ? p.x : ((typeof p.lng === "number") ? p.lng : 0);
        var y = (typeof p.y === "number") ? p.y : 0;
        var z = (typeof p.z === "number") ? p.z : ((typeof p.lat === "number") ? p.lat : 0);
        updateOrCreateArrowAt(x, y, z);
    }
}

/** Open the WebSocket */
function startWebSocket(url) {
    if (!url) {
        logMsg("No WebSocket URL set");
        return;
    }

    try {
        ws = new WebSocket(url);

        ws.onopen = function() {
            logMsg("WebSocket connected:", url);
        };

        ws.onmessage = function(evt) {
            try {
                var data = JSON.parse(evt.data);
                handleMessageObj(data);
            } catch (e) {
                logMsg("Message parse error:", e);
            }
        };

        ws.onclose = function(evt) {
            logMsg("WebSocket closed:", evt);
            ws = null;
        };

        ws.onerror = function(err) {
            logMsg("WebSocket error:", err);
        };
    } catch (err) {
        logMsg("WebSocket init error:", err);
    }
}

startWebSocket(script.wsUrl);
