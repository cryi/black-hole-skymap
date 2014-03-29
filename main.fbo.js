var objectTypes = ['Black Hole', 'Alcubierre Warp Drive Bubble'];
var objectType = objectTypes[0];
var objectDist = 10;
var blackHoleMass = 1;
var warpBubbleThickness = 1;
var warpBubbleVelocity = .5;
var warpBubbleRadius = 2;
var deltaLambda = .1;	//ray forward iteration

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
*/});

function stupidPrint(s) {
	return;
	$.each(s.split('\n'), function(_,l) {
		console.log(l);
	});
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

function resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	GL.resize();
}

// render loop

function update() {
	renderer.update();
	requestAnimFrame(update);
};


var renderer = new GeodesicFBORenderer();

//merging main.fbo.js and main.js

var mouse;
function main3(skyTex) {
	renderer.initScene(skyTex);

	var tmpQ = quat.create();	
	mouse = new Mouse3D({
		pressObj : canvas,
		move : function(dx,dy) {
			var rotAngle = Math.PI / 180 * .01 * Math.sqrt(dx*dx + dy*dy);
			quat.setAxisAngle(tmpQ, [dy, dx, 0], rotAngle);

			quat.mul(GL.view.angle, GL.view.angle, tmpQ);
			quat.normalize(GL.view.angle, GL.view.angle);
		},
		zoom : function(dz) {
			GL.view.fovY *= Math.exp(-.0003 * dz);
			GL.view.fovY = Math.clamp(GL.view.fovY, 1, 179);
			GL.updateProjection();
		}
	});

	renderer.resetField();

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
	
	GL.view.zNear = .1;
	GL.view.zFar = 100;
	GL.view.fovY = 90;
	quat.mul(GL.view.angle, /*90' x*/[SQRT_1_2,0,0,SQRT_1_2], /*90' -y*/[0,-SQRT_1_2,0,SQRT_1_2]);

	console.log('creating skyTex');
	var skyTex = new GL.TextureCube({
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

var glMaxCubeMapTextureSize;

var panel;
var canvas;
var gl;
function main1() {
	panel = $('#panel');	
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
		renderer.resetField();
	});
	refreshObjectTypeParamDivs();

	$.each([
		'deltaLambda',
		'objectDist',
		'blackHoleMass',
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
	
	try {
		gl = GL.init(canvas);
	} catch (e) {
		panel.remove();
		$(canvas).remove();
		$('#webglfail').show();
		throw e;
	}
	
	glMaxCubeMapTextureSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);

	$('#reset').click(function() {
		renderer.resetField();
	});

	renderer.testInit();

	gl.disable(gl.DITHER);

	$(skyTexFilenames).preload(main2);
}

$(document).ready(main1);

