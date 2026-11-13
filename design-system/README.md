# HNDRD design system

A responsive, interactive reference library for HNDRD's digital brand and ecommerce experience. The approved direction uses Figtree, white and soft grey, charcoal actions, #FFA300 accents, pill controls, and square product imagery. Product colour swatches are deferred; required colour choices use labelled text pills.

## Preview

- Library: http://127.0.0.1:4173/#foundations
- Common UI: http://127.0.0.1:4173/#components
- Shopping patterns: http://127.0.0.1:4173/#commerce
- Complete shopping example: http://127.0.0.1:4173/#shop
- Usage guidelines: http://127.0.0.1:4173/#guidelines

The shopping example connects filtering, sorting, search, product images, availability, quantities, stringing, and an editable cart. The cart is held in memory and resets on page reload. Checkout ends at an explicit demonstration screen. No production APIs or payment requests are made.

## Included

| Area              | Components and behaviour                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foundations       | Colour roles, type scale, spacing, shape, motion, responsive layout, downloadable tokens                                                         |
| Common UI         | Primary/secondary/text/icon actions, inputs, select, checkbox, radio, switch, badges, alerts, toast, loading/error/empty/success/disabled states |
| Navigation        | Desktop/mobile navigation, breadcrumbs, skip link, keyboard tabs, accordions, dialogs and drawers                                                |
| Product discovery | Responsive cards, search, filter drawer, sorting, horizontal recommendations, sold-out treatment                                                 |
| Product detail    | Gallery, labelled variant choices, availability, quantity, specifications, stringing summary, purchase action                                    |
| Stringing         | String → colour → tension → method → review; validation, editing, discard confirmation, loading/error/empty and service-unavailable scenarios    |
| Cart              | Exact customisation, quantity, removal, stringing edits, item and subtotal calculation, empty state, checkout entry                              |
| Brand             | Product editorial and a clearly labelled illustrative campaign treatment                                                                         |

Two product cards across on mobile, three on tablet, four on desktop. Cards open the product page. No quick shop, invented ratings, countdowns, or active offer claims.

## Source files

- `public/tokens.json`: portable design token source of truth.
- `scripts/tokens.mjs` → `public/tokens.css`: CSS variable generation, run during dev and build.
- `src/styles.css`: shared responsive styles and component classes.
- `src/ui.js`: markup helpers; `src/library.js`: documentation and specimens.
- `src/shop.js`: collection, product, and cart markup.
- `src/main.js`: preview state and event handling.
- `src/model.js`: catalogue mapping, selection validation, cart rules and prices.
- `src/locales/en.json`: visible interface copy. Product names and verified values remain fixture data.
- `src/data/catalogue.json`: captured official product and variant data, with timestamp.
- `public/sources.json`: provenance, reference status, licences and evidence limitations.
- `references/selected-no-swatches.png`: approved visual reference.
- `design-qa.md`: visual comparison and validation results.

The markup uses semantic HTML and plain JavaScript; React is not used at runtime. The scaffold's hosting files remain intact for a later handoff. This project has not been published or adopted into the Shopify theme.

## Run and build

From this directory:

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run build
npm run test:model
npm run test:sites
```

Build output is `dist/client/`, plus the scaffold's `dist/server/` and hosting configuration. Files in `dist/` and `node_modules/` are ignored.

`tests/browser.cjs` runs against an already running preview and uses Playwright with installed Google Chrome. Resolve `playwright` locally, or set `PLAYWRIGHT_MODULE` to an existing package path. Optional `PREVIEW_URL` changes the target. Results are saved to `qa/browser-results.json`; screenshots are local, ignored artefacts in `qa/screenshots/`.

## Pricing and product evidence

Official public HNDRD data was captured on 23 October 2026 IST (22 October UTC). The four racket sample and two strings are not the complete store catalogue. Product specifications were checked against the HNDRD catalogue. Prices and availability are snapshots; refresh them before further store work.

Four knots **replaces** the base stringing service. The model charges the string plus exactly one selected full service price, per racket. Quantities multiply that full configured price. Unavailable variants and invalid tension values cannot be added. The preview implements integer tension choices from 21 lbs through the fixture racket's 32 lbs maximum. It does not recommend a tension or infer a performance benefit from knot count.

Store discounts, free-service promotions, gateway behaviour, order records, native cart parent/child lines, and fulfillment are outside this isolated prototype. The preview groups stringing in one configurable cart item for review; actual Shopify adoption must retain the production payload and service-replacement guards.

## Adoption

Map tokens and semantic markup into the existing Liquid/Preact components one component at a time. Preserve locale keys, existing product data, availability rules, stringing service replacement, and cache compatibility. Validate real storefront, cart, checkout, keyboard use, mobile browsers, and payment behaviour before release.

The reference captures cover On, Cowboy and Custo. Aesop returned 403 and was excluded with approval. Reference layouts informed the exploration; competitor images and claims are not used as HNDRD content. Product imagery and wordmark are official HNDRD assets; Figtree's licence is included locally.
