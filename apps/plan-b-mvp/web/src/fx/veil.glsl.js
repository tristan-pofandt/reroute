// Liquid veil. A band of brand indigo sweeps along uAxis (the navigation direction). Its leading edge crosses the whole screen first and
// the trailing edge follows, so for a moment the screen is fully covered: that is when the page swap happens underneath.
// Both edges are displaced by domain-warped fractal noise, bowed by a perpendicular arc (so the front is a blob, not a ruler line),
// and shoved further by the scroll velocity (uVelocity) so a fast flick makes the liquid thicker.
export const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0); // clip space: the quad always fills the viewport, whatever the camera does
}`;

export const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uProgress, uEnergy, uVelocity;
uniform vec2 uAxis, uRes;

// Hash without sin(): stable on mobile GPUs at mediump/highp alike.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic: no visible grid creases
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8); // rotate each octave so the layers do not line up
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = r * p * 2.02 + 7.1; a *= 0.5; }
  return v;
}

void main() {
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = (vUv - 0.5) * aspect;
  vec2 perpAxis = vec2(-uAxis.y, uAxis.x);
  // Position along the travel direction (0 entry edge .. 1 exit edge) and across it (-1 .. 1).
  float along = dot(vUv - 0.5, uAxis) + 0.5;
  float across = dot(vUv - 0.5, perpAxis) * 2.0;

  // Domain warp: noise bent by noise gives the slow, viscous swirl instead of plain cloud texture.
  vec2 q = vec2(fbm(p * 2.0 + vec2(uTime * 0.55, 0.0)), fbm(p * 2.0 + vec2(3.7, -uTime * 0.45)));
  float n = fbm(p * 2.4 + 2.2 * q + uTime * 0.2) - 0.5;
  float swell = 1.0 + abs(uVelocity) * 0.6;
  float warp = n * (0.42 + uEnergy * 0.18) * swell;
  float bow = (1.0 - across * across) * 0.16 * (0.6 + uEnergy * 0.5); // the front bulges at the middle

  // Leading edge runs ahead and finishes early; the trailing edge starts late and finishes last.
  float t = clamp(uProgress, 0.0, 1.0);
  float lead = mix(-0.6, 1.75, smoothstep(0.0, 0.58, t));
  float trail = mix(-0.85, 1.8, smoothstep(0.42, 1.0, t));
  float x = along + warp;
  float front = 1.0 - smoothstep(lead - 0.09, lead + 0.02, x + bow);
  float back = smoothstep(trail - 0.02, trail + 0.1, x - bow * 0.6);
  float body = front * back;

  // Edge glow: bright where the body is thin (its two edges), calmer in the middle.
  float edge = smoothstep(0.0, 0.2, body) * (1.0 - smoothstep(0.2, 0.7, body));
  float veins = smoothstep(0.02, 0.0, abs(n * 2.0 + 0.1 * sin(along * 14.0 + uTime * 2.0))); // thin caustic lines inside the liquid

  vec3 deep = vec3(0.310, 0.275, 0.898);   // #4F46E5
  vec3 light = vec3(0.427, 0.439, 0.961);  // #6D70F5
  vec3 night = vec3(0.140, 0.120, 0.520);
  vec3 mint = vec3(0.204, 0.827, 0.600);   // #34D399
  vec3 col = mix(night, deep, smoothstep(0.1, 0.9, body));
  col = mix(col, light, fbm(p * 3.0 - uTime * 0.3 + q) * 0.85);
  col += mint * edge * 0.42 + vec3(0.9, 0.95, 1.0) * veins * 0.18 * body;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0 * 2.0; // dither: no banding on the gradient

  gl_FragColor = vec4(col, min(1.0, body * 1.04)); // fully opaque in the core so the page swap is hidden
}`;
