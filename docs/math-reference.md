# Math Reference

> grid of cells = bitmask of possible tiles. the entropy is the heat.

## Superposition

Each cell holds a **bitmask** of the tiles it could still become. With `N` tiles
(`N ≤ 31`) a cell is a single JS number; bit `t` set means "tile `t` is still
allowed here." The grid starts fully uncertain — every cell is `(1 << N) - 1`.

A cell is **collapsed** when exactly one bit remains (`popcount == 1`). It is a
**contradiction** when zero bits remain.

## Entropy

We rank cells by **Shannon entropy** over their remaining tiles' weights, not by
a raw count, so frequent tiles bias the order naturally:

```
sumW    = Σ  w_t           for t still possible in the cell
sumLogW = Σ  w_t · ln(w_t)
H       = ln(sumW) − sumLogW / sumW
```

A tiny random noise term is added to `H` so ties break randomly. The cell with
the **lowest** `H` is the most-constrained and gets observed next.

## The Loop

```
while not done:
    i = argmin_uncollapsed  H(cell_i)        # most constrained cell
    observe(i)                               # collapse to one weighted-random tile
    propagate(i)                             # cascade constraints until stable
    if contradiction: restart / backtrack
```

### Observe

Pick one tile from cell `i`'s remaining set, weighted by per-tile frequency
weights, and set the cell to just that bit. The collapse is the decision; the
decision is the weighted random.

### Propagate

A worklist (stack) of "cells that changed." For each changed cell, for each of
its 4 neighbors, compute the set of tiles the neighbor is still allowed to hold:

```
allowed = ⋃  adj[dir][t]      for every t still possible in the changed cell
neighbor &= allowed
```

If the neighbor lost any options, push it; if it lost **all** options, that's a
contradiction. Cascade until the worklist empties — the wave is then stable.

## Adjacency from sockets

Each tile has 4 edge sockets `[N, E, S, W]`. Tile `a` may sit to the `dir` side
of tile `b` iff `a`'s facing edge socket matches `b`'s edge socket on `dir`
(opposite edges meet: N↔S, E↔W). We precompute this once into

```
adj[dir][tile] = bitmask of tiles permitted on the `dir` side of `tile`
```

so propagation is pure bit-twiddling. The socket is the constraint; the
constraint is the rule; the rule is the pattern.

## Backtracking

This solver uses **contradiction-restart**: on a dead end it reseeds and rebuilds
the wave from scratch (`backtrack: true`). It's simpler than full state-stack
backtracking and, with weighted entropy ordering on these tilesets, restarts are
rare. `solve()` caps total restarts to avoid runaway loops on an unsatisfiable
configuration.
