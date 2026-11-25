# Cart Upsell Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The cart drawer's "Complete your kit" shows up to 5 add-ons chosen by owner-written rules (product type → collections) instead of Shopify's lookalike recommendations.

**Architecture:** A `cart_upsell_rule` metaobject holds the rules. `snippets/cart-recommendations.liquid` picks and renders the rows server-side when `layout: 'list'` (drawer only); every drawer re-render refreshes them. `assets/cart-recommendations.js` keeps only the one-tap add for the list layout and no longer fetches for it; the carousel layout (PDP OOS) is untouched.

**Tech Stack:** Shopify Liquid, vanilla JS custom element, Shopify Admin GraphQL (metaobjects).

**Spec:** `docs/superpowers/specs/2026-11-25-cart-upsell-rules-design.md`

## Global Constraints

- Show at most **5** suggestions.
- No English text in code: reuse `sections.cart.upsell.heading|add|adding|choose`.
- Leave storefront collection sort orders untouched; a rule's collection order is whatever the owner set (manual = owner-curated).
- Product type comparison is case-insensitive (`| downcase`), trims spaces.
- 2-space indent, Prettier, Theme Check green. Verbose comments explaining the rules for future LLMs.
- No new theme files (memory: prefer no new files); docs live in `CLAUDE.md`.
- Liquid has no unit-test harness here: verification is Theme Check plus scripted cart scenarios in the browser.

## Review Focus

- Cart whose only lines are ₹0 milestone gifts or services → no main item → `default` rule, never an error.
- Main product type with no rule and an empty `default` → block hidden, no empty heading.
- One-tap add → drawer re-renders and the added product drops out of the list (excluded as in-cart).
- Strung racket (string child line nested under it) → no strings suggested; plain racket → strings not listed by rule anyway.
- Shoes in cart + racket in cart → main item is the pricier one; the other's type still excluded.

---

### Task 1: Create the rules in the store

**Files:** none in the theme (Shopify Admin data).

**Interfaces:**
- Produces: metaobject type `cart_upsell_rule`, fields
  `product_types` (`list.single_line_text_field`, required) and
  `collections` (`list.collection_reference`, required); `access.storefront: PUBLIC_READ`
  (needed for Liquid `shop.metaobjects`). Display name field: `product_types`.

- [ ] **Step 1:** `metaobjectDefinitionCreate` with the definition above (name "Cart upsell rule").
- [ ] **Step 2:** `metaobjectCreate` one entry per row (collection handles → resolve to GIDs first):

| handle | product_types | collections (in order) |
|---|---|---|
| badminton-racket | Badminton Racket | badminton-shuttlecocks, grips, intermediate-badminton-shoes, badminton-kitbags, socks |
| badminton-shoes | Badminton Shoes | badminton-rackets, socks, insoles, shoe-bags, ankle-support |
| shuttlecock | Shuttlecock | grips, wristbands, socks |
| string-grip | String, Grip | badminton-shuttlecocks, grips, wristbands |
| pickleball-paddle | Pickleball Paddle | pickleball-balls, pickleball-bags, pickleball-shoes |
| tennis-racket | Tennis Racket | tennis-balls, tennis-grip, tennis-strings |
| apparel | Unisex T-Shirt, Unisex Shorts, Unisex Jacket, Unisex Track Pant, Women Skirts | socks, wristbands, sports-bottles |
| default | default | badminton-accessories |

- [ ] **Step 3: Verify** with `metaobjects(type: "cart_upsell_rule", first: 20)` — expect 8 entries, each with non-empty `collections`.

### Task 2: Server-side picks in the drawer

**Files:**
- Modify: `snippets/cart-recommendations.liquid` (list layout branch)
- Modify: `snippets/cart-drawer.liquid:831-836` (`limit: 5`)
- Modify: `assets/cart-recommendations.js` (list layout: no fetch; delete `renderList`)
- Modify: `CLAUDE.md` ("Complete your kit" bullet)

**Interfaces:**
- Consumes: Task 1 metaobject.
- Rows keep today's markup/classes (`.cart-upsell`, `.cart-upsell__item|media|image|info|title|price|add|choose`) and `data-variant-id` on `.cart-upsell__add`, so CSS and `addToCart(button)` are reused unchanged.
- The element carries `data-layout="list"`; JS treats that as "already rendered".

- [ ] **Step 1: Liquid selection** (only when `layout == 'list'`), algorithm:

```
in_cart_ids, in_cart_types (downcased) ← every cart.items line (nested lines included)
main ← top-level line (item.parent_relationship.parent blank), type ≠ "service",
       highest item.final_price; ties → first
rule ← first shop.metaobjects.cart_upsell_rule.values whose product_types (downcased, stripped)
       contains main type; else the "default" entry
for coll in rule.collections (then default.collections if still < limit):
  take the first product in coll.products (scan ≤ 10) that is available,
  id ∉ in_cart_ids ∪ picked, type ∉ in_cart_types → append; next collection
stop at limit
nothing picked → render nothing (no element)
```

- [ ] **Step 2: Render** picked products as the existing rows: image `| image_url: width: 160`, title, `<s>compare_at</s>` when > price, `| money` price; `+ Add` button when `product.has_only_default_variant` (or `variants.size == 1`) and that variant is available, else `Choose` link to `product.url`. Heading visible; no loading/error blocks for the list layout.
- [ ] **Step 3: JS** — in `connectedCallback`, when `this.dataset.layout === 'list'`: attach the `.cart-upsell__add` click → `addToCart` handler and return (no subscribe, no fetch). Delete `renderList` and its branch in `renderRecommendations`.
- [ ] **Step 4:** `snippets/cart-drawer.liquid` render call → `limit: 5`.
- [ ] **Step 5: Theme Check** — `shopify theme check` → no new offenses in touched files.
- [ ] **Step 6: Browser QA** (dev theme preview) — expect:
  - Strung Nitrix 10 5U → shuttlecock, grip, shoes, kitbag, socks; no racket, no string.
  - Badminton shoes only → a racket first, then socks, insole, shoe bag, ankle support.
  - Shuttlecock only → grip, wristband, socks + 2 from badminton-accessories.
  - Racket + shoes → racket rule (pricier); no shoes suggested.
  - Tap "+ Add" on a grip → drawer re-renders, grip now in cart and gone from list; no console errors; no extra `/recommendations` requests.
  - PDP OOS carousel still loads as before.
- [ ] **Step 7: Docs** — rewrite the "Complete your kit" bullet in `CLAUDE.md`: metaobject fields, main-item rule, exclusions, default entry, limit 5, collection order = suggestion order.
- [ ] **Step 8: Commit** (when the owner asks) — `git add snippets/cart-recommendations.liquid snippets/cart-drawer.liquid assets/cart-recommendations.js CLAUDE.md docs/superpowers`
