/*
 * main.js — the eye.
 *
 * the GPU is the eye. the eye is the display. the display is the art.
 *
 * Wires the CPU solver to the canvas display layer + the controls. The solver
 * outputs a tile-index grid; we draw collapsed cells from their procedural tile,
 * and paint uncollapsed cells as an entropy heatmap so you can watch the cascade
 * resolve. (Reference shaders for a GPU pipeline live in src/shaders/; this build
 * renders with Canvas 2D so it runs from a plain file:// open.)
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('stage');
  const ctx = canvas.getContext('2d');

  const ui = {
    tileset: $('tileset'),
    grid: $('grid'),
    speed: $('speed'),
    backtrack: $('backtrack'),
    heatmap: $('heatmap'),
    glow: $('glow'),
    run: $('run'),
    step: $('step'),
    instant: $('instant'),
    status: $('status'),
  };

  const TILE_PX = 28; // off-screen render size per tile, scaled to fit canvas

  let solver = null;
  let tileset = null;
  let palette = null;
  let tileCache = [];   // pre-rendered tile canvases
  let timer = null;
  let running = false;

  function gridSize() { return parseInt(ui.grid.value, 10); }
  function animSpeed() { return parseInt(ui.speed.value, 10); }

  // pre-render each tile once into its own small canvas (the "atlas").
  function buildTileCache() {
    tileCache = tileset.tiles.map((t) => {
      const c = document.createElement('canvas');
      c.width = c.height = TILE_PX;
      const tctx = c.getContext('2d');
      t.draw(tctx, TILE_PX, palette);
      return c;
    });
  }

  function newRun(seed) {
    const setName = ui.tileset.value;
    tileset = window.TILESETS[setName]();
    palette = window.COLOR_MAPS[tileset.paletteKey];
    buildTileCache();

    const n = gridSize();
    solver = new window.WFC({
      width: n,
      height: n,
      sockets: tileset.sockets,
      weights: tileset.weights,
      backtrack: ui.backtrack.checked,
      seed: seed,
    });
    fitCanvas();
    render();
    setStatus();
  }

  function fitCanvas() {
    const n = gridSize();
    const max = Math.min(window.innerWidth - 360, window.innerHeight - 80, 900);
    const px = Math.max(120, max);
    canvas.width = px;
    canvas.height = px;
    canvas._cell = px / n;
  }

  function render() {
    const n = solver.width;
    const cell = canvas._cell;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // base wash so partial grids read as one field
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const showHeat = ui.heatmap.checked;
    const heat = window.COLOR_MAPS.entropy_heat;

    if (ui.glow.checked) {
      ctx.globalCompositeOperation = 'lighter';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = solver.idx(x, y);
        const t = solver.tileAt(i);
        const px = x * cell, py = y * cell;
        if (t >= 0) {
          ctx.drawImage(tileCache[t], px, py, cell + 0.5, cell + 0.5);
        } else if (showHeat) {
          // uncollapsed -> entropy heat (uncertainty -> color)
          const e = solver.normEntropy(i);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = window.ColorUtil.sample(heat, e);
          ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
          if (ui.glow.checked) ctx.globalCompositeOperation = 'lighter';
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function setStatus(extra) {
    const total = solver.width * solver.height;
    let collapsed = 0;
    for (let i = 0; i < solver.cells.length; i++) {
      if (solver.popcount(solver.cells[i]) === 1) collapsed++;
    }
    const pct = ((collapsed / total) * 100).toFixed(0);
    ui.status.textContent =
      (extra ? extra + ' · ' : '') +
      `${tileset.tiles.length} tiles · ${collapsed}/${total} collapsed (${pct}%)` +
      (solver.restarts ? ` · ${solver.restarts} restarts` : '') +
      (solver.done ? ' · DONE' : '');
  }

  function stop() {
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    ui.run.textContent = '▶ run';
  }

  function tick() {
    if (!running) return;
    solver.step();
    render();
    setStatus();
    if (solver.done) { stop(); return; }
    timer = setTimeout(tick, animSpeed());
  }

  function startRun() {
    if (solver.done) newRun();
    running = true;
    ui.run.textContent = '⏸ pause';
    tick();
  }

  // ---- events -----------------------------------------------------------
  ui.run.addEventListener('click', () => (running ? stop() : startRun()));

  ui.step.addEventListener('click', () => {
    stop();
    if (solver.done) newRun();
    solver.step();
    render();
    setStatus();
  });

  ui.instant.addEventListener('click', () => {
    stop();
    newRun();
    const t0 = performance.now();
    solver.solve();
    render();
    setStatus(`solved in ${(performance.now() - t0).toFixed(1)}ms`);
  });

  ['tileset', 'grid', 'backtrack'].forEach((k) =>
    ui[k].addEventListener('change', () => { stop(); newRun(); })
  );
  ['heatmap', 'glow'].forEach((k) =>
    ui[k].addEventListener('change', () => render())
  );
  ui.speed.addEventListener('input', () => {
    $('speedval').textContent = animSpeed() + 'ms';
  });

  window.addEventListener('resize', () => { if (solver) { fitCanvas(); render(); } });

  // boot
  $('speedval').textContent = animSpeed() + 'ms';
  newRun();
})();
