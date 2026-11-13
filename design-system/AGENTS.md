# Prototype Instructions

## HNDRD decisions

- This is a responsive web component library, not a native mobile app. The approved mobile collection is a viewport of the responsive website.
- Selected visual: references/selected-no-swatches.png. Preserve its two-column mobile composition.
- Figtree, white and soft grey, charcoal primary actions, sole brand accent #FFA300, pill controls, square media.
- Omit product colour swatches in v1. Required colour choices use labelled text controls.
- Keep all visible UI copy in src/locales/en.json. Product names and verified catalogue values are fixture data.
- Use portable semantic HTML, CSS, and plain JavaScript. The Vite starter supplies development and build tooling only.
- No theme adoption, actual cart API calls, checkout, payment submission, or publishing in this work.
- Preserve existing workspace changes outside design-system/.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
