import { glsl } from './common/tags.ts';

/** Falling sand shaders using block cellular automata with Margolus offsets.
 * Based on "Probabilistic Cellular Automata for Granular Media in Video Games" (https://arxiv.org/abs/2008.06341)
 * Code adapted from https://github.com/GelamiSalami/GPU-Falling-Sand-CA
 */

const CONSTANTS = glsl`
#define AIR 0.0
#define SMOKE 1.0
#define WATER 2.0
#define LAVA 3.0
#define SAND 4.0
#define PLANT 5.0
#define STONE 6.0
#define WALL 7.0
#define COLLISION 99.0

const vec3 bgColor = pow(vec3(31, 34, 36) / 255.0, vec3(2));
`;

const UTILS = glsl`

const float EPSILON = 1e-4;

const float PI = acos(-1.);
const float TAU = PI * 2.0;

float safeacos(float x) { return acos(clamp(x, -1.0, 1.0)); }

float saturate(float x) { return clamp(x, 0., 1.); }
vec2 saturate(vec2 x) { return clamp(x, vec2(0), vec2(1)); }
vec3 saturate(vec3 x) { return clamp(x, vec3(0), vec3(1)); }

float sqr(float x) { return x*x; }
vec2 sqr(vec2 x) { return x*x; }
vec3 sqr(vec3 x) { return x*x; }

float luminance(vec3 col) { return dot(col, vec3(0.2126729, 0.7151522, 0.0721750)); }

mat2 rot2D(float a)
{
	float c = cos(a);
	float s = sin(a);
	return mat2(c, s, -s, c);
}

// https://iquilezles.org/articles/smin/
float smin( float d1, float d2, float k ) {
	float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
	return mix( d2, d1, h ) - k*h*(1.0-h);
}

float smax( float d1, float d2, float k ) {
	float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
	return mix( d2, d1, h ) + k*h*(1.0-h);
}

// https://iquilezles.org/articles/palettes/
vec3 palette(float t)
{
	return .5 + .5 * cos(TAU * (vec3(1, 1, 1) * t + vec3(0, .33, .67)));
}

// Hash without Sine
// https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
	p3 += dot(p3, p3.zyx + 31.32);
	return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

vec2 hash23(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yzx+33.33);
	return fract((p3.xx+p3.yz)*p3.zy);
}

vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
	p3 += dot(p3, p3.yxz+33.33);
	return fract((p3.xxy + p3.yxx)*p3.zyx);
}

vec4 hash43(vec3 p)
{
	vec4 p4 = fract(vec4(p.xyzx)  * vec4(.1031, .1030, .0973, .1099));
	p4 += dot(p4, p4.wzxy+33.33);
	return fract((p4.xxyz+p4.yzzw)*p4.zywx);
}

// https://www.chilliant.com/rgb2hsv.html
vec3 RGBtoHCV(in vec3 RGB)
{
	// Based on work by Sam Hocevar and Emil Persson
	vec4 P = (RGB.g < RGB.b) ? vec4(RGB.bg, -1.0, 2.0/3.0) : vec4(RGB.gb, 0.0, -1.0/3.0);
	vec4 Q = (RGB.r < P.x) ? vec4(P.xyw, RGB.r) : vec4(RGB.r, P.yzx);
	float C = Q.x - min(Q.w, Q.y);
	float H = abs((Q.w - Q.y) / (6.0 * C + EPSILON) + Q.z);
	return vec3(H, C, Q.x);
}

vec3 RGBtoHSV(in vec3 RGB)
{
	vec3 HCV = RGBtoHCV(RGB);
	float S = HCV.y / (HCV.z + EPSILON);
	return vec3(HCV.x, S, HCV.z);
}

vec3 RGBtoHSL(in vec3 RGB)
{
	vec3 HCV = RGBtoHCV(RGB);
	float L = HCV.z - HCV.y * 0.5;
	float S = HCV.y / (1.0 - abs(L * 2.0 - 1.0) + EPSILON);
	return vec3(HCV.x, S, L);
}

vec3 HUEtoRGB(in float H)
{
	float R = abs(H * 6.0 - 3.0) - 1.0;
	float G = 2.0 - abs(H * 6.0 - 2.0);
	float B = 2.0 - abs(H * 6.0 - 4.0);
	return saturate(vec3(R,G,B));
}

vec3 HSVtoRGB(in vec3 HSV)
{
	vec3 RGB = HUEtoRGB(HSV.x);
	return ((RGB - 1.0) * HSV.y + 1.0) * HSV.z;
}

vec3 HSLtoRGB(in vec3 HSL)
{
	vec3 RGB = HUEtoRGB(HSL.x);
	float C = (1.0 - abs(2.0 * HSL.z - 1.0)) * HSL.y;
	return (RGB - 0.5) * C + HSL.z;
}

vec3 sRGBToLinear(vec3 col)
{
	return mix(pow((col + 0.055) / 1.055, vec3(2.4)), col / 12.92, lessThan(col, vec3(0.04045)));
}

vec3 linearTosRGB(vec3 col)
{
	return mix(1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, col * 12.92, lessThan(col, vec3(0.0031308)));
}
`;

/** Vertex shader for rendering quads */
export const vertexShader = glsl`#version 300 es
in vec4 aPosition;
in vec2 aUv;

out vec2 outUv;

void main() {
	gl_Position = aPosition;
	outUv = aUv;
}
`;

export const simulationShader = glsl`#version 300 es
precision mediump float;

uniform vec2 resolution;
uniform float time;
uniform int frame;
uniform vec4 mouse;
uniform int materialType;
uniform float brushRadius;
uniform sampler2D tex;
uniform sampler2D u_collisionTex;

in vec2 outUv;

out vec4 fragColor;

${CONSTANTS}
${UTILS}

// https://iquilezles.org/articles/distfunctions2d/
float sdSegment(vec2 p, vec2 a, vec2 b)
{
	vec2 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba) / dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h );
}

ivec2 getOffset(int frame)
{
	int i = frame % 4;
	if (i == 0)
		return ivec2(0, 0);
	else if (i == 1)
		return ivec2(1, 1);
	else if (i == 2)
		return ivec2(0, 1);
	return ivec2(1, 0);
}

vec4 getData(ivec2 p)
{
    // Check boundaries first
    if (p.x < 0 || p.y < 0 || p.x >= int(resolution.x) || p.y >= int(resolution.y)) {
        return vec4(vec3(0.02), WALL);
    }
    
    // Calculate UV coordinates for the collision texture
    vec2 collisionUv = (vec2(p) + 0.5) / resolution;
    float collisionValue = texture(u_collisionTex, collisionUv).r;
    
    // If there's a collision at this position, always return COLLISION type
    if (collisionValue > 0.5) {
        return vec4(bgColor, COLLISION);
    }
    
    // If no collision, get the data from the simulation texture
    vec4 data = texelFetch(tex, p, 0);
    if (data.xyz == vec3(0)) {
        data.xyz = bgColor;
    }
    return data;
}

void swap(inout vec4 a, inout vec4 b)
{
	vec4 tmp = a;
	a = b;
	b = tmp;
}

vec4 createParticle(float id)
{
	if (id == AIR)
	{
		return vec4(bgColor, AIR);
	} else if (id == SMOKE)
	{
		return vec4(mix(bgColor, vec3(0.15), 0.5), SMOKE);
	} else if (id == WATER)
	{
		return vec4(mix(bgColor, vec3(0.15, 0.45, 0.9), 0.7), WATER);
	} else if (id == LAVA)
	{
		vec3 r = hash33(vec3(gl_FragCoord.xy, frame));
		vec3 color = vec3(255, 40, 20) / 255.0;
		vec3 hsl = RGBtoHSL(color);
		hsl.x += (r.z - 0.5) * 12.0 / 255.0;
		hsl.y += (r.x - 0.5) * 16.0 / 255.0;
		hsl.z *= (r.y * 80.0 / 255.0 + (255.0 - 80.0) / 255.0);
		return vec4(HSLtoRGB(hsl), LAVA);
	} else if (id == SAND)
	{
		vec3 r = hash33(vec3(gl_FragCoord.xy, frame));
		vec3 color = vec3(220, 158, 70) / 255.0;
		vec3 hsl = RGBtoHSL(color);
		hsl.x += (r.z - 0.5) * 12.0 / 255.0;
		hsl.y += (r.x - 0.5) * 16.0 / 255.0;
		hsl.z += (r.y - 0.5) * 40.0 / 255.0;
		return vec4(HSLtoRGB(hsl), SAND);
	} else if (id == PLANT)
	{
		vec3 r = hash33(vec3(gl_FragCoord.xy, frame));
		vec3 color = vec3(34, 139, 34) / 255.0;
		vec3 hsl = RGBtoHSL(color);
		hsl.x += (r.z - 0.5) * 0.1;
		hsl.y += (r.x - 0.5) * 0.2;
		hsl.z *= (r.y * 0.4 + 0.6);
		return vec4(HSLtoRGB(hsl), PLANT);
	} else if (id == STONE)
	{
		float r = hash13(vec3(gl_FragCoord.xy, frame));
		return vec4(vec3(0.08, 0.1, 0.12) * (r * 0.5 + 0.5), STONE);
	} else if (id == WALL)
	{
		float r = hash13(vec3(gl_FragCoord.xy, frame));
		return vec4(bgColor * 0.5 * (r * 0.4 + 0.6), WALL);
	}
		return vec4(bgColor, AIR);
}

void main() {
	vec2 uv = gl_FragCoord.xy / resolution;

	if (frame == 0) {
		float r = hash12(gl_FragCoord.xy);
		float id = AIR;
		if (r < 0.15)
		{
			id = SAND;
		} else if (r < 0.25)
		{
			id = SMOKE;
		}

		fragColor = createParticle(id);
		return;
	}

	if (mouse.x > 0.0)
	{
		float d = sdSegment(gl_FragCoord.xy, mouse.xy, mouse.zw);
		if (d < brushRadius)
		{
			fragColor = createParticle(float(materialType));
			return;
		}
	}

	ivec2 offset = getOffset(frame);
	ivec2 fc = ivec2(gl_FragCoord.xy) + offset;
	ivec2 p = (fc / 2) * 2 - offset;
	ivec2 xy = fc % 2;
	int i = xy.x + xy.y * 2;

	vec4 t00 = getData(p);                  // top-left
	vec4 t10 = getData(p + ivec2(1, 0));    // top-right
	vec4 t01 = getData(p + ivec2(0, 1));    // bottom-left
	vec4 t11 = getData(p + ivec2(1, 1));    // bottom-right

	vec4 tn00 = getData(p + ivec2(0, -1));
	vec4 tn10 = getData(p + ivec2(1, -1));

	if (t00.a == t10.a && t01.a == t11.a && t00.a == t01.a)
	{
		fragColor = i == 0 ? t00 :
					i == 1 ? t10 :
					i == 2 ? t01 : t11;
		return;
	}

	vec4 r = hash43(vec3(p, frame));

	if ((t01.a == SMOKE && t11.a < SMOKE ||
		t01.a < SMOKE && t11.a == SMOKE) && r.x < 0.25)
	{
		swap(t01, t11);
	}

	if (t00.a == SMOKE)
	{
		if (t01.a < t00.a && r.y < 0.25)
		{
			swap(t00, t01);
		} else if (r.z < 0.003)
		{
			t00 = vec4(bgColor, AIR);
		}
	}
	if (t10.a == SMOKE)
	{
		if (t11.a < t10.a && r.y < 0.25)
		{
			swap(t10, t11);
		} else if (r.z < 0.003)
		{
			t10 = vec4(bgColor, AIR);
		}
	}

	if (((t01.a == SAND) && t11.a < SAND ||
		t01.a < SAND && (t11.a == SAND)) &&
		t00.a < SAND && t10.a < SAND && r.x < 0.4)
	{
		swap(t01, t11);
	}

	if (t01.a == SAND || t01.a == STONE)
	{
		if (t00.a < SAND)
		{
			if (r.y < 0.9) swap(t01, t00);
		} else if (t11.a < SAND && t10.a < SAND)
		{
			swap(t01, t10);
		}
	}

	if (t11.a == SAND || t11.a == STONE)
	{
		if (t10.a < SAND)
		{
			if (r.y < 0.9) swap(t11, t10);
		} else if (t01.a < SAND && t00.a < SAND)
		{
			swap(t11, t00);
		}
	}

	bool drop = false;
	if (t01.a == WATER)
	{
		if (t00.a < t01.a && r.y < 0.95)
		{
			swap(t01, t00);
			drop = true;
		} else if (t11.a < t01.a && t10.a < t01.a && r.z < 0.3)
		{
			swap(t01, t10);
			drop = true;
		}
	}
	if (t11.a == WATER)
	{
		if (t10.a < t11.a && r.y < 0.95)
		{
			swap(t11, t10);
			drop = true;
		} else if (t01.a < t11.a && t00.a < t11.a && r.z < 0.3)
		{
			swap(t11, t00);
			drop = true;
		}
	}
	
	if (!drop)
	{
		if ((t01.a == WATER && t11.a < WATER ||
			t01.a < WATER && t11.a == WATER) &&
			(t00.a >= WATER && t10.a >= WATER || r.w < 0.8))
		{
			swap(t01, t11);
		}
		if ((t00.a == WATER && t10.a < WATER ||
			t00.a < WATER && t10.a == WATER) &&
			(tn00.a >= WATER && tn10.a >= WATER || r.w < 0.8))
		{
			swap(t00, t10);
		}
	}

	if (t01.a == LAVA)
	{
		if (t00.a < t01.a && r.y < 0.8)
		{
			swap(t01, t00);
		} else if (t11.a < t01.a && t10.a < t01.a && r.z < 0.2)
		{
			swap(t01, t10);
		}
	}
	if (t11.a == LAVA)
	{
		if (t10.a < t11.a && r.y < 0.8)
		{
			swap(t11, t10);
		} else if (t01.a < t11.a && t00.a < t11.a && r.z < 0.2)
		{
			swap(t11, t00);
		}
	}

	if (t00.a == LAVA)
	{
		if (t01.a == WATER)
		{
			t00 = createParticle(STONE);
			t01 = createParticle(SMOKE);
		} else if (t10.a == WATER)
		{
			t00 = createParticle(STONE);
			t10 = createParticle(SMOKE);
		} else if (t01.a == PLANT && r.x < 1.0) // left
		{
			t00 = createParticle(LAVA);
			t01 = createParticle(SMOKE);
		} else if (t10.a == PLANT && r.x < 1.0) // right
		{
			t00 = createParticle(LAVA);
			t10 = createParticle(SMOKE);
		} else if (t00.a == PLANT && r.x < 1.0) // bottom
		{
			t00 = createParticle(LAVA);
			t00 = createParticle(SMOKE);
		}
	}
	if (t10.a == LAVA)
	{
		if (t11.a == WATER)
		{
			t10 = createParticle(STONE);
			t11 = createParticle(SMOKE);
		} else if (t00.a == WATER)
		{
			t10 = createParticle(STONE);
			t00 = createParticle(SMOKE);
		} 
		
		else if (t11.a == PLANT)
		{
			t10 = createParticle(LAVA);
			t11 = createParticle(SMOKE);
		} else if (t00.a == PLANT)
		{
			t10 = createParticle(LAVA);
			t00 = createParticle(SMOKE);
		}
	}

	if ((t01.a == LAVA && t11.a < LAVA ||
		t01.a < LAVA && t11.a == LAVA) && r.x < 0.6)
	{
		swap(t01, t11);
	}


	fragColor = i == 0 ? t00 :
    i == 1 ? t10 :
    i == 2 ? t01 : t11;

	if (fragColor.a == COLLISION) {
		vec2 collisionUv = gl_FragCoord.xy / resolution;
		float collisionValue = texture(u_collisionTex, collisionUv).r;
		if (collisionValue <= 0.5) {
			fragColor = vec4(bgColor, AIR);
		}
	}
}
`;

export const distanceFieldInitShader = glsl`#version 300 es
precision highp float;

uniform vec2 resolution;
uniform sampler2D dataTex;

${CONSTANTS}

layout(location = 0) out vec4 fragColorR;
layout(location = 1) out vec4 fragColorG;
layout(location = 2) out vec4 fragColorB;

void main()
{
	vec2 uv = gl_FragCoord.xy / resolution;

	vec4 data = texture(dataTex, uv);

	fragColorR = vec4(-1, -1, 0, 0);
	fragColorG = vec4(-1, -1, 0, 0);
	fragColorB = vec4(-1, -1, 0, 0);

	if (data.a <= LAVA)
	{
		fragColorR.xy = gl_FragCoord.xy;
		fragColorG.xy = gl_FragCoord.xy;
		fragColorB.xy = gl_FragCoord.xy;
	}
	if (data.a == SMOKE)
	{
		fragColorR.w = 6.0;
		fragColorG.w = 6.0;
		fragColorB.w = 6.0;
	} else if (data.a == WATER)
	{
		fragColorR.w = 9.0;
		fragColorG.w = 6.0;
		fragColorB.w = 4.0;
	} else if (data.a == LAVA)
	{
		fragColorR.w = 0.0;
		fragColorG.w = 11.0;
		fragColorB.w = 14.0;
	} else if (data.a == PLANT)
	{
		fragColorR.w = 4.0 - data.r * 4.0;
		fragColorG.w = 4.0 - data.g * 4.0;
		fragColorB.w = 4.0 - data.b * 4.0;
	}
}
`;

export const distanceFieldPropagationShader = glsl`#version 300 es
precision highp float;

uniform float stepSize;
uniform vec2 resolution;
uniform sampler2D texR;
uniform sampler2D texG;
uniform sampler2D texB;

uniform int passCount;
uniform int passIndex;

layout(location = 0) out vec4 fragColorR;
layout(location = 1) out vec4 fragColorG;
layout(location = 2) out vec4 fragColorB;

void main()
{
	vec2 fc = gl_FragCoord.xy;

	vec4 bestR = vec4(0,0,1e3,0);
	vec4 bestG = vec4(0,0,1e3,0);
	vec4 bestB = vec4(0,0,1e3,0);

	for (int x = -1; x <= 1; x++)
	{
		for (int y = -1; y <= 1; y++)
		{
			vec2 p = fc + vec2(x, y) * stepSize;

			vec4 dataR = texture(texR, p / resolution);
			vec4 dataG = texture(texG, p / resolution);
			vec4 dataB = texture(texB, p / resolution);

			if (dataR.xy != vec2(-1) && dataR.xy == clamp(dataR.xy, vec2(0.5), resolution-0.5))
			{
				float dist = distance(fc, dataR.xy) + dataR.w;
				if (dist < bestR.z)
				{
					bestR = dataR;
					bestR.z = dist;
				}
			}
			if (dataG.xy != vec2(-1) && dataG.xy == clamp(dataG.xy, vec2(0.5), resolution-0.5))
			{
				float dist = distance(fc, dataG.xy) + dataG.w;
				if (dist < bestG.z)
				{
					bestG = dataG;
					bestG.z = dist;
				}
			}
			if (dataB.xy != vec2(-1) && dataB.xy == clamp(dataB.xy, vec2(0.5), resolution-0.5))
			{
				float dist = distance(fc, dataB.xy) + dataB.w;
				if (dist < bestB.z)
				{
					bestB = dataB;
					bestB.z = dist;
				}
			}
		}
	}

	fragColorR = vec4(bestR.xy, bestR.z != 1e3 ? bestR.z : 1e3, bestR.w);
	fragColorG = vec4(bestG.xy, bestG.z != 1e3 ? bestG.z : 1e3, bestG.w);
	fragColorB = vec4(bestB.xy, bestB.z != 1e3 ? bestB.z : 1e3, bestB.w);

	if (passIndex == passCount - 1)
	{
		if (bestR.xy == vec2(-1))
			fragColorR.z = 1e3;
		if (bestG.xy == vec2(-1))
			fragColorG.z = 1e3;
		if (bestB.xy == vec2(-1))
			fragColorB.z = 1e3;
	}
}
`;

export const visualizationShader = glsl`#version 300 es
precision highp float;

uniform vec2 texResolution;
uniform float texScale;
uniform vec2 resolution;
uniform sampler2D tex;
uniform sampler2D shadowTexR;
uniform sampler2D shadowTexG;
uniform sampler2D shadowTexB;
uniform sampler2D u_collisionTex;
uniform float scale;

${CONSTANTS}

out vec4 fragColor;

vec2 getCoordsAA(vec2 uv)
{
	float w = 1.5; // 1.5
	vec2 fl = floor(uv + 0.5);
	vec2 fr = fract(uv + 0.5);
	vec2 aa = fwidth(uv) * w * 0.5;
	fr = smoothstep(0.5 - aa, 0.5 + aa, fr);

	return fl + fr - 0.5;
}

vec3 linearTosRGB(vec3 col)
{
	return mix(1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, col * 12.92, lessThan(col, vec3(0.0031308)));
}

void main() {
	vec2 uv = gl_FragCoord.xy / (texResolution * texScale);

	uv -= 0.5;
	uv *= scale;
	uv += 0.5;

	vec2 fc = uv * texResolution;

	vec4 data = texture(tex, getCoordsAA(fc) / texResolution);
	vec4 dataUp = texture(tex, getCoordsAA(fc + vec2(0, 1)) / texResolution);
	vec4 dataDown = texture(tex, getCoordsAA(fc - vec2(0, 1)) / texResolution);

	float hig = float(data.a > dataUp.a);
	float dropSha = 1.0 - float(data.a > dataDown.a);

	vec3 color = data.rgb == vec3(0) ? bgColor : data.rgb;

	vec4 shaDataR = texture(shadowTexR, uv);
	vec4 shaDataG = texture(shadowTexG, uv);
	vec4 shaDataB = texture(shadowTexB, uv);
	
	float shaR = shaDataR.xy != vec2(-1) ? shaDataR.z : 16.0;
	float shaG = shaDataG.xy != vec2(-1) ? shaDataG.z : 16.0;
	float shaB = shaDataB.xy != vec2(-1) ? shaDataB.z : 16.0;

	vec3 sha = clamp(1.0 - vec3(shaR, shaG, shaB) / 16.0, vec3(0.0), vec3(1.0));
	sha *= sha;

	color *= 0.5 * max(hig, dropSha) + 0.5;
	color *= sha * 1.0 + 0.2;
	color += color * 0.4 * hig;

	fragColor = vec4(linearTosRGB(color), 1);
}
`;

export const collisionVertexShader = glsl`#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

export const collisionFragmentShader = glsl`#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    fragColor = vec4(1.0, 0.0, 0.0, 1.0); // red represents solid
}`;
