/*
 * color-maps.js — the palettes.
 *
 * the entropy is the heat. the heat is the color. the color is the art.
 *
 * Each palette is an ordered list of hex stops. The entropy heatmap samples its
 * gradient continuously (uncertainty -> hue); tilesets pull discrete swatches.
 */
(function (global) {
  'use strict';

  const COLOR_MAPS = {
    // live_collapse heatmap — neon. low entropy -> deep violet, high -> white-hot.
    entropy_heat: ['#0d0221', '#f72585', '#4cc9f0', '#ffffff'],
    // circuit_bloom — acid neon traces on a near-black board.
    circuit_neon: ['#0a001a', '#8338ec', '#ff006e', '#ffbe0b', '#fb5607'],
    // knot_weave — warm copper interlace.
    knot_copper: ['#1a1a2e', '#b87333', '#cd7f32', '#ffd700', '#ffffff'],
    // truchet_pastel — soft violet maze.
    truchet_pastel: ['#f0e6ff', '#d8b4fe', '#c084fc', '#a855f7', '#7c3aed'],
  };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function rgbToCss(rgb) {
    return 'rgb(' + (rgb[0] | 0) + ',' + (rgb[1] | 0) + ',' + (rgb[2] | 0) + ')';
  }

  // sample a palette gradient at t in [0,1].
  function sample(stops, t) {
    t = Math.max(0, Math.min(1, t));
    const n = stops.length - 1;
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const local = f - i;
    const a = hexToRgb(stops[i]);
    const b = hexToRgb(stops[i + 1]);
    return rgbToCss([
      a[0] + (b[0] - a[0]) * local,
      a[1] + (b[1] - a[1]) * local,
      a[2] + (b[2] - a[2]) * local,
    ]);
  }

  global.COLOR_MAPS = COLOR_MAPS;
  global.ColorUtil = { hexToRgb, rgbToCss, sample };
})(typeof window !== 'undefined' ? window : globalThis);
