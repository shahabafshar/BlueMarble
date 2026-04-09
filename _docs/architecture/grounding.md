# Ground System Architecture

## The Problem

The character walks on a small sphere (radius 50). The planet mesh is an icosahedron subdivided 6 times (~40k triangles) with flat shading. Each vertex is displaced by `groundHeight()` — a continuous noise function. The visible surface is flat triangular faces between displaced vertices. The character must appear to stand exactly on these flat faces.

## The Solution: Hybrid Analytical + Raycast

### Movement (analytical, fast)

`moveOnSurface(fwdAmount, turnAmount)`:
1. Gets the forward direction from `getFrame()`
2. Steps `groundPos` along the forward vector
3. Normalizes to get the new direction on the sphere
4. Sets radius to `groundHeight()` at the new direction
5. This is approximate — the analytical height doesn't match the flat mesh face exactly

### Grounding (raycast, precise)

`updateChar()`:
1. Fires a ray from `PR + 10` above the character straight toward the planet center
2. Hits the actual mesh triangle
3. Sets `character.position` to the exact hit point
4. One raycast per frame, ~40k triangles = acceptable performance

### Why not pure analytical?

`groundHeight()` is a continuous function. The mesh vertices are AT the analytical height. But between vertices, the mesh face is a flat chord while the analytical function curves. On slopes, this gap can be 18% of character height — clearly visible floating or sinking.

### Why not pure raycast from the start?

We tried. Problems:
- Raycasting hundreds of times during scene setup (object placement) = multi-second load
- At face edges, the raycast alternates between two faces = position jitter
- Face normals used for orientation caused spiral walking bug

### Why flat shading?

Smooth shading interpolates normals to fake curvature, but the geometry is still flat. The character stands on the flat geometry (correct), but smooth shading makes the eye think the surface curves up around the character, creating an illusion of sinking. Flat shading = what you see is what you get.

## The Forward Reference (`_lastFwRef`)

On a sphere, "which way is forward?" depends on defining a tangent reference direction. Previous approaches:
- **World Y projected into tangent plane**: flips at the poles (world Y becomes parallel to surface normal)
- **Per-frame computed from previous forward**: feedback loop if the forward also affects movement

The solution: `_lastFwRef` is a persistent vector that gets projected into the current tangent plane each frame. It evolves smoothly as the character moves, even across the poles. The heading angle is applied relative to this reference.

## Debug System

Press F3 in-game. Key metrics:
- `MC → meshface`: distance from character origin to the actual mesh face below. Should be ~0.
- `Perp delta`: angle between character's up and surface perpendicular. Should be ~0.
- `Slope ahead`: how steep the terrain is in the walking direction.

## Lessons Learned

1. Camera smoothing looks nice but destroys ground perception — the camera lagging behind on slopes makes the character appear to float
2. Surface normals from analytical gradients have noise-scale artifacts that cause visible tilt
3. The ocean boundary discontinuity (`if ocean return PR-0.5`) was the single biggest source of analytical-vs-mesh gap — replaced with smoothstep
4. Detail level 7 (163k tris) drops FPS to ~20. Detail 6 (40k tris) is the sweet spot.
