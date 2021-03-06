var gl;
var shaderProgram;
var vertexPositionBuffer, vertexIndexBuffer, vertexNormalBuffer;
var myTextures = [];
var textureLoaded = false;
var xLightPos = 0;
var yLightPos = 0;
var zLightPos = 0;
var rotate = 0.0;
var rotateX = 0.0;
var image_name = "bunny";
var numTextures = 7;
var texturesLoaded = [];
var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;
var masterRotMat = mat4.create();
mat4.identity(masterRotMat);

var Settings = function() {
    this['Orbit Light'] = false;
    this.speed = .8;
    this.image = 'turbine';
    this.drawingStyle = 0;
    this['Drag to rotate'] = function() {};
};
var settings = new Settings();
var gui = new dat.GUI();

/* test */
var sampleIndex = 0;

function degToRad(degrees) {
  return degrees * Math.PI / 180;
};

function initGL(canvas) {
    try {
        gl = canvas.getContext("webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    }
    catch (e) {
    }
    if (!gl) {
        alert("cannot initialize webGL");
    }
}

function loadShader(id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
    alert ("shader id does not exist: " + id);
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == Node.TEXT_NODE) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
    alert ("gl createShader failed: " + id);
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function initShaders() {
    var fragmentShader = loadShader("shader-fs");
    var vertexShader = loadShader("shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialize shaders");
    }

    gl.useProgram(shaderProgram);
}

function initBuffers() {
    vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
    var vertices = [];
    for (i=0; i<myVertexList.length; i++) {
        vertices.push(myVertexList[i].x);
        vertices.push(myVertexList[i].y);
        vertices.push(myVertexList[i].z);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    vertexPositionBuffer.itemSize = 3;
    vertexPositionBuffer.numItems = myVertexList.length;

    vertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
    var indices = [];
    for (i=0; i<myFaceList.length; i++) {
        indices.push(myFaceList[i].vertexList[0].id);
        indices.push(myFaceList[i].vertexList[1].id);
        indices.push(myFaceList[i].vertexList[2].id);
    }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    vertexIndexBuffer.itemSize = 1;
    vertexIndexBuffer.numItems = myFaceList.length*3;  //this is a bit different, be careful

    vertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);

    //this part is for building the vertex normals -- it looks complicated because
    // we are computing the "smooth" normals of a vertex, which is defined as the "average"
    // of all the normals at a vertex.
    //That is, let's say that a vertex is at the intersection of 5 triangles, each triangle
    // will have its own normal (computed using the cross product).
    //To determine the "smooth" normal at that vertex, we add up all 5 triangle normals and then
    // divide by 5.
    //In order to do this, there are two steps:
    //  1. we sum up all the normals.
    //  2. While we are doing that, we need to keep a counter for the number of normals at a vertex
    //After we're done aggregating the normals, we take the "average" of the nomrals

    var numNormals = new Array(myVertexList.length);
    for (i=0; i<myVertexList.length; i++) {numNormals[i] = 0;}
    var normals = new Array(myVertexList.length*3);
    for (i=0; i<myVertexList.length*3; i++) {normals[i] = 0;}

    for (i = 0; i < myFaceList.length * 3; i = i + 3) {
        var index0 = indices[i];
        var index1 = indices[i + 1];
        var index2 = indices[i + 2];

        var outputx, outputy, outputz;
        // using the setNormal function from below we normalize the vectors
        var computeNormal = function () {
        	var x1 = vertices[index0 * 3 + 0];
        	var y1 = vertices[index0 * 3 + 1];
        	var z1 = vertices[index0 * 3 + 2];
        	var x2 = vertices[index1 * 3 + 0];
        	var y2 = vertices[index1 * 3 + 1];
        	var z2 = vertices[index1 * 3 + 2];
        	var x3 = vertices[index2 * 3 + 0];
        	var y3 = vertices[index2 * 3 + 1];
        	var z3 = vertices[index2 * 3 + 2];


        	var v1x, v1y, v1z;
        	var v2x, v2y, v2z;
        	var cx, cy, cz;

        	//find vector between x2 and x1
        	v1x = x1 - x2;
        	v1y = y1 - y2;
        	v1z = z1 - z2;

        	//find vector between x3 and x2
        	v2x = x2 - x3;
        	v2y = y2 - y3;
        	v2z = z2 - z3;
        	var
        	//cross product v1xv2

        	cx = v1y * v2z - v1z * v2y;
        	cy = v1z * v2x - v1x * v2z;
        	cz = v1x * v2y - v1y * v2x;

        	//normalize

        	var length = Math.sqrt(cx * cx + cy * cy + cz * cz);
        	cx = cx / length;
        	cy = cy / length;
        	cz = cz / length;

        	outputx = cx;
        	outputy = cy;
        	outputz = cz;
        }();

        numNormals[index0]++;
        numNormals[index1]++;
        numNormals[index2]++;

        normals[index0 * 3 + 0] += outputx;
        normals[index0 * 3 + 1] += outputy;
        normals[index0 * 3 + 2] += outputz;

        normals[index1 * 3 + 0] += outputx;
        normals[index1 * 3 + 1] += outputy;
        normals[index1 * 3 + 2] += outputz;

        normals[index2 * 3 + 0] += outputx;
        normals[index2 * 3 + 1] += outputy;
        normals[index2 * 3 + 2] += outputz;
    }

    for (i = 0; i < myVertexList.length; i++) {
        normals[i * 3 + 0] = normals[i * 3 + 0] / numNormals[i];
        normals[i * 3 + 1] = normals[i * 3 + 1] / numNormals[i];
        normals[i * 3 + 2] = normals[i * 3 + 2] / numNormals[i];
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    vertexNormalBuffer.itemSize = 3;
    vertexNormalBuffer.numItems = myVertexList.length;

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);
}

function onImageLoad() {
    if (texturesLoaded.length == 0) {
        console.log("Error already loaded all images");
        return;
    }
    var index = texturesLoaded.pop();
    gl.bindTexture(gl.TEXTURE_2D, myTextures[index]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  //this line flips the texture image upside down
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, myTextures[index].image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    if (texturesLoaded.length == 0) {
        textureLoaded = true;
    }
}

function initTexture() {
    for (var i = 0; i < numTextures; i++) {
        myTextures.push(gl.createTexture());
        myTextures[i].image = new Image();
        /* problem with asynchronous calls to this
         * I added indices to a queue (texturesLoaded) and
            go through the queue adding the images to my list
            if we try to pass an integer directly to it, it will
            overwrite that every time with the last integer
         */
        myTextures[i].image.onload = function(i) { onImageLoad(); }
        texturesLoaded.unshift(i);
        myTextures[i].image.src = "images/shading/" + i + "0.gif";
    }
    /*
    for (var i = 0; i < numTextures; i++) {
        myTextures.push(gl.createTexture());
        myTextures[i + numTextures].image = new Image();
        // problem with asynchronous calls to this
        // I added indices to a queue (texturesLoaded) and
        //    go through the queue adding the images to my list
        //    if we try to pass an integer directly to it, it will
        //    overwrite that every time with the last integer
        //
        myTextures[i + numTextures].image.onload = function(i) { onImageLoad(); }
        texturesLoaded.unshift(i + numTextures);
        myTextures[i + numTextures].image.src = "images/shading/" + i + "135.gif";
    }
    */
}

function pushMatrix(perspectiveMatrix, modelviewMatrix) {
    var matrix = mat4.clone(modelviewMatrix);
    stack.push(matrix);
    matrix = mat4.clone(perspectiveMatrix);
    stack.push(matrix);
}

function popMatrix(perspectiveMatrix, modelviewMatrix) {
    if (stack.length < 2) {
        console.log("Trying to pop when less than 2 elements on stack");
        return;
    }
    var perspectiveMatrix = stack.pop();
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, perspectiveMatrix);

    var modelviewMatrix = stack.pop();
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, modelviewMatrix);
}

function drawLightSource(perspectiveMatrix, modelviewMatrix){
    if (settings['Orbit Light']) {
        xLightPos += settings.speed / 100;
        zLightPos += settings.speed / 100;
    	yLightPos = 0;
    }

    // Actual values that we calculate and send to the shader
    var xLightValue = .5 * Math.sin(xLightPos);
    var yLightValue = .5 * yLightPos;
    var zLightValue = .5 * Math.cos(zLightPos);

    shaderProgram.lightUniform = gl.getUniformLocation(shaderProgram, "light_vector");
    gl.uniform4f(shaderProgram.lightUniform, xLightValue, yLightValue, zLightValue, 1.0);
        shaderProgram.colorUniform = gl.getUniformLocation(shaderProgram, "sun");
        gl.uniform1i(shaderProgram.colorUniform, 1);
}

function drawScene() {
//due to Javascript's asynchronous behavior for file loading, we use flags to prevent rendering
//  when the textures have not been loaded
    if (textureLoaded == false) {
        return;
    }

    if (settings.image != image_name) {
        image_name = settings.image;
        myVertexList = [];
        myFaceList = [];
        parse("images/" + image_name + ".ply", myVertexList, myFaceList);
    }

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    gl.useProgram(shaderProgram);

    shaderProgram.colorUniform = gl.getUniformLocation(shaderProgram, "sun");
    gl.uniform1i(shaderProgram.colorUniform, 0);

    shaderProgram.drawingStyle = gl.getUniformLocation(shaderProgram, "drawingStyle");
    gl.uniform1i(shaderProgram.drawingStyle, settings.drawingStyle);

//setting up the camera
    var perspectiveMatrix = mat4.create(); //defaults to an identity matrix
    mat4.perspective(perspectiveMatrix, 45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, perspectiveMatrix);


    var modelviewMatrix = mat4.create();  //defaults to an identity matrix
    mat4.translate(modelviewMatrix, modelviewMatrix, [0.0, 0.0, -1]);

    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, modelviewMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, vertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    shaderProgram.colorUniform = gl.getUniformLocation(shaderProgram, "color");
    gl.uniform3f(shaderProgram.colorUniform, -1, -1, -1);

    pushMatrix(perspectiveMatrix, modelviewMatrix);
        mat4.multiply(modelviewMatrix, modelviewMatrix, masterRotMat);
        shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
        gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, modelviewMatrix);

        for (var i = 0; i < myTextures.length; i++) {
        	gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, myTextures[i]);
        }

        shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "textures");
        gl.uniform1iv(shaderProgram.samplerUniform, [0,1,2,3,4,5,6]);


        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
        gl.drawElements(gl.TRIANGLES, vertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
    popMatrix();
    drawLightSource(perspectiveMatrix, modelviewMatrix);
}

function animateMyScene() {
	requestAnimationFrame(animateMyScene);  //javascript convention for animation
	drawScene();
}

function webGLStart() {
    var canvas = document.getElementById("myCanvas");
    initGL(canvas);
    initShaders();

    initTexture();
    var canvasSize = gl.getUniformLocation(shaderProgram, "canvasSize");
    gl.uniform2f(canvasSize, canvas.width, canvas.height);

    parse("images/" + image_name + ".ply", myVertexList, myFaceList);
//initBuffers() would normally be called here, but it's now called from within
// parse() because of the asynchronous nature of javascript file loading
//initBuffers();


    gl.clearColor(0.0, 0.0, 0.0, 0.0);  //set up the background color (transparent)
    gl.enable(gl.DEPTH_TEST);

    canvas.onmousedown = mouseClick;
    document.onmouseup = handleMouseUp;
    document.onmousemove = mouseMove;
    animateMyScene();
};

function mouseMove(event) {
    if (!mouseDown) {
        return;
    }
    var newX = event.clientX;
    var newY = event.clientY;

    var deltaX = newX - lastMouseX;
    var deltaY = newY - lastMouseY;

    var newRotationMatrix = mat4.create();
    mat4.identity(newRotationMatrix);
    mat4.rotate(newRotationMatrix, newRotationMatrix, degToRad(deltaX / 10), [0,1,0]);
    mat4.rotate(newRotationMatrix, newRotationMatrix, degToRad(deltaY / 10), [1,0,0]);

    mat4.multiply(masterRotMat, newRotationMatrix, masterRotMat);

    lastMouseX = newX;
    lastMouseY = newY;
}

function mouseClick(event) {
    mouseDown = true;

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
}

function handleMouseUp(event) {
    mouseDown = false;
}

$(function() {
    gui.add(settings, 'Orbit Light');
    gui.add(settings, 'speed', -5, 5);
    gui.add(settings, 'image', ['bunny', 'dragon', 'happy', 'sphere', 'spider', 'turbine', 'dolphins']);
    gui.add(settings, 'drawingStyle', {'drawing': 0, 'drawing no rotation': 1, 'illuination': 2});
    gui.add(settings, "Drag to rotate");
});
