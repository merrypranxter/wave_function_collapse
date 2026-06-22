// tile-render.frag — draw the collapsed grid from a tile atlas.
//
// the atlas is the tileset. the tileset is the art. the pattern is the tile.
//
// Reference GPU pipeline for the display layer. This build renders tiles with
// Canvas 2D (see src/js/main.js) so it runs from a plain file:// open; this
// shader documents the equivalent fragment program for a WebGL atlas renderer.
//
// Inputs:
//   u_indexTex : RG texture, one texel per cell. R = tile index (0..255),
//                G = rotation (0..3 mapped to 0..255).
//   u_atlas    : sprite sheet, ATLAS_COLS x ATLAS_ROWS tiles.
//   u_grid     : grid dimensions (cells).
//   u_atlasDim : atlas dimensions (tiles).

precision highp float;

uniform sampler2D u_indexTex;
uniform sampler2D u_atlas;
uniform vec2 u_grid;
uniform vec2 u_atlasDim;

varying vec2 v_uv; // 0..1 across the whole grid

vec2 rotateUV(vec2 uv, float quarterTurns) {
  uv -= 0.5;
  float a = quarterTurns * 1.57079632679; // pi/2 per turn
  float c = cos(a), s = sin(a);
  uv = mat2(c, -s, s, c) * uv;
  return uv + 0.5;
}

void main() {
  // which cell are we in, and where inside it
  vec2 cellF = v_uv * u_grid;
  vec2 cell = floor(cellF);
  vec2 inCell = fract(cellF);

  // look up this cell's tile index + rotation
  vec2 cellUV = (cell + 0.5) / u_grid;
  vec4 idx = texture2D(u_indexTex, cellUV);
  float tile = floor(idx.r * 255.0 + 0.5);
  float rot  = floor(idx.g * 255.0 + 0.5);

  // rotate within the cell, then sample the tile from the atlas
  vec2 tuv = rotateUV(inCell, rot);
  vec2 atlasCell = vec2(mod(tile, u_atlasDim.x), floor(tile / u_atlasDim.x));
  vec2 atlasUV = (atlasCell + tuv) / u_atlasDim;

  gl_FragColor = texture2D(u_atlas, atlasUV);
}
