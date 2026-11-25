# Cart drawer "Complete your kit": hand-made category rules

## Why

"Complete your kit" in the cart drawer suggests lookalikes instead of add-ons (a racket in the cart
shows two more rackets and a string for an already-strung racket). Causes:

- Search & Discovery `complementary` is empty for most products, so `assets/cart-recommendations.js`
  silently falls back to `related` (substitutes).
- Every cart line seeds recommendations, including stringing service and string child lines.
- Nothing excludes what is already in the cart.

Goal: accurate cross-sells that raise order value, controlled by the store owner without code.

## Goals / non-goals / anti-goals

- Goal: suggestions come from owner-written rules "product type in cart → collections, in priority order".
- Goal: rules editable in Shopify admin; changing a rule needs no deploy.
- Non-goal (later): order-data co-purchase lists, free-shipping-gap targeting, in-drawer variant picker,
  PDP recommendations, the PDP OOS carousel (keeps using the current JS component unchanged).
- Anti-goal: the drawer showing a product (or product type) already in the cart; showing lookalikes;
  the drawer getting slower or flashing.

## Approaches considered

- **A. Metaobject rules, picked in Liquid (chosen).** Server-rendered with every drawer re-render,
  no extra fetch, rules are data. Cost: one-time metaobject definition + ~8 entries.
- B. Theme-setting slots (type + 3 collection pickers × N). No admin setup but capped and clunky.
- C. JS mapping fetching collections client-side. Smallest diff, but more requests, spinner stays,
  rules need a developer.

Picked A: most accurate (server sees the whole cart incl. nested service lines), fastest, owner-editable.

## Design

**Data.** Metaobject type `cart_upsell_rule` (Storefront access on):
- `product_types` (list of single-line text): matched case-insensitively against `product.type`.
  The entry with `default` as its product type is the fallback.
- `collections` (list of collection references): priority order. Within a collection, products come in
  the collection's sort order, so set suggestion collections to "Best selling".

**Selection (Liquid, in the drawer).**
1. Main item = the top-level cart line (no `parent_relationship.parent`, product type not `Service`)
   with the highest unit price. Its product type picks the rule; no match → `default` rule.
2. Excluded: every product id and every product type in the cart, nested child lines included
   (so a strung racket excludes strings).
3. Walk the rule's collections in order, taking the first available, non-excluded product from each,
   until 5 are picked. Still short → fill from the `default` rule. Nothing → hide the block.
4. Only scan the first few products per collection to keep render cost bounded.

**Rendering.** Same `.cart-upsell` rows, heading and labels as today; one-tap "+ Add" for
single-variant products, "Choose" link otherwise. The existing `addToCart` click handling is reused;
the drawer list no longer fetches `/recommendations`.

**Starter rules** (owner approved; builder resolves exact collection handles):

| product_types | collections |
|---|---|
| Badminton Racket | Shuttlecocks → Grips → Badminton Shoes → Kitbags/Bags → Socks |
| Badminton Shoes | Badminton Rackets → Socks → Insoles → Shoe Bags → Ankle Support |
| Shuttlecock | Grips → Wrist Bands → Socks |
| String, Grip | Shuttlecocks → Grips → Wrist Bands |
| Pickleball Paddle | Pickleball Balls → Pickleball Bags → Pickleball Shoes |
| Tennis Racket | Tennis Balls → Tennis Grips → Tennis Strings |
| Apparel types (T-Shirt, Shorts, …) | Socks → Wrist Bands → Bottles |
| default | badminton-accessories (best selling) |

Cricket and table tennis: `default` rule only, for now.

## Left to the builder

- Exact Liquid placement (inside `snippets/cart-recommendations.liquid` for `layout: 'list'`,
  or inline in `snippets/cart-drawer.liquid`) and how the JS skips fetching for server-rendered lists.
- Creating the metaobject definition and entries (via Shopify Admin API, with the owner's OK).
- Documenting the rules in `CLAUDE.md` next to the "Complete your kit" note.

---

# Addendum: quick-add sheet replaces "Choose" (approved 2026-11-25)

**Why.** "Choose" sends the shopper to the product page, out of the cart. Most suggestions vary only by
colour; a few by size (insoles, ankle support) or colour + size (shoes).

**Approaches.** (A) Dawn's quick-add modal: fetches and strips the whole PDP (heavy, services
included, modal over drawer). (B, chosen) a small sheet rendered from data Liquid already has.
Also considered: auto-pick the default colour (risks wrong colour), colour dots in the row, inline
expand.

**Design.**
- Every suggestion shows "+ Add". One variant → adds directly (unchanged). Several → opens a sheet
  sliding up inside the drawer: image, title, price, one chip row per option (`option.name` as label),
  close button. Server-rendered per row (hidden), so no fetch until Add.
- One option (colour-only, size-only): tapping an available chip adds that variant immediately.
- Several options (shoes): pick one chip per option; "Add to Bag" (`products.product.add_to_cart`)
  enables once the combination is an available variant. A chip is disabled when no available
  variant has it together with the other current selections. No preselection, so a size is never
  guessed.
- Adding reuses `addToCart`; the drawer re-renders (sheet gone, product drops out of the list).
- Close: ×, Esc, tap outside. Focus moves into the sheet and back to "+ Add" on close.
- No new translation keys: `sections.cart.upsell.add|adding`, `products.product.add_to_cart`,
  `accessibility.close`. `sections.cart.upsell.choose` becomes unused.

**Reuse (user request, same day).** The sheet is a standalone component for collection and other
product cards too: `snippets/quick-add-sheet.liquid`, `assets/quick-add-sheet.js|css` loaded
globally, opened by any `[data-quick-add-sheet][aria-controls]`. Outside the drawer it is moved to
`<body>` and rises from the viewport bottom (max-width 48rem, centred).

**Layout + customisable products (user request, same day).** Mobile (< 750px): full-width bottom
sheet; desktop: centred dialog; both on `<body>` above the drawer. Products with any customisation
link to the PDP ("Customise") instead of quick-adding. Which customisations a product has is now one
shared snippet, `snippets/product-customisations.liquid`, used by both the PDP and quick-add, so
new customisations automatically route to the PDP.

**Revised before shipping (same day).** The shared-snippet refactor of `main-product.liquid` was
reverted to keep the PDP byte-identical to production (it briefly broke the Remix price/variant id,
fixed and parity-tested on 12 PDPs, but the tidiness wasn't worth the risk). The PDP keeps its own
logic; `snippets/product-customisations.liquid` is a verbatim copy used only by quick-add, to be kept
in sync by hand. Drift only makes a newly customisable product quick-addable without its service.
