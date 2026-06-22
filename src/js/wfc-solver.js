/*
 * wfc-solver.js — the core.
 *
 * the solver is the brain. the brain is the CPU. the GPU is the eye.
 *
 * CPU/JS Wave Function Collapse. Each cell is a bitmask of possible tiles
 * (a superposition). The loop is:
 *
 *   pick the lowest-entropy cell  ->  observe (collapse to one weighted tile)
 *   ->  propagate (strip neighbors' now-illegal options, cascade until stable)
 *   ->  repeat until every cell is collapsed, or a contradiction forces a restart.
 *
 * Tiles are indexed 0..N-1 (N <= 31 so a cell fits in a JS number bitmask).
 * Adjacency is precomputed from edge sockets into adj[dir][tile] = bitmask of
 * tiles allowed on the `dir` side of `tile`.
 *
 * No DOM, no GPU, no rendering. Pure algorithm. Expose state for the display layer.
 */
(function (global) {
  'use strict';

  // direction order: N, E, S, W
  const DIRS = [
    { dx: 0, dy: -1 }, // N
    { dx: 1, dy: 0 },  // E
    { dx: 0, dy: 1 },  // S
    { dx: -1, dy: 0 }, // W
  ];
  const OPPOSITE = [2, 3, 0, 1]; // N<->S, E<->W

  function popcount(x) {
    let c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }

  // mulberry32 — small deterministic PRNG so a seed reproduces a pattern.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {Object} cfg
   * @param {number} cfg.width
   * @param {number} cfg.height
   * @param {string[][]} cfg.sockets   sockets[tile] = [n, e, s, w]
   * @param {number[]}   cfg.weights   per-tile frequency weights
   * @param {boolean}    [cfg.backtrack=true]  restart on contradiction
   * @param {number}     [cfg.seed]
   */
  function WFC(cfg) {
    this.width = cfg.width;
    this.height = cfg.height;
    this.sockets = cfg.sockets;
    this.numTiles = cfg.sockets.length;
    this.weights = cfg.weights || cfg.sockets.map(() => 1);
    this.backtrack = cfg.backtrack !== false;
    this.seedBase = (cfg.seed != null) ? cfg.seed : (Math.random() * 1e9) | 0;
    this.fullMask = (this.numTiles >= 32) ? -1 : ((1 << this.numTiles) - 1);

    // entropy helpers (Shannon over weights)
    this.logWeights = this.weights.map((w) => w * Math.log(w));

    this._buildAdjacency();
    this.reset(this.seedBase);
  }

  // two edges are compatible if their socket strings match. a trailing 'f' marks
  // an asymmetric socket that must meet its flipped partner (e.g. "1f" <-> "1").
  function socketsMatch(a, b) {
    if (a.endsWith('f')) return a.slice(0, -1) === b;
    if (b.endsWith('f')) return b.slice(0, -1) === a;
    return a === b;
  }

  WFC.prototype._buildAdjacency = function () {
    const N = this.numTiles;
    // adj[dir][tile] = bitmask of tiles permitted on the `dir` side of `tile`.
    const adj = [new Array(N), new Array(N), new Array(N), new Array(N)];
    for (let d = 0; d < 4; d++) {
      const od = OPPOSITE[d];
      for (let t = 0; t < N; t++) {
        let mask = 0;
        const myEdge = this.sockets[t][d];
        for (let u = 0; u < N; u++) {
          if (socketsMatch(myEdge, this.sockets[u][od])) mask |= (1 << u);
        }
        adj[d][t] = mask;
      }
    }
    this.adj = adj;
  };

  WFC.prototype.reset = function (seed) {
    this.seed = (seed != null) ? (seed >>> 0) : ((Math.random() * 1e9) | 0);
    this.rng = makeRng(this.seed);
    const size = this.width * this.height;
    this.cells = new Array(size).fill(this.fullMask); // every cell = full superposition
    this.collapsedCount = 0;
    this.contradiction = false;
    this.restarts = 0;
    this.done = false;
    return this;
  };

  WFC.prototype.idx = function (x, y) { return y * this.width + x; };

  // entropy of a cell = Shannon entropy over its remaining tiles, plus tiny noise
  // so ties break randomly. lower = closer to certain.
  WFC.prototype._entropy = function (mask) {
    let sumW = 0, sumLogW = 0;
    for (let t = 0; t < this.numTiles; t++) {
      if (mask & (1 << t)) { sumW += this.weights[t]; sumLogW += this.logWeights[t]; }
    }
    return Math.log(sumW) - sumLogW / sumW;
  };

  // count of remaining possibilities (used for the cheap "is it collapsed" check)
  WFC.prototype.count = function (mask) { return popcount(mask); };

  // find the uncollapsed cell with the least entropy. returns -1 when all done.
  WFC.prototype._minEntropyCell = function () {
    let best = -1, bestE = Infinity;
    for (let i = 0; i < this.cells.length; i++) {
      const c = popcount(this.cells[i]);
      if (c <= 1) continue; // collapsed or contradicted
      const e = this._entropy(this.cells[i]) + this.rng() * 1e-4;
      if (e < bestE) { bestE = e; best = i; }
    }
    return best;
  };

  // collapse a cell to a single tile, chosen weighted-random from its options.
  WFC.prototype._observe = function (i) {
    const mask = this.cells[i];
    let total = 0;
    for (let t = 0; t < this.numTiles; t++) if (mask & (1 << t)) total += this.weights[t];
    let r = this.rng() * total;
    let chosen = -1;
    for (let t = 0; t < this.numTiles; t++) {
      if (!(mask & (1 << t))) continue;
      r -= this.weights[t];
      if (r <= 0) { chosen = t; break; }
    }
    if (chosen < 0) chosen = 31 - Math.clz32(mask); // fallback: top bit
    this.cells[i] = (1 << chosen);
    this.collapsedCount++; // the observed cell always went from >1 option to 1
  };

  // propagate constraints outward from cell i until the wave is stable.
  // sets this.contradiction if any cell loses all options.
  WFC.prototype._propagate = function (start) {
    const stack = [start];
    const W = this.width, H = this.height;
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      const mask = this.cells[i];
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        const before = this.cells[ni];
        if (before === 0) continue;

        // tiles allowed on the d-side given everything still possible in cell i
        let allowed = 0;
        let m = mask;
        while (m) {
          const t = 31 - Math.clz32(m);
          m &= ~(1 << t);
          allowed |= this.adj[d][t];
        }
        const after = before & allowed;
        if (after !== before) {
          this.cells[ni] = after;
          if (after === 0) { this.contradiction = true; return; }
          // a neighbor that just dropped to a single option is now collapsed
          if (popcount(after) === 1) this.collapsedCount++;
          stack.push(ni);
        }
      }
    }
  };

  // one full step: observe the min-entropy cell + propagate. returns the cell
  // index that was collapsed, or -1 if there was nothing left to do.
  WFC.prototype.step = function () {
    if (this.done) return -1;
    const i = this._minEntropyCell();
    if (i < 0) { this.done = true; return -1; }
    this._observe(i);
    this._propagate(i);
    if (this.contradiction) {
      if (this.backtrack) {
        this.restarts++;
        this.reset(this.seed + 0x9e3779b9); // new seed, fresh wave
      } else {
        this.done = true;
      }
    } else if (this._allCollapsed()) {
      this.done = true;
    }
    return i;
  };

  WFC.prototype._allCollapsed = function () {
    for (let i = 0; i < this.cells.length; i++) {
      if (popcount(this.cells[i]) !== 1) return false;
    }
    return true;
  };

  // run to completion (instant mode). guarded against runaway restarts.
  WFC.prototype.solve = function (maxRestarts) {
    const cap = (maxRestarts == null) ? 100 : maxRestarts;
    while (!this.done) {
      this.step();
      if (this.restarts > cap) { this.done = true; break; }
    }
    return this;
  };

  // collapsed tile index for a cell, or -1 if still in superposition.
  WFC.prototype.tileAt = function (i) {
    const m = this.cells[i];
    if (popcount(m) !== 1) return -1;
    return 31 - Math.clz32(m);
  };

  // normalized entropy 0..1 for the display layer's heatmap (1 = max uncertainty).
  WFC.prototype.normEntropy = function (i) {
    const c = popcount(this.cells[i]);
    if (c <= 1) return 0;
    const maxC = this.numTiles;
    return (c - 1) / (maxC - 1);
  };

  WFC.prototype.popcount = popcount;

  global.WFC = WFC;
})(typeof window !== 'undefined' ? window : globalThis);
