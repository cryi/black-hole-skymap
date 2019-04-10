var glMaxCubeMapTextureSize;
var canvas;
var gl;
var glutil;

var objectTypes = [
	'Schwarzschild Black Hole',	
	'Kerr Black Hole degeneracy',	
	'Kerr Black Hole',	
	'Alcubierre Warp Drive Bubble',
];
var objectType = objectTypes[0];
var objectDist = 10;
var blackHoleMass = .5;
var blackHoleCharge = 0.;
var blackHoleAngularVelocity = 0.;

var warpBubbleThickness = .01;
var warpBubbleVelocity = 1.5;
var warpBubbleRadius = 1;

var deltaLambda = 1;	//ray forward iteration
var simTime = 0;

var ident4 = mat4.create();

function tanh(x) {
	var exp2x = Math.exp(2 * x);
	return (exp2x - 1) / (exp2x + 1);
}

function sech(x) {
	var expx = Math.exp(x);
	return 2. * expx / (expx * expx + 1.);
}

function sechSq(x) {
	var y = sech(x);
	return y * y;
}

var shaderCommonCode = mlstr(function(){/*
float tanh(float x) {
	float exp2x = exp(2. * x);
	return (exp2x - 1.) / (exp2x + 1.);
}

float sech(float x) {
	float expx = exp(x);
	return 2. * expx / (expx * expx + 1.);
}

float sechSq(float x) {
	float y = sech(x);
	return y * y;
}

mat3 outerProduct(vec3 a, vec3 b) {
	return mat3(
		vec3(a.x * b.x, a.x * b.y, a.x * b.z),
		vec3(a.y * b.x, a.y * b.y, a.y * b.z),
		vec3(a.z * b.x, a.z * b.y, a.z * b.z)
	);
}

mat4 outerProduct(vec4 a, vec4 b) {
	return mat4(
		vec4(a.x * b.x, a.x * b.y, a.x * b.z, a.x * b.w),
		vec4(a.y * b.x, a.y * b.y, a.y * b.z, a.y * b.w),
		vec4(a.z * b.x, a.z * b.y, a.z * b.z, a.z * b.w),
		vec4(a.w * b.x, a.w * b.y, a.w * b.z, a.w * b.w)
	);
}

mat4 transpose(mat4 m) {
	mat4 r;
	r[0][0] = m[0][0];
	r[1][0] = m[0][1];
	r[2][0] = m[0][2];
	r[3][0] = m[0][3];
	r[0][1] = m[1][0];
	r[1][1] = m[1][1];
	r[2][1] = m[1][2];
	r[3][1] = m[1][3];
	r[0][2] = m[2][0];
	r[1][2] = m[2][1];
	r[2][2] = m[2][2];
	r[3][2] = m[2][3];
	r[0][3] = m[3][0];
	r[1][3] = m[3][1];
	r[2][3] = m[3][2];
	r[3][3] = m[3][3];
	return r;
}

vec3 quatRotate(vec4 q, vec3 v) { 
	return v + 2. * cross(cross(v, q.xyz) - q.w * v, q.xyz);
}

vec4 quatConj(vec4 q) {
	return vec4(q.xyz, -q.w);
}
*/});

function stupidPrint(s) {
/*
	$.each(s.split('\n'), function(_,l) {
		console.log(l);
	});
*/
}

var SQRT_1_2 = Math.sqrt(.5);
//forward-transforming (object rotations)
var angleForSide = [
	[0, -SQRT_1_2, 0, -SQRT_1_2],
	[0, SQRT_1_2, 0, -SQRT_1_2],
	[SQRT_1_2, 0, 0, -SQRT_1_2],
	[SQRT_1_2, 0, 0, SQRT_1_2],
	[0, 0, 0, -1],
	[0, -1, 0, 0]
];




//names of all renderers
var skyboxRendererClassNames = [
	'GeodesicTestCubeRenderer',
	'GeodesicSWRenderer',
	'GeodesicFBORenderer'
];

var skyboxRenderer;
var skyboxRendererClassName;

//I would like to eventually instanciate all renderers and allow them to be toggled at runtime
//however courtesy of the scenegraph's globals (which I am not too happy about my current design), this will take a bit more work
//so in the mean time, this will take a page reset every time the glutil changes

function resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	glutil.resize();

	var info = $('#info');
	var width = window.innerWidth 
		- parseInt(info.css('padding-left'))
		- parseInt(info.css('padding-right'));
	info.width(width);
	var height = window.innerHeight
		- parseInt(info.css('padding-top'))
		- parseInt(info.css('padding-bottom'));
	info.height(height - 32);
}

// render loop

function update() {
	skyboxRenderer.update();
	requestAnimFrame(update);
};

var mouseMethod = 'rotateCamera';
//var mouseMethod = 'rotateObject';

var drawMethod = 'background';

var mouse;

var objectAngle = quat.create();

var initAngle = [];
var initAngleInv = [];

function main3(skyTex) {
	skyboxRenderer.initScene(skyTex);

	$('input[name="mouseMethod"]').click(function() { window[$(this).attr('name')] = $(this).val(); });
	$('input[name="drawMethod"]').click(function() { window[$(this).attr('name')] = $(this).val(); });

	var tmpQ = quat.create();	
	mouse = new Mouse3D({
		pressObj : canvas,
		move : function(dx,dy) {
			var rotAngle = Math.PI / 180 * .01 * Math.sqrt(dx*dx + dy*dy);
			quat.setAxisAngle(tmpQ, [dy, dx, 0], rotAngle);

			if (mouseMethod == 'rotateCamera') {
				quat.mul(glutil.view.angle, glutil.view.angle, tmpQ);
				quat.normalize(glutil.view.angle, glutil.view.angle);
			} else if (mouseMethod == 'rotateObject') {
				//rotate into view space
				quat.mul(tmpQ, tmpQ, initAngleInv);
				quat.mul(tmpQ, initAngle, tmpQ);
				quat.conjugate(tmpQ, tmpQ);

				quat.mul(objectAngle, tmpQ, objectAngle);
				quat.normalize(objectAngle, objectAngle);
skyboxRenderer.resetField();
			}
		},
		zoom : function(dz) {
			glutil.view.fovY *= Math.exp(-.0003 * dz);
			glutil.view.fovY = Math.clamp(glutil.view.fovY, 1, 179);
			glutil.updateProjection();
		}
	});
	
	
	$('#runSimulation').click(function() {
		skyboxRenderer.runSimulation = $('#runSimulation').is(':checked');
	});
	skyboxRenderer.runSimulation = $('#runSimulation').is(':checked');

	skyboxRenderer.resetField();

	$(window).resize(resize);
	resize();
	update();
}


var main2Initialized = false;
function main2() {
	if (main2Initialized) {
		console.log("main2 got called twice again.  check the preloader.");
		return;
	}
	main2Initialized = true; 
	
	glutil.view.zNear = .1;
	glutil.view.zFar = 100;
	glutil.view.fovY = 90;
	quat.mul(glutil.view.angle, /*90' x*/[SQRT_1_2,0,0,SQRT_1_2], /*90' -y*/[0,-SQRT_1_2,0,SQRT_1_2]);
	quat.copy(initAngle, glutil.view.angle);
	quat.conjugate(initAngleInv, initAngle);

	console.log('creating skyTex');
	var skyTex = new glutil.TextureCube({
		flipY : true,
		generateMipmap : true,
		magFilter : gl.LINEAR,
		minFilter : gl.LINEAR_MIPMAP_LINEAR,
		wrap : {
			s : gl.CLAMP_TO_EDGE,
			t : gl.CLAMP_TO_EDGE
		},
		urls : skyTexFilenames,
		onload : function(side,url,image) {
			if (image.width > glMaxCubeMapTextureSize || image.height > glMaxCubeMapTextureSize) {
				throw "cube map size "+image.width+"x"+image.height+" cannot exceed "+glMaxCubeMapTextureSize;
			}
		},
		done : function() {
			main3(this);
		}
	});
}


var skyTexFilenames = [
	'skytex/sky-visible-cube-xp.png',
	'skytex/sky-visible-cube-xn.png',
	'skytex/sky-visible-cube-yp.png',
	'skytex/sky-visible-cube-yn.png',
	'skytex/sky-visible-cube-zp.png',
	'skytex/sky-visible-cube-zn.png'
];

function main1() {
	$('#panelButton').click(function() {
		var panel = $('#panel');	
		if (panel.css('display') == 'none') {
			panel.show();
			$('#info').hide();
		} else {
			panel.hide();
		}
	});
	$('#infoButton').click(function() {
		var info = $('#info');
		if (info.css('display') == 'none') {
			info.show();
			$('#panel').hide();
		} else {
			info.hide();
		}
	});
	
	canvas = $('<canvas>', {
		css : {
			left : 0,
			top : 0,
			position : 'absolute'
		}
	}).prependTo(document.body).get(0);
	$(canvas).disableSelection()

	var objectTypeParamDivs = {};
	var refreshObjectTypeParamDivs = function() {
		$.each(objectTypeParamDivs, function(divObjectType,objectTypeParamDiv) {
			if (divObjectType == objectType) {
				objectTypeParamDiv.show();
			} else {
				objectTypeParamDiv.hide();
			}
		});
	};
	$.each(objectTypes, function(k,v) {
		objectTypeParamDivs[v] = $('#'+v.replace(new RegExp(' ', 'g'), '_')+'_params');
		var option = $('<option>', {text:v});
		option.appendTo($('#objectTypes'));
		if (v == objectType) {
			option.attr('selected', 'true');
		}
	});
	$('#objectTypes').change(function() {
		objectType = $('#objectTypes').val();
		refreshObjectTypeParamDivs();
		skyboxRenderer.resetField();
	});
	refreshObjectTypeParamDivs();

	$.each([
		'deltaLambda',
		'objectDist',
		'blackHoleMass',
		'blackHoleCharge',
		'blackHoleAngularVelocity',
		'warpBubbleThickness',
		'warpBubbleVelocity',
		'warpBubbleRadius'
	], function(k,v) {
		var id = '#' + v;
		$(id).val(window[v]);
		$(id).change(function() {
			window[v] = $(id).val()*1;
			$(id).blur();
		});
	});

	skyboxRendererClassName = 'GeodesicFBORenderer';
	var classname = $.url().param('renderer');
	if (classname) {
		skyboxRendererClassName = classname;
	}
	if (skyboxRendererClassNames.indexOf(skyboxRendererClassName) == -1) throw "unable to find skybox renderer named "+skyboxRendererClassName;

	$.each(skyboxRendererClassNames, function(i,name) {
		var radio = $('#' + name);
		radio.click(function() {
			location.href = 'index.html?renderer=' + name;
		});
		if (name == skyboxRendererClassName) radio.attr('checked', 'checked');
	});

	try {
		glutil = new GLUtil({canvas:canvas});
		gl = glutil.context;
	} catch (e) {
		$(canvas).remove();
		$('#webglfail').show();
		throw e;
	}
	$('#menu').show();
	
	glMaxCubeMapTextureSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
	
	hsvTex = new glutil.HSVTexture(256);
	hsvTex.bind();
	gl.texParameteri(hsvTex.target, gl.TEXTURE_WRAP_S, gl.REPEAT);
	hsvTex.unbind();

	$('#reset').click(function() {
		skyboxRenderer.resetField();
	});

	$('#reset_view').click(function() {
		quat.copy(objectAngle, quat.create());
		quat.copy(glutil.view.angle, initAngle);
		skyboxRenderer.resetField();
	});

	skyboxRenderer = new (window[skyboxRendererClassName])(glutil);

	gl.disable(gl.DITHER);

	$(skyTexFilenames).preload(main2);
}

$(document).ready(main1);
