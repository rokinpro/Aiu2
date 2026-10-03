# Build status

The complete supplied brief was reviewed. Current authorization is the app-first scaffold, repository setup and Prompt 1. Later prompt stages remain future work.

## Architectural decisions

- Keep a 12-place graph for meaningful route comparisons; reserve exactly one physical sensor location. Graph places do not imply sensor purchases.
- Use a schematic SVG instead of external indoor maps or map credentials.
- Implement enough routing to make the interface functional now. Prefer transparent facts over an accessibility score.
- Use local browser storage explicitly for the initial interface. Shared persistence needs a server adapter in the next stage.
- Keep the physical dashboard separate from traveler controls. Unknown is the initial sensor state.
- Do not connect optional sponsors, write hardware-specific firmware or invent live readings in this stage.

## Verification

Production build and routing unit tests are required by CI. Browser QA covers controls, local observation persistence, floor selection, empty-route state, conditions navigation and mobile overflow. Synthetic conditions in unit tests are not physical hardware verification.

## Needed from the team for the next stage

Exact board and sensor model labels; one hardware owner; selected real pilot area if available; IBM event access and permitted model (keys through local environment only). None block the current scaffold.
