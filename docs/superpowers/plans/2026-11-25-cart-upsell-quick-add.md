# Cart Upsell Quick-Add Sheet Implementation Plan

> Executed natively (superpowers:executing-plans). Spec: `docs/superpowers/specs/2026-11-25-cart-upsell-rules-design.md` (Addendum).

**Goal:** Replace "Choose" in the drawer's "Complete your kit" with "+ Add" that opens an in-drawer option sheet; single-option chips add on tap.

## Global Constraints
- No new files, no new translation keys; no hard-coded English.
- Sheet is `position: fixed` inside `.drawer__inner` (its `transform` makes it the containing block).
- Review Focus: sold-out combinations; shoes with colour+size; add failure restores chip/button text;
  Esc/outside/× close and focus return; drawer re-render while sheet open.

### Task 1: Sheet markup, behaviour, styles
**Files:** `snippets/cart-recommendations.liquid` (multi-variant row), `assets/cart-recommendations.js`
(list-layout click handling + `addToCart` restores the clicked element's own text on error),
`assets/component-cart-drawer.css` (`.cart-upsell__sheet*`, chips), `CLAUDE.md`.

**Interfaces:**
- Row: `<button class="cart-upsell__add" data-sheet-open aria-haspopup="dialog" aria-controls="CartUpsellSheet-<product.id>">`.
- Sheet: `<div id="CartUpsellSheet-<id>" class="cart-upsell__sheet" role="dialog" aria-modal="true" aria-label="<title>" hidden>`
  containing `.cart-upsell__backdrop`, panel, × (`data-sheet-close`), per option a group
  (`data-option-index`) of `<button class="cart-upsell__chip" data-value>`, `<script type="application/json" data-variants>`
  = `[{"id":N,"options":["Black","8 UK"],"available":true}]`, and for 2+ options an
  `.cart-upsell__sheet-add` button.

- [ ] Liquid: render the above for `product.variants.size > 1`; drop the Choose link.
- [ ] JS: open/close (×, Esc, backdrop, focus), chip select, availability disabling, single-option tap → `addToCart`, multi-option Add → `addToCart`.
- [ ] CSS: sheet slides up, backdrop, chips (selected/disabled), reduced motion.
- [ ] Verify: `node --check`; Theme Check (no new offenses); browser on dev preview: grip (colour tap adds), ankle support (size tap adds), Blade Pro (colour+size → Add enabled only when available), Esc/outside close, no console errors.
- [ ] Docs: CLAUDE.md "Complete your kit" bullet.
