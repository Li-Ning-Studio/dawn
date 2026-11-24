# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Theme Development

```bash
# Start Shopify theme development server
npm run dev

# Pull theme from Shopify store
npm run pull

# Run Theme Check for Liquid validation
shopify theme check
```

### React Components Development

```bash
# Navigate to React workspace
cd reax

# Start Vite development server for React components
npm run dev

# Build React components (outputs to ../assets/ with vx- prefix)
npm run build

# Generate TypeScript types from GraphQL schema
npm run codegen
```

## Architecture Overview

This is a hybrid Shopify Dawn theme that integrates React components for enhanced product customization services. The architecture consists of:

### Core Integration Pattern

- **Shopify Liquid Theme**: Standard Dawn theme structure for e-commerce functionality
- **React Components**: Built separately in `/reax/` and compiled to `/assets/` with `vx-` prefix
- **Service Integration**: Custom services (stringing, remix, tshirt-printing) embedded via Liquid snippets

  - Flexbox-based, NOT CSS Grid - Dawn uses display: flex with percentage widths
  - Responsive breakpoints: 750px (tablet), 990px (desktop)
  - Grid columns: Calculated with calc() formulas accounting for spacing variables
  - Classes: .grid--3-col-desktop, .grid--4-col-desktop, etc.

  - Sections cannot access other sections in Liquid - major limitation discovered
  - Blocks within sections work perfectly - self-contained approach is best
  - Schema-driven configuration - extensive use of Shopify section settings

### Data Flow

- **Liquid → JavaScript**: Global variables set in templates expose Shopify data to React components
- **Form Integration**: React components sync with HTML forms via DOM manipulation and custom validation
- **Cart Bundling**: Services add additional line items with properties linking to main products
- **Service details at checkout**: service lines also get one visible property (`sections.cart.service_details`, "Details") holding the customer's choices as comma-separated values (stringing: tension + knots; remix: sticker text; t-shirt printing: text + second line). Built by `serviceDetails` in `assets/product-form.js`; the `_` properties remain the fulfilment data.

### React Build System

- **Vite Configuration**: Builds multiple entry points for each service component
- **Asset Output**: React bundles output to `/assets/` directory for theme consumption
- **Code Splitting**: Each service is a separate bundle with shared dependencies extracted

### Service Architecture

Each custom service follows this pattern:

1. **Liquid Snippet** (e.g., `snippets/remix.liquid`) - Provides wrapper and loading logic
2. **React Component** (e.g., `reax/src/components/remix/`) - Handles complex interactions
3. **Form Integration** - Validates and submits via main product form in `assets/product-form.js`

### Key Global Variables

Services communicate through window variables:

- `window.s3_*` - Service-specific configuration and data
- `window.routes` - Shopify API endpoints
- `window.s3_current_variant_sku` - Current product variant for service linking

### Brand Support

Multi-brand architecture with conditional logic based on `window.s3_brand` and domain detection (`hndrd.co` vs others).

## File Structure Notes

- **Main Theme**: Standard Shopify structure (sections/, snippets/, templates/, layout/, assets/)
- **React Workspace**: `/reax/` contains all React components and build configuration
- **Service Components**: Each service has its own directory in `reax/src/components/`
- **Type Definitions**: GraphQL types generated in `reax/src/lib/types/`

## Development Workflow

1. **Theme Changes**: Edit Liquid files directly, use `npm run dev` for live reload
2. **React Changes**: Work in `/reax/`, use `npm run build` to compile to assets
3. **Service Integration**: React components load lazily when services are selected
4. **Testing**: Services integrate with main product form validation and cart functionality

## Development Principles

### Always Find the Most Direct and Minimal Solution

- **Work WITH existing code structure**, don't rebuild it
- **Leverage existing functionality** instead of replacing it
- **Add minimal changes** to achieve the desired result
- Always check the existing patterns in the codebase first, respect the framework's limitations

<!-- imported-from: codex:project:instructions -->
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
  - String rules: all strings come from one collection (`settings.stringing_collection_id`, first 10 products; shared with gripping). A string product can restrict which rackets show it with the optional JSON metafield `custom_but_hidden.stringing_rules` (definition must have Storefront API access), based only on the racket's collections, e.g. `{ "show_when": [ { "field": "collections", "op": "has", "value": "rackets-under-3k" } ] }`. Racket groups (price bands, tension, weight, type, specific rackets) are Shopify smart/manual collections, so a rule and a discount can share one definition. Ops: `has`, `not_has` (collection handle, case-insensitive). All conditions must match; no rule = shown everywhere. The collection must be published to the Online Store (Liquid `product.collections`, passed as `data-racket-collections` on `#stringing-root`, hides others). Tension/weight metafields are text (`"32 lbs"`), so their collections need "any condition" lists of exact values. Invalid JSON/field/op hides the string and logs `console.warn` (fail closed). Logic: `matchesStringRules` in `reax/src/components/stringing/Stringing2.tsx`.
  - Free strings: `free_when` (same format) labels the string FREE in the menu when it matches, e.g. 700 S: `{ "free_when": [ { "field": "collections", "op": "has", "value": "rackets-less-than-2k" } ] }`. Display only: the real ₹0 comes from the Shopify automatic BXGY discount "Free 700S String" (buy 1 from the same collection "Rackets less than 2k", get 700 S 100% off), so label and price always cover the same rackets. Pausing the discount without removing `free_when` shows FREE but charges full price. A ₹0 string is also labelled FREE. The menu lists at most 7 strings per filter (`MAX_VISIBLE_STRING_OPTIONS`), so keep a free string near the top of the strings collection. Missing `show_when` = shown; missing `free_when` = not free.
  - String filters: the chips above the string list (ALL + one per filter) come from data. Each filter is a `stringing_filter` metaobject (fields `name` = chip label, `description` = 1–2 line text shown under the chips when that chip is selected; Storefront access required). A string joins one filter via the product metafield `custom_but_hidden.stringing_filter` (metaobject reference). No filter = string only under ALL. Chips follow the strings collection's sort; a filter with no available string shows no chip. Logic: `stringFilterOf` / `filterOptions` in `Stringing2.tsx`. Locale key `studio.stringing.filters.balanced` is still used as the tension section heading.
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

## Cart Drawer Rewards Progress Bar

- Kaching-style bar at the top of the cart drawer: up to 3 milestones (amount, reward label, pasted SVG icon; empty = `icon-gift.svg`) under theme settings → Cart → "Rewards progress bar" (`cart_progress_enabled`, `cart_milestone_{1..3}_amount|label|unlocked|icon|gift`). `unlocked` is the optional text shown once that milestone is the highest reached (empty = `sections.cart.progress.unlocked`, "Eligible for <label>").
- Display only: each amount must match a real Shopify discount (free shipping, % off at a minimum, gift) kept in sync by hand. Amounts are in shop currency major units, entered in ascending order; an empty amount or label hides that milestone.
- Milestone gift: optional product per milestone (`cart_milestone_{n}_gift`). `Bxgy.syncMilestoneGifts` in `assets/bxgy.js` (data: `window.s3_milestoneGifts` in `layout/theme.liquid`) keeps exactly one line of that product's first available variant, marked `_milestoneGift: "<n>"`, while the cart subtotal without gift lines is at least the amount, and removes it below, so an unearned gift never reaches checkout at full price. Runs after every `cartUpdate` event and on page load, never publishes `cartUpdate` (no loops), and re-renders the drawer and `/cart` without opening the drawer. Gift rows carry `data-milestone-gift`; CSS in `assets/component-cart-items.css` hides the stepper and Remove and shows a "Free gift" tag. A sold-out gift shows `sections.cart.milestone_gift_unavailable` in `<bxgy-notice>`. Price guard: a gift line that should be free but isn't ₹0 in the cart (discount missing, paused or misconfigured) is removed, logged with `console.warn`, and that milestone's gift is skipped until the next page load (`milestoneGiftsUndiscounted`). The ₹0 price comes only from a Shopify Buy X Get Y discount (customer spends the minimum amount, gets the product 100% off, combinable with product/order/shipping discounts). Removing items inside checkout (GoKwik) is not guarded.
- All milestones reached: the bar collapses into a tinted banner with the last reward's icon (`.cart-progress__banner-icon`, CSS `:has` on the last reached milestone).
- Progress uses `cart.items_subtotal_price`. Pure Liquid + CSS inline in `snippets/cart-drawer.liquid` (inside `<cart-drawer-items>` so every drawer re-render refreshes it); styles in `assets/component-cart-drawer.css` (`.cart-progress*`).
- Line items: a ₹0 line (e.g. BXGY free string) shows FREE. "Your Savings" in the footer = Σ(compare-at or regular price × qty) − `cart.total_price` (sale prices + all discounts).
- Strung racket: the option line reads "black-lime · 26 lbs" from the stringing child line's `_tension` (the string name is already listed under "Show bundle").
- "Complete your kit": `cart-recommendations` with `layout: 'list'` (drawer only; the PDP OOS carousel is unchanged) renders compact rows via `renderList` in `assets/cart-recommendations.js`. Single-variant products get one-tap "+ Add"; multi-variant ones link to the PDP ("Choose").
- Empty drawer: `snippets/cart-drawer-trending.liquid` lists up to 4 products from Theme settings → Cart → Cart drawer → Collection (set it to the header's Trending collection; sections can't read each other's settings). Row styles shared as `.cart-upsell*`.
