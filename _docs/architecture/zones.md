# Zone Placement System

## Overview

The planet has 14 hand-authored zones, each with specific lat/lon center and curated content. Objects are not randomly scattered — they're deliberately placed to create distinct "places" worth visiting.

## Placement Functions

- `place(factory, lat, lon, scale)` — places one object, applies `WORLD_SCALE`
- `placeLM(factory, lat, lon, name, scale)` — same but registers as a named landmark for HUD
- `scatter(factory, lat, lon, radius, count, sMin, sMax)` — places N objects randomly within a radius
- `placeNPC(color, hat, lat, lon)` — places an NPC (not scaled by WORLD_SCALE)
- `placeAnimal(factory, lat, lon, behavior)` — places an animal

## Object Height

Objects are placed using `groundHeight()` (analytical). This means they may float slightly above the mesh face on steep terrain. To fix: raycast at placement time (one-time cost, not done yet).

## Zone List

| # | Name | Lat | Lon | Key Content |
|---|------|-----|-----|-------------|
| 1 | Pyramid Complex | 15°N | 30°W | 3 pyramids, markets, cacti |
| 2 | Mediterranean Village | 35°N | 60°E | Temple, 5 houses, well, NPCs |
| 3 | Castle Highlands | 50°N | 120°W | Castle, houses, campfire, sheep |
| 4 | Dutch Countryside | 48°N | 5°E | Windmill, farmhouses, 45 flowers |
| 5 | Lighthouse Coast | 25°N | 150°E | Lighthouse, dock+boat, crabs |
| 6 | Golden Bridge | 20°N | 120°E | Bridge, houses, palms |
| 7 | Statue of Freedom | 30°N | 70°W | Statue, dock, benches, lampposts |
| 8 | Tropical Jungle | 10°N | 80°E | Ruins, 45 palms, mushrooms |
| 9 | Snowy Peak | 65°N | 30°E | Campfire, ruins, ice spikes |
| 10 | Tower Plaza | 42°N | 20°E | Tower, ruins, market |
| 11 | Beach Resort | 5°N | 100°W | Beach huts, shipwreck, crabs |
| 12 | Deep Forest | 55°N | 60°E | Dense pines/birch, mushrooms |
| 13 | Desert Oasis | 12°N | 60°W | Palms, campfire, market |
| 14 | Southern Tundra | 55°S | 0° | Snowy pines, ice spikes |

Plus 200 sparse global fill objects between zones.

## Ambient Life

- 13 NPCs (wander near home position, animated walk cycle)
- ~15 birds (circle above zones)
- ~8 butterflies (flutter near flowers)
- ~6 sheep (graze in grasslands)
- ~5 crabs (scuttle on beaches)
- Campfire lights (dynamic flicker)
- Windmill blades (rotation)
- Cloud drift (orbit planet)
