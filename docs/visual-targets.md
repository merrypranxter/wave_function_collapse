# Visual Targets

> the entropy is the heat. the heat is the beauty. the beauty is the art.

The four aesthetic regimes the display layer aims at.

## live_collapse
Animate observe + propagate with the **entropy heatmap underlay**; watch the
cascade resolve. The satisfying one — uncollapsed cells glow by uncertainty,
collapsed cells snap to their tile.
- palette `entropy_heat`: `#0d0221 #f72585 #4cc9f0 #ffffff`
- toggle: **entropy heatmap underlay** (on by default), animate speed slider.

## circuit_bloom
Circuit tileset, neon traces, **additive glow** on the wires. The board is the
city; the city is the neon.
- palette `circuit_neon`: `#0a001a #8338ec #ff006e #ffbe0b #fb5607`
- toggle: tileset → circuit, **additive glow** on. Wire traces are drawn with a
  shadow-blur glow; `post-process.frag` adds CRT + chromatic for the full look.

## knot_weave
Truchet / knot tiles → endless interlace. The loop is the path; the path is the
weave.
- palette `knot_copper`: `#1a1a2e #b87333 #cd7f32 #ffd700 #ffffff`
- toggle: tileset → knots (or truchet). The crossing tile renders over/under so
  strands genuinely interlace.

## learned_hallucination
Overlapping model fed one of your own `*_aesthetic` repos → glitchy remix. The
input is the art; the art is the sample. *(Roadmap — the current build ships the
tiled model; the overlapping model + post `u_glitch` ramp realize this regime.
See "Roadmap" in the README.)*

---

## Rendering notes
The shipped renderer is **Canvas 2D** (`src/js/main.js`) so the app runs from a
plain `file://` open with no server or build step. `src/shaders/*.frag` document
the equivalent GPU pipeline (tile atlas → entropy heat → CRT/glitch post) for a
WebGL display layer. The solver is identical either way: the brain is the CPU,
the GPU is the eye.
