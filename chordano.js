var NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var WHITE_KEY_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
var BLACK_KEY_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];

var WHITE_KEY_SPACE = 0.025;
var WHITE_KEY_WIDTH = 0.023;
var BLACK_KEY_WIDTH = 0.015;
var WHITE_KEY_HEIGHT = 0.010;
var BLACK_KEY_HEIGHT = 0.008;
var WHITE_KEY_DEPTH = 0.120;
var BLACK_KEY_DEPTH = 0.080;

var A4_NOTE_FREQUENCY = 440.0;
var A4_NOTE_INDEX = 57;

var NOTES_PER_OCTAVE = 12;

var WHITE_PROXY_CENTER = new THREE.Vector3(0.0, 0.01, -0.07);
var BLACK_PROXY_CENTER = new THREE.Vector3(0.0, 0.01, -0.05);

var KEY_PRESS_ROTATION = 0.085;

var Note = function(parameter) {
    if (typeof parameter === 'string') {
        // TODO: support string notes
        //var indexWithinOctave = NOTE_NAMES.indexOf(parameter.toUpperCase());
        //if (indexWithinOctave
    }
    // Uses MIDI note index. 0 = C0
    else if (typeof parameter === 'number') {
        this.noteIndex = parameter;
        this.noteIndexWithinOctave = parameter % 12;
    }
    else {
        throw new Exception("Note must be constructed with a number or a string.");
    }
    
    this.getNoteNameWithinOctave = function() {
        return NOTE_NAMES[this.noteIndexWithinOctave];
    };
    
    this.isWhiteKeyNote = function() {
        return WHITE_KEY_NOTES.indexOf(this.getNoteNameWithinOctave()) !== -1;
    };
    
    this.isBlackKeyNote = function() {
        return BLACK_KEY_NOTES.indexOf(this.getNoteNameWithinOctave()) !== -1;
    };
};

var audioContext = new (window.AudioContext || window.webkitAudioContext)();

var Synthesizer = function(waveType) {
    
    this.playNote = function(note) {
    
        var oscillator = audioContext.createOscillator();
        oscillator.type = waveType;
    
        var volume = audioContext.createGain();
        volume.gain.value = 0.0;
    
        oscillator.connect(volume);
        volume.connect(audioContext.destination);
    
        oscillator.start();
    
        console.log("Playing note " + note.noteIndex);
    
        oscillator.frequency.value = getFrequencyForNote(note);
        volume.gain.value = 0.2;
        
        volume.gain.exponentialRampToValueAtTime(0.0000001, audioContext.currentTime + 2.0);
    };
    
    function getFrequencyForNote(note) {
        var A4RelativeNoteIndex = note.noteIndex - A4_NOTE_INDEX;
        return A4_NOTE_FREQUENCY * Math.pow(2.0, A4RelativeNoteIndex / NOTES_PER_OCTAVE);
    }
};

var synthesizer = new Synthesizer('sine');

// 'isBlack' should be falsy for a white key,
// or truthy for a black key.
var PianoKey = function(isBlack) {
    this.material = new THREE.MeshLambertMaterial();
    
    if (isBlack) {
        this.geometry = new THREE.BoxBufferGeometry(BLACK_KEY_WIDTH,
                BLACK_KEY_HEIGHT, BLACK_KEY_DEPTH);
        this.material.color = new THREE.Color(0x202020);
    }
    else {
        this.geometry = new THREE.BoxBufferGeometry(WHITE_KEY_WIDTH,
                WHITE_KEY_HEIGHT, WHITE_KEY_DEPTH);
        this.material.color = new THREE.Color(0xE0E0E0);
    }
    
    this.mesh = new THREE.Mesh(this.geometry, this.material);
};

Object.assign(PianoKey.prototype, THREE.EventDispatcher.prototype);

function createProxyCenter(object, relativeCenter) {
    var proxy = new THREE.Object3D();
    object.position.set(-relativeCenter.x, -relativeCenter.y, -relativeCenter.z);
    proxy.add(object);
    return proxy;
}

// isFlattened is not supported yet.
var PianoKeyboard = function(numKeys, lowestNote, isFlattened) {

    this.numKeys = numKeys;
    // Instance of Note
    this.lowestNote = lowestNote;
    this.isFlattened = isFlattened; // TODO

    this.root = new THREE.Object3D();
    
    this.notes = [];
    this.keys = [];
    
    // Private, do not call externally TODO
    this.addNotes = function() {
        for (var i = 0; i < numKeys; ++i) {
            var noteIndex = this.lowestNote.noteIndex + i;
            var note = new Note(noteIndex);
            this.notes.push(note);
        }
    }
    
    // Private, do not call externally TODO
    this.addKeys = function() {
        for (var i = 0; i < this.numKeys; ++i) {
            var note = this.notes[i];
            var isBlackKey = note.isBlackKeyNote();
            var key = new PianoKey(isBlackKey);
            
            this.keys.push(key);
            
            var pianoWidth = this.getXOffsetForNote(this.notes[this.numKeys - 1]);
            
            var keyXOffset = this.getXOffsetForNote(note);
            var xCenterOffset = -1 * pianoWidth / 2.0;
            
            var keyYOffset = 0;
            var keyZOffset = 0;
            
            if (isBlackKey) {
                keyYOffset = (WHITE_KEY_HEIGHT + BLACK_KEY_HEIGHT) / 2.0;
                keyZOffset = -(WHITE_KEY_DEPTH - BLACK_KEY_DEPTH) / 2.0;
            }
            
            var proxyCenter = isBlackKey ? BLACK_PROXY_CENTER : WHITE_PROXY_CENTER;
            var proxy = createProxyCenter(key.mesh, proxyCenter);
            
            keyXOffset += proxyCenter.x;
            keyYOffset += proxyCenter.y;
            keyZOffset += proxyCenter.z;
            
            proxy.position.set(keyXOffset + xCenterOffset,
                               keyYOffset,
                               keyZOffset);
            
            this.root.add(proxy);
            
            key.mesh.userData.note = note;
            key.mesh.userData.piano = this;
            key.mesh.userData.key = key;
            
            key.addEventListener('keyDown', keyDownListener);
            key.addEventListener('keyUp', keyUpListener);
        }
    }
    
    this.getKeyByIndex = function(index) {
        return this.keys[index];
    };
    
    var thisPiano = this;
    
    function keyDownListener(keyDownEvent) {
        
        console.log("Key down event.");
        
        var key = keyDownEvent.target;
        var note = key.mesh.userData.note;
        synthesizer.playNote(note);
        
        var pressTween = new TWEEN.Tween(key.mesh.parent.rotation).to({x: KEY_PRESS_ROTATION}, 100);
        pressTween.start();
    }
    
    function keyUpListener(keyUpEvent) {
        var key = keyUpEvent.target;
        var releaseTween = new TWEEN.Tween(key.mesh.parent.rotation).to({x: 0.0}, 100);
        releaseTween.start();
    }
    
    this.getXOffsetForNote = function(note) {
    
        var offset = 0.0;
    
        var currentNote = this.lowestNote;
    
        for (var i = 1; i <= note.noteIndex - this.lowestNote.noteIndex; ++i) {
            var nextNote = this.notes[i];
            
            if (currentNote.isWhiteKeyNote() && nextNote.isWhiteKeyNote()) {
                offset += 1.0;
            }
            else {
                offset += 0.5;
            }
            
            // assume black keys are not adjacent.
            
            currentNote = nextNote;
        }
        
        return offset * WHITE_KEY_SPACE;
    }
    
    this.getNoteForKeyIndex = function(keyIndex) {
        return new Note(this.lowestNote.noteIndex + keyIndex);
    };
    
    this.getKeyForNote = function(noteIndex) {
        var relativeIndex = noteIndex - this.lowestNote.noteIndex;
        if (relativeIndex >= 0 && relativeIndex < this.numKeys) {
            return this.keys[relativeIndex];
        }
        // If the note is not in this piano, undefined is returned.
    };
    
    this.addNotes();
    this.addKeys();
};

var camera, scene, renderer, controls;
var controller1, controller2; // Vive controllers
var loader;
var mesh;
var inVR = false;

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.001, 50000.000 );
    camera.position.y = 0.300;
    camera.position.z = 0.600;
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x282828);
    
    WEBVR.checkAvailability().catch(function(message) {
        document.body.appendChild(WEBVR.getMessageContainer(message));
    }).then(function() {
        console.log("WebVR available.");
        
        controls = new THREE.VRControls(camera, function(error) {
            console.error("VR Controls Error: " + error);
        });
    
        controller1 = new THREE.ViveController(0);
        controller1.standingMatrix = controls.getStandingMatrix();
        scene.add(controller1);
        
        controller2 = new THREE.ViveController(1);
        controller2.standingMatrix = controls.getStandingMatrix();
        scene.add(controller2);
        
        controller1.addEventListener('triggerdown', function() {
            controllerTriggered(controller1);
        });
        controller2.addEventListener('triggerdown', function() {
            controllerTriggered(controller2);
        });
        
        var objectLoader = new THREE.OBJLoader();
        objectLoader.setPath('models/');
        objectLoader.load('vr_controller_vive_1_5.obj', function(object) {
            var textureLoader = new THREE.TextureLoader();
            textureLoader.setPath('textures/');
            
            var controller = object.children[0];
            controller.material.map = textureLoader.load('onepointfive_texture.png');
            controller.material.specularMap = textureLoader.load('onepointfive_spec.png');
            
            controller1.add(object.clone());
            controller2.add(object.clone());
        });
        
        WEBVR.getVRDisplay(function(display) {
            renderer.vr.setDevice(display);
            document.body.appendChild(WEBVR.getButton(display, renderer.domElement));
        });
        
        
        renderer.vr.enabled = true;
        renderer.vr.standing = true;
    });

    camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));

    var pianoY = 0;
    var pianoZ = 0;
    
    var pianos = [];
    
    var piano = new PianoKeyboard(88, new Note(21));
    piano.root.position.set(0.0, 0.0, 0.0);
    scene.add(piano.root);
    pianos.push(piano);
    
    piano = new PianoKeyboard(52, new Note(45));
    piano.root.position.set(0.000, 0.040, -0.150);
    scene.add(piano.root);
    pianos.push(piano);
    
    addLight();

    renderer = new THREE.WebGLRenderer(); // {antialias: true}
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
    
    var raycaster = new THREE.Raycaster();
    
    var keysDownMouse = [];
    
    function onmousedown(event) {
        
        var mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        var key = getKeyWithRay(raycaster.ray.origin, raycaster.ray.direction);
        if (key !== undefined) {
            console.log(key);
            
            key.dispatchEvent({'type': 'keyDown'});
            keysDownMouse.push(key);
        }
        else {
            console.log("Key is undefined.");
        }
    }
    
    function onmouseup(event) {
        keysDownMouse.forEach(function(key) {
            key.dispatchEvent({'type': 'keyUp'});
        });
        keysDownMouse = [];
    }
    
    window.addEventListener('mousedown', onmousedown, false);
    window.addEventListener('mouseup', onmouseup, false);

}

function addLight() {
    var directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    directionalLight.position.set(-0.5, 0.4, 0.8);
    scene.add(directionalLight);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.animate(render);
}

function render() {
    renderer.render(scene, camera);
    update();
}

function update() {
    TWEEN.update();
    if (controls) {
        controls.update();
        
        controller1.update();
        controller2.update();
    }
}

function controllerTriggered(controller) {
    var gamepad = controller.getGamepad();
    
    console.log(gamepad);
    console.log(controller);
    
    var pose = gamepad.pose;
    var position = controller.position;
    var orientation = controller.quaternion;
    
    console.log(position);
    console.log(orientation);
    
    var direction = getPointingDirection(controller);
    
    var key = getKeyWithRay(position, direction);
    if (key !== undefined) {
        key.dispatchEvent({'type': 'keyDown'});
    }
    else {
        console.log("Key is undefined.");
    }
}

function getPointingDirection(controller) {
    return new THREE.Vector3(0.0, 0.0, -1.0)
            .applyQuaternion(controller.quaternion)
            .normalize();
}

var _raycaster = new THREE.Raycaster();
function getKeyWithRay(origin, direction) {
    _raycaster.set(origin, direction);
    var intersects = _raycaster.intersectObjects(scene.children, true);
    for (var i = 0; i < intersects.length; ++i) {
        var intersection = intersects[i];
        var userData = intersection.object.userData;
        if ('key' in userData) {
            return userData.key;
        }
    }
    // returns undefined when no key intersects the ray.
}