/*
 * tilesets.js — the vocabulary.
 *
 * the socket is the constraint. the constraint is the rule. the rule is the tile.
 *
 * A tileset is a list of tiles. Each tile carries:
 *   sockets: [N, E, S, W]   edge socket strings (used by the solver for adjacency)
 *   weight:  frequency weight
 *   draw(ctx, size, palette): paint the tile, oriented at rotation 0
 *
 * We define a handful of BASE tiles per set, then `expand()` rotates each into
 * its distinct orientations (rotating both the socket array and the canvas).
 * Sockets are symmetric strings here, so a tile fits a neighbor when its edge
 * socket equals the neighbor's facing edge socket. The arc/strand geometry is
 * drawn so matching sockets line up visually at the edge midpoints.
 *
 * Tiles are pure procedural canvas — no image atlas to ship.
 */
(function (global) {
  'use strict';

  const C = global.ColorUtil;

  // rotate a [N,E,S,W] socket array clockwise by r quarter-turns.
  function rotSockets(s, r) {
    const out = s.slice();
    for (let k = 0; k < r; k++) out.unshift(out.pop()); // N<-W, E<-N, ...
    return out;
  }

  // wrap a base draw fn so it renders at rotation r (clockwise quarter-turns).
  function rotDraw(drawFn, r) {
    return function (ctx, size, palette) {
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((r * Math.PI) / 2);
      ctx.translate(-size / 2, -size / 2);
      drawFn(ctx, size, palette);
      ctx.restore();
    };
  }

  // expand base tiles into all requested rotations. each base declares exactly
  // the orientations that are visually distinct (a 4-fold-symmetric tile lists
  // only [0]; an arc tile lists every quarter-turn it actually differs at), so
  // no de-duplication is needed here.
  function expand(bases) {
    const tiles = [];
    for (const base of bases) {
      const rots = base.rotations || [0];
      for (const r of rots) {
        const sockets = rotSockets(base.sockets, r);
        tiles.push({
          name: base.name + (r ? '@' + r * 90 : ''),
          weight: base.weight || 1,
          sockets,
          draw: rotDraw(base.draw, r),
        });
      }
    }
    return tiles;
  }

  // ---- small drawing helpers --------------------------------------------

  function fillBg(ctx, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
  }

  function arc(ctx, cx, cy, r, a0, a1) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
  }

  // =======================================================================
  // TRUCHET — 2 distinct arc tiles, every edge is a "path". all tiles fit all
  // neighbors, so arcs always connect across edges -> a maze of loops.
  // the truchet is the easy. the easy is the start.
  // =======================================================================
  function truchetBases() {
    const sock = ['p', 'p', 'p', 'p']; // every edge is a path crossing the midpoint
    // orientation A: quarter arcs at the NW and SE corners.
    function drawA(ctx, size, p) {
      fillBg(ctx, size, p[0]);
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.lineCap = 'round';
      ctx.strokeStyle = p[3];
      arc(ctx, 0, 0, size / 2, 0, Math.PI / 2);                 // NW corner
      arc(ctx, size, size, size / 2, Math.PI, Math.PI * 1.5);   // SE corner
    }
    return [{ name: 'truchet', sockets: sock, weight: 1, rotations: [0, 1], draw: drawA }];
  }

  // =======================================================================
  // KNOTS — interlace. sockets: 's' = strand exits this edge, 'e' = empty.
  // strands only meet strands; empties only meet empties -> continuous weave.
  // the knot is the loop. the loop is the path. the path is the weave.
  // =======================================================================
  function knotBases() {
    const band = (size) => Math.max(2, size * 0.22);
    function strandStyle(ctx, p, size) {
      ctx.lineCap = 'round';
      ctx.lineWidth = band(size);
      ctx.strokeStyle = p[3];
    }
    function shadow(ctx, p, size) {
      ctx.lineCap = 'round';
      ctx.lineWidth = band(size) * 1.5;
      ctx.strokeStyle = p[0];
    }
    function line(ctx, x0, y0, x1, y1) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    const empty = { name: 'knot_empty', sockets: ['e', 'e', 'e', 'e'], weight: 0.4,
      rotations: [0], draw: (ctx, s, p) => fillBg(ctx, s, p[0]) };

    // straight strand N<->S
    const straight = { name: 'knot_straight', sockets: ['s', 'e', 's', 'e'], weight: 1,
      rotations: [0, 1], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]);
        shadow(ctx, p, s); line(ctx, s / 2, 0, s / 2, s);
        strandStyle(ctx, p, s); line(ctx, s / 2, 0, s / 2, s);
      } };

    // corner strand N<->E (quarter arc)
    const corner = { name: 'knot_corner', sockets: ['s', 's', 'e', 'e'], weight: 1,
      rotations: [0, 1, 2, 3], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]);
        shadow(ctx, p, s); arc(ctx, s, 0, s / 2, Math.PI / 2, Math.PI);
        strandStyle(ctx, p, s); arc(ctx, s, 0, s / 2, Math.PI / 2, Math.PI);
      } };

    // crossing — two strands, one over the other (the interlace).
    const cross = { name: 'knot_cross', sockets: ['s', 's', 's', 's'], weight: 0.8,
      rotations: [0], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]);
        // under-strand W<->E with a gap, then over-strand N<->S solid
        shadow(ctx, p, s); line(ctx, 0, s / 2, s, s / 2);
        strandStyle(ctx, p, s);
        line(ctx, 0, s / 2, s * 0.36, s / 2);
        line(ctx, s * 0.64, s / 2, s, s / 2);
        shadow(ctx, p, s); line(ctx, s / 2, 0, s / 2, s);
        strandStyle(ctx, p, s); line(ctx, s / 2, 0, s / 2, s);
      } };

    return [empty, straight, corner, cross];
  }

  // =======================================================================
  // CIRCUIT — neon traces. sockets: 'w' = wire exits this edge, 'n' = none.
  // wire meets wire, none meets none -> continuous traces with junctions.
  // the trace is the wire. the wire is the glow. the glow is the bloom.
  // =======================================================================
  function circuitBases() {
    function trace(ctx, p, size) {
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, size * 0.1);
      ctx.strokeStyle = p[2];
      ctx.shadowColor = p[2];
      ctx.shadowBlur = size * 0.25;
    }
    function clearShadow(ctx) { ctx.shadowBlur = 0; }
    function seg(ctx, x0, y0, x1, y1) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    function node(ctx, size, p) {
      ctx.fillStyle = p[3];
      ctx.shadowColor = p[3];
      ctx.shadowBlur = size * 0.3;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      clearShadow(ctx);
    }
    const m = (s) => s / 2;

    const blank = { name: 'cir_blank', sockets: ['n', 'n', 'n', 'n'], weight: 1.2,
      rotations: [0], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]);
        ctx.fillStyle = p[1]; ctx.globalAlpha = 0.12;
        ctx.fillRect(s * 0.42, s * 0.42, s * 0.16, s * 0.16);
        ctx.globalAlpha = 1;
      } };

    // straight wire W<->E
    const straight = { name: 'cir_straight', sockets: ['n', 'w', 'n', 'w'], weight: 1,
      rotations: [0, 1], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]); trace(ctx, p, s); seg(ctx, 0, m(s), s, m(s)); clearShadow(ctx);
      } };

    // corner wire E<->S
    const corner = { name: 'cir_corner', sockets: ['n', 'w', 'w', 'n'], weight: 1,
      rotations: [0, 1, 2, 3], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]); trace(ctx, p, s);
        ctx.beginPath();
        ctx.moveTo(s, m(s)); ctx.lineTo(m(s), m(s)); ctx.lineTo(m(s), s);
        ctx.stroke(); clearShadow(ctx);
      } };

    // T-junction: wire on E, S, W
    const tee = { name: 'cir_tee', sockets: ['n', 'w', 'w', 'w'], weight: 0.7,
      rotations: [0, 1, 2, 3], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]); trace(ctx, p, s);
        seg(ctx, 0, m(s), s, m(s)); seg(ctx, m(s), m(s), m(s), s);
        clearShadow(ctx); node(ctx, s, p);
      } };

    // component endpoint: a single wire on E, terminating at a pad.
    const endpoint = { name: 'cir_end', sockets: ['n', 'w', 'n', 'n'], weight: 0.5,
      rotations: [0, 1, 2, 3], draw: (ctx, s, p) => {
        fillBg(ctx, s, p[0]); trace(ctx, p, s); seg(ctx, s, m(s), m(s), m(s));
        clearShadow(ctx);
        ctx.fillStyle = p[4] || p[3];
        ctx.shadowColor = p[4] || p[3]; ctx.shadowBlur = s * 0.3;
        ctx.fillRect(s * 0.36, s * 0.36, s * 0.28, s * 0.28);
        clearShadow(ctx);
      } };

    return [blank, straight, corner, tee, endpoint];
  }

  // build a tileset object the solver + renderer can consume.
  function build(bases, paletteKey) {
    const tiles = expand(bases);
    return {
      tiles,
      paletteKey,
      sockets: tiles.map((t) => t.sockets),
      weights: tiles.map((t) => t.weight),
    };
  }

  const TILESETS = {
    truchet: () => build(truchetBases(), 'truchet_pastel'),
    knots: () => build(knotBases(), 'knot_copper'),
    circuit: () => build(circuitBases(), 'circuit_neon'),
  };

  global.TILESETS = TILESETS;
  global.TileBuild = { expand, rotSockets };
})(typeof window !== 'undefined' ? window : globalThis);
