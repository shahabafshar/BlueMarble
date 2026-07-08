# Cyrus mission ledger

Manager-curated trajectory state. Append-only (with caps). Read by the
planner before scoping every iteration and by the assessor before scoring.

## Attempts
- iter 1 / c1 / Wrote README.md at root with all 7 sections in summarize-and-link voice, relative links to _docs/ → done
- iter 1 / c2 / Grepped index.html for constants/controls before writing; restated them in README tables → partial: camera mode names reversed (1=first person, 3=orbit, not vice versa)
- iter 1 / c5 / Contributing section restating CLAUDE.md invariants + _tests replica rule + fulltest gatekeeper → done
- iter 2 / c2 / Re-grepped index.html for camMode handler and constants; fixed README camera-mode order (1=fp, 2=close, 3=orbit) and controls-hint → done
- iter 2 / c3 / Added WHY block comments to groundHeight, getFrame/_lastFwRef, moveOnSurface/updateChar hybrid, GLB loader in index.html → partial: zone placement (index.html:1584) still lacks a rationale comment
- iter 2 / c4 / Not attempted — no _tests file was edited this iteration → partial: visualtest.cjs has no header; glbtest/fulltest/walktest headers lack r…
- iter 2 / c6 / Comment-only edits intended; no verification run performed → partial: node _tests/test.mjs never executed, browser console check never done

## Open Questions
_(none yet)_
