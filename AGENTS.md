# Repository Guidelines

## Project Structure & Module Organization

- `assets/`: Theme JS, CSS, images, and fonts.
- `layout/`: Global layouts (for example, `theme.liquid`).
- `sections/`: Modular UI blocks used across templates.
- `snippets/`: Reusable Liquid partials.
- `templates/`: Page-level templates (for example, `product.json`, `collection.liquid`).
- `config/`: Theme settings (`settings_schema.json`, etc.).
- `locales/`: Translations. Keep keys consistent and scoped.
- `.github/`: CI, PR templates, contribution docs.

## Build, Test, and Development Commands

- `pnpm dev` or `npm run dev`: Start local dev server via Shopify CLI (`shopify theme dev`).
- `pnpm run pull`: Pull the latest theme files from the configured store.
- `npx shopify theme check`: Lint Liquid and theme structure with Theme Check.
- `npx prettier --write .`: Format files (uses `@shopify/prettier-plugin-liquid`).
- Preact bundles: `cd reax && pnpm install && pnpm build` (outputs `assets/vx-*.js`).

Example: `SHOPIFY_FLAG_STORE=<your-store>.myshopify.com pnpm dev` to point the dev server at a specific store.

## Coding Style & Naming Conventions

- Indentation: 2 spaces for Liquid, JSON, JS, and CSS.
- Liquid: Prefer server-rendered HTML; keep JS progressive and minimal.
- Naming: Use kebab-case for files (for example, `main-product.liquid`), snake_case for translation keys, and descriptive section/snippet names.
- Formatting: Required via Prettier (`.prettierrc.json`); single quotes except in `*.liquid`.
- Linting: Use Theme Check (`.theme-check.yml` governs rules). Keep rules green before opening PRs.
- Comments: Write clear and verbose comments that will be useful for LLMs like you to grasp context in future.
- Translations: Do not directly write english text in the code. Use translation files present in locales. The default language is English.
- Be minimal: Try to achieve things by changing as little code as possible. Keep it simple.

## Preact Integration (reax/ → assets/)

- Source: `reax/src/components/<feature>`. Built with Vite + Preact; entries are defined in `reax/vite.config.ts` and emit to `assets/` as `vx-<feature>.js`.
- Mount points: Liquid renders a root element with a stable id (for example, `stringing-root`, `splus-root`, `remix-modal`, `tshirt-printing-modal`, `track-root`).
- Loading: Liquid snippets lazy-load the matching `vx-*.js` via `<script type="module" defer src="{{ 'vx-<feature>.js' | asset_url }}"></script>` either on interaction or when idle.
- Data flow: Pass data using `data-*` attributes on the root. Read via `document.getElementById('<id>')?.dataset` in `index.tsx`.
- Example snippet pattern:
  - Liquid: `<section id="stringing-root" data-stringing-collection-id="{{ settings.stringing_collection_id }}"></section>` and load `{{ 'vx-stringing.js' | asset_url }}` on demand.
  - Preact: `const el = document.getElementById('stringing-root'); render(<App prop={el?.dataset.stringingCollectionId} />, el!);`

Current Preact-backed features

- Stringing options: `snippets/stringing.liquid` → `assets/vx-stringing.js`.
  - String rules: all strings come from one collection (`settings.stringing_collection_id`, first 10 products; shared with gripping). A string product can restrict which rackets show it with the optional JSON metafield `custom_but_hidden.stringing_rules` (definition must have Storefront API access), e.g. `{ "show_when": [ { "field": "price", "op": "<", "value": 2000 } ] }`. All conditions must match; no rule = shown everywhere. Fields: `price` (selected/first variant, major units), `max_tension` (lbs), `weight`, `product_type`, `handle`, passed as `data-racket-*` on `#stringing-root`. Ops: `<`, `<=`, `>`, `>=`, `=`, `!=`, `in`, `not_in` (array value); string comparisons ignore case. Invalid JSON/field/op hides the string and logs `console.warn` (fail closed). Logic: `matchesStringRules` in `reax/src/components/stringing/Stringing2.tsx`.
  - Free strings: `free_when` (same format) in the same JSON labels the string FREE in the menu when it matches, e.g. 700 S: `{ "free_when": [ { "field": "price", "op": "<", "value": 2000 } ] }`. Display only: the real ₹0 comes from the Shopify automatic BXGY discount "Free 700 S string" (buy 1 from smart collection "Rackets under ₹2000", get 700 S 100% off). Keep thresholds in sync; pausing the discount without removing `free_when` shows FREE but charges full price. A ₹0 string is also labelled FREE. Missing `show_when` = shown; missing `free_when` = not free.
- S‑Plus options: `snippets/s-plus.liquid` → `assets/vx-splus.js`.
- Remix modal: `snippets/remix.liquid` → `assets/vx-remix.js`.
- T‑Shirt printing: `snippets/tshirt-printing.liquid` → `assets/vx-tshirt-printing.js`.
- Order tracking page: `templates/page.track.json` loads `assets/vx-track.js` into `#track-root`.

## Testing Guidelines

- Primary checks: Theme Check locally and CI. Aim to keep Lighthouse regressions minimal (CI runs Lighthouse audits).
- Manual QA: Verify key flows (home, product, collection, cart, checkout link) in `shopify theme dev`.
- Conventions: For new features, include demo content/settings so reviewers can reproduce.

## Todo Tracking

- `TODO.md` is the canonical backlog for this theme. Read it when the user asks to show, add, move, complete, or work on theme todos.
- Update `TODO.md` only when the user explicitly requests a todo change or selects a listed item for implementation. Do not add incidental findings or import inline code `TODO` comments automatically.
- Put new tasks in `Next` unless the user names another section. Within each section, keep the highest-priority item first.
- When the user selects a listed task for implementation, move it to `Now`. Move it to `Done` only after the requested work and relevant verification succeed; mark it checked and append the completion date as `YYYY-MM-DD`.
- Keep blocked or partially completed work in `Now` with a short status note. Use Codex goals only for a single bounded active task, not as the backlog.

## Racket Finder Documentation

- `docs/RACKET-FINDER.md` is the canonical explanation of finder logic. Read its matching behaviour section before changing the finder.
- Maintain this document in the same change whenever finder behaviour changes, including questions, eligibility, scoring, specification coverage, tie-breakers, personality assignment, metaobject inputs, result explanations, or refresh/saving behaviour. Keep formulas, worked examples, limitations and relevant verification accurate; distinguish starter defaults from store-owned settings and tested fixtures from live-store evidence.
- For ranking changes, update the relevant cases in `tests/racket-finder.test.mjs` and document the final implemented behaviour before considering the work complete.

## Commit & Pull Request Guidelines

- Commits: Write clear, imperative messages (for example, "Add predictive search section"). Group related changes.
- PRs: Use `.github/PULL_REQUEST_TEMPLATE.md`—include summary, linked issue ("Fixes #123"), demo store links, testing steps, and screenshots/GIFs for UI changes.
- Quality gates: Run Theme Check and Prettier locally before pushing. Ensure accessibility, cross-browser, and mobile checks pass.

## Security & Configuration Tips

- Do not commit store credentials. Authenticate locally with `shopify login`. Configure CI secrets in GitHub.
- Keep translations updated in `locales/` and settings in `config/` when adding UI.

## Recommendations + Sliders (Context Log)

This theme implements Related, Complementary, Recently Viewed, and OOS (out-of-stock) product recommendations with a unified horizontal slider UX. Notes and decisions below capture what we shipped and why.

What we changed

- Unified slider pattern: All recs use Dawn’s `slider-component` with desktop arrows and mobile swipe, consistently showing ~2.5 cards.
  - CSS: `assets/recs-slider.css` (scoped add-on) provides widths, header layout, arrow placement (top-right), no first-item gap, and mobile arrow hide.
  - Classes: UL uses `grid product-grid contains-card contains-card--product slider slider--everywhere grid--peek recs-slider`. Each LI uses `grid__item slider__slide` with stable `Slide-<id>-<n>`.
  - Smooth scroll: `assets/global.js` updated to use `{ behavior: 'smooth' }` in slider scroll, honoring reduced motion.
- Related and Complementary (Search & Discovery):
  - Sections refactored to slider markup: `sections/related-products.liquid`, `sections/pairs-well-with.liquid`.
  - Still fetch via `product-recommendations` endpoint; section renders slider markup once loaded.
- Recently viewed:
  - Section: `sections/recently-viewed.liquid` now renders a hidden `slider-component` header + UL; reveals only after content inject.
  - Script: `assets/recently-viewed.js` tracks products in `localStorage['recently_viewed_products']` and renders cards via `/products/<handle>?view=recent-card`.
  - Prevented header/arrow flash by hiding wrapper/header/slider until slides are appended; unhide and `resetPages()` after inject.
  - View: `templates/product.recent-card.liquid` returns a single `<li class="grid__item">` using `snippets/card-product.liquid`.
- Swipeable Products section:
  - `sections/swipeable-products.liquid` rewritten to the unified slider markup; removed bespoke JS/CSS. Adds a bit of left margin for the first item.

Operational notes

- Avoid editing `component-slider.css` directly; keep customizations scoped in `recs-slider.css` to reduce merge conflicts and side effects on other sliders.
- Hide components by default and reveal after JS injection to prevent UI flashing.
