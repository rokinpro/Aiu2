# Aiu2 contributor instructions

Build the app first. The initial scope is a functional, accessible demo interface with one future ultrasonic device. Graph nodes are places, not hardware devices.

- Use Next.js App Router, TypeScript and Tailwind. Keep shared payloads in lib/types.ts.
- Use a concise illustrative-map note and put source status in the conditions panel; avoid repeated demo banners. Never invent verified campus facts, dimensions, elevator availability or support contacts. Unknown measurements must be null.
- Preserve explicit directed edges and floor transitions. Hard access requirements must exclude incompatible and unknown measurements. Keep route selection deterministic; AI must never decide eligibility.
- Treat user preferences as explicit choices, never diagnoses. Include text directions, semantic labels, 44px targets, visible focus and reduced-motion support.
- Keep credentials server-side. Never commit .env files, readings tied to people, private reports, or the source project brief. .env.example contains empty placeholders only.
- One connected sensor belongs to elevator-a-lobby. The second zone, elevator-b-lobby, is prepared for a future device; never show it as live without readings. Activity is a presence proxy, never a people count, confirmed obstruction, or elevator fault. Stale data is unknown.
- Reports remain pending review and do not modify the graph automatically. Use SQLite for server persistence, scoped to the anonymous browser session.
- Ingestion is implemented; implement firmware, bridge and AI stages only when requested. Confirm board and module before wiring. Do not claim an integration works without a real test.
- Run npm test and npm run build before handoff. Update README with actual behavior and limitations. Keep commits small and avoid unrelated changes.
- Prioritize a polished, intuitive judge demonstration and accessible feature controls under the hackathon time limit. Keep verification focused: routing regression tests, one production build, and a short browser check of the changed journey; avoid exhaustive unrelated checks before pushing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
