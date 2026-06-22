# wave_function_collapse

> Maxim Gumin's WFC. Constraint-propagation procedural generation. Each cell is a
> superposition of tiles; collapse the lowest-entropy cell, propagate adjacency
> constraints, cascade, repeat. The live entropy field is gorgeous before it
> resolves.

**Architecture:** the solver is **CPU / JS** — this is an algorithm repo with a
display layer, not a per-pixel shader. `src/js/wfc-solver.js` is the core; the
display only draws tiles + post. The brain is the CPU; the GPU is the eye.

![regimes: truchet · knots · circuit](docs/visual-targets.md)

## Run it

No build step, no server. Just open the file:

```bash
open index.html        # macOS
xdg-open index.html    # Linux
# or drag index.html into any browser
```

Pick a tileset, set the grid size, hit **▶ run** to animate the collapse (with
the entropy heatmap underlay), **step** one observe+propagate at a time, or
**⚡ instant solve** to drop the whole grid at once.

## How it works

1. **`wfc-solver.js`** runs the collapse → outputs a tile-index grid.
   `observe` (collapse the lowest-entropy cell to one weighted-random tile) →
   `propagate` (strip neighbors' now-illegal options, cascade until stable) →
   repeat; contradiction → restart. See [`docs/math-reference.md`](docs/math-reference.md).
2. **The renderer** (`main.js`) draws each collapsed cell from a pre-rendered
   procedural tile "atlas," and paints uncollapsed cells as an entropy heatmap so
   you can watch the cascade resolve.
3. **`src/shaders/*.frag`** document the equivalent GPU pipeline — tile atlas
   render → entropy heat → CRT/chromatic/glitch post.

## Tilesets

The real work is the adjacency / socket rules per set (`src/tilesets/*/tileset.json`
documents the contract; geometry is procedural in `src/js/tilesets.js`).

| set      | sockets            | tiles | look |
|----------|--------------------|-------|------|
| truchet  | every edge a path  | 2     | pastel maze of connecting arcs — the friendly first one |
| knots    | strand / empty     | 8     | copper over/under interlace |
| circuit  | wire / none        | 15    | neon traces, glowing junctions and pads |

A tile fits a neighbor when its edge socket matches the neighbor's facing socket.
Adjacency is precomputed into bitmasks so propagation is pure bit-twiddling.

## Parameters

- `grid_size` — 10×10 (small) · 25×25 · 50×50 (medium) · 100×100 (large)
- `tileset` — truchet · knots · circuit
- `animate_speed` — 0 (instant) … 120ms per collapse step
- `backtrack` — restart the wave on contradiction (on by default)
- entropy heatmap underlay · additive glow (circuit bloom)

## Aesthetic regimes

`live_collapse` · `circuit_bloom` · `knot_weave` · `learned_hallucination` —
see [`docs/visual-targets.md`](docs/visual-targets.md) for palettes and targets.

## Layout

```
wave_function_collapse/
├── index.html               # the app — controls + canvas
├── src/
│   ├── js/
│   │   ├── main.js           # display layer: render + heatmap + UI
│   │   ├── wfc-solver.js     # the core: observe + propagate + backtrack
│   │   ├── tilesets.js       # procedural tiles + socket adjacency
│   │   └── color-maps.js     # palettes + gradient sampling
│   ├── shaders/              # reference GPU pipeline (.frag)
│   └── tilesets/             # adjacency contracts (data)
└── docs/                     # math-reference · visual-targets
```

## Roadmap

- **Overlapping model** — learn N×N patterns from a sample image (`pattern_N`
  2/3/4) for `learned_hallucination`; consume any `*_aesthetic` repo as training
  input → remix engine.
- **WebGL display** — wire `src/shaders/*.frag` as the live pipeline with the
  `post-process.frag` glitch ramp.
- Pairs with `tesselations`, `islamic_tiling`, future `celtic_knotwork`.

The tile is the input. The input is the art. The art is the pattern. The pattern
is the WFC.
