// entropy-heatmap.frag — live superposition entropy as a heat field.
//
// the heatmap is the entropy. the entropy is the uncertainty. the uncertainty
// is the beauty. the beauty is the heat. the heat is the color.
//
// Reference GPU pipeline (Canvas 2D equivalent lives in src/js/main.js).
// Renders the wave during solving: uncollapsed cells glow by how many tiles
// they still permit (normalized 0..1). Collapsed cells read 0 -> deep violet.
//
// palette entropy_heat: #0d0221 #f72585 #4cc9f0 #ffffff

precision highp float;

uniform sampler2D u_entropyTex; // R channel = normalized entropy per cell, 0..1
uniform vec2 u_grid;
uniform float u_time;

varying vec2 v_uv;

const vec3 C0 = vec3(0.051, 0.008, 0.129); // #0d0221
const vec3 C1 = vec3(0.969, 0.145, 0.522); // #f72585
const vec3 C2 = vec3(0.298, 0.788, 0.941); // #4cc9f0
const vec3 C3 = vec3(1.000, 1.000, 1.000); // #ffffff

vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.3333) return mix(C0, C1, t / 0.3333);
  if (t < 0.6667) return mix(C1, C2, (t - 0.3333) / 0.3333);
  return mix(C2, C3, (t - 0.6667) / 0.3333);
}

void main() {
  vec2 cellUV = (floor(v_uv * u_grid) + 0.5) / u_grid;
  float e = texture2D(u_entropyTex, cellUV).r;
  // subtle shimmer so the live field breathes while it resolves
  float pulse = 0.04 * sin(u_time * 2.0 + cellUV.x * 20.0 + cellUV.y * 20.0);
  gl_FragColor = vec4(heat(e + pulse * e), 1.0);
}
