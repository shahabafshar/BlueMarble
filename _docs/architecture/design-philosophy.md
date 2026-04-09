# Design Philosophy

## The Soul of Blue Marble

Blue Marble is an **exploration game**. A tiny cute character walks around a miniature planet, discovering places, taking photos, experiencing a handcrafted world. Every design decision must serve this core experience.

## The World Should Feel Real and Touchable

The player wants to:
- Walk up to a temple and stand **between its columns**
- Walk through a market and **look at the goods on the counter**
- Lean against a house wall and **look out at the view**
- Sit on a bench
- Walk across a bridge
- Climb pyramid steps one by one
- Walk under tree canopies
- Stand on a dock and look at the boat

The world is the attraction. **Objects are destinations, not obstacles.**

## Collision Must Respect Geometry

The collision boundary IS the visible surface. Period.

- **Walls block you** — you can't walk through solid walls
- **Open spaces welcome you** — doorways, column gaps, arches, spaces between objects let you through
- **Small objects bump you** — tree trunks (not canopies), lampposts, fence posts
- **Surfaces support you** — rooftops, steps, decks, bridge roads
- **Nothing traps you** — if you can see a way out, you can walk out

### What This Means Technically

- **Mesh raycast is the correct collision method** — it respects actual geometry, letting the player through gaps while blocking walls
- **NEVER use bounding spheres or bounding boxes for collision** — they create invisible force fields that keep the player away from the very things they want to explore
- A bounding sphere around a temple means you can never enter it. That **destroys the game**.
- A bounding box around a house blocks the doorway. That **destroys the game**.

### The Only Exception

Tree trunks and lampposts can use a small cylinder/sphere collision because their solid part IS roughly cylindrical. But the radius must match the **trunk**, not the canopy. The player should walk under branches.

## Objects Are Not Enemies

This is not a game where the player fights the environment. The physics should be:
- **Generous** — if the player is close to fitting through a gap, let them through
- **Forgiving** — if the player gets stuck, they should be able to jump or walk out easily
- **Invisible** — good collision feels like solid objects. Bad collision feels like invisible walls.

## Scale Must Feel Right

- Objects should look the right size compared to the character
- A house should feel like a house you could live in, not a dollhouse or a warehouse
- Trees should tower over the character but not be impossibly huge
- Landmarks should be impressive but approachable
- The planet should feel small and cozy, not vast and empty

## Density Creates Life

- Zones should feel **lived in** — multiple objects creating a scene, not isolated structures
- But objects must have breathing room — not overlapping, not smushed
- The space BETWEEN objects matters — paths, clearings, viewpoints
- Every zone should have something to discover that rewards walking there

## Performance Serves Experience

- 60fps is the target. Anything below 30fps breaks immersion.
- Reduce object count before reducing visual quality
- A beautiful world at 30fps is better than an ugly world at 120fps
- Debug tools (F3) should be comprehensive but invisible during normal play

## The Camera Tells the Story

- The camera should always show the character in context — the character AND the surrounding world
- Camera should never fight the player — smooth, responsive, predictable
- Different camera modes serve different moments: orbit for exploring, close for detail, first person for immersion
- The photo system IS a core feature, not an afterthought
