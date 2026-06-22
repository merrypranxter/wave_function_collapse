// post-process.frag — CRT / chromatic aberration / glitch.
//
// the post is the grit. the grit is the analog. the analog is the memory.
// the memory is the 90s.
//
// Reference GPU post pass. Composite over the tile-render output for the
// circuit_bloom / learned_hallucination regimes.

precision highp float;

uniform sampler2D u_scene;
uniform vec2 u_res;
uniform float u_time;
uniform float u_glitch; // 0..1 intensity

varying vec2 v_uv;

float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = v_uv;

  // horizontal glitch tearing on random scanlines
  float band = floor(uv.y * 60.0);
  float jitter = (rand(vec2(band, floor(u_time * 12.0))) - 0.5) * 0.06 * u_glitch;
  uv.x += jitter;

  // chromatic aberration — split RGB outward from center
  vec2 dir = uv - 0.5;
  float ca = 0.0025 + 0.01 * u_glitch;
  float r = texture2D(u_scene, uv + dir * ca).r;
  float g = texture2D(u_scene, uv).g;
  float b = texture2D(u_scene, uv - dir * ca).b;
  vec3 col = vec3(r, g, b);

  // CRT scanlines
  col *= 0.85 + 0.15 * sin(uv.y * u_res.y * 1.5);

  // vignette
  float v = smoothstep(0.9, 0.3, length(dir));
  col *= 0.6 + 0.4 * v;

  gl_FragColor = vec4(col, 1.0);
}
