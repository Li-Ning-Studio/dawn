# Design system (Swiss, proposal)

Status: design only. No theme code has changed. Tokens below use the `--ds-*` prefix for the build pass.
Source of truth for the current look: the product page (`sections/main-product.liquid`, `assets/section-main-product.css`, `assets/s3-typography.css`).

## Principles

1. Flush left, ragged right. Centre alignment only for icons inside buttons.
2. Hierarchy from size and weight, not colour. Ink steps down in tone before a hue appears.
3. Rules, not boxes. 1px hairlines separate content. Fills, cards and shadows only for surfaces that need lifting (modal, drawer, sticky bar).
4. One grid: 12 columns desktop, 4 mobile. The product page keeps its 70/30 media/info split.
5. Pills are the only curve. Buttons, inputs, selects, variant pills, badges. Everything else is square. Colour swatches are circles.
6. The accent marks one thing at a time. If two accents share a viewport, one becomes ink.

## Type

Figtree (primary face). Note: the repo's `config/settings_data.json` still says DM Sans (`type_body_font`), so the live theme is configured differently; confirm which is authoritative before the build pass. Weights 400 and 600 only. Tracking in em only.

| Role    | Size (px)  | Line height | Weight | Tracking | Case      |
|---------|------------|-------------|--------|----------|-----------|
| display | 40–64 fluid| 1.02        | 600    | -0.04em  |           |
| title   | 24         | 1.2         | 600    | -0.03em  |           |
| heading | 18         | 1.3         | 600    | -0.01em  |           |
| body    | 15         | 1.6         | 400    | 0        |           |
| caption | 12         | 1.4         | 600    | +0.04em  | uppercase |
| micro   | 12         | 1.4         | 400    | 0        | at 70% ink|

- Uppercase is for captions only (eyebrows, badges, field labels).
- Prices, specs, dates and counts use tabular numbers.
- Body measure is 62ch at most.
- Replaces today's 12 font sizes (including 1.525rem and 1.55rem), 4 weights and 4 tracking units.
- A licensed neo-grotesque (Suisse Int'l, Neue Montreal) would change only `--ds-font`.

## Colour

| Token            | Light      | Dark       | Use |
|------------------|------------|------------|-----|
| `--ds-bg`        | `#F7F7F4`  | `#111110`  | Page ground |
| `--ds-panel`     | `#FFFFFF`  | `#1A1A19`  | Modals, drawers, sticky bar |
| `--ds-ink`       | `#141414`  | `#F2F2EE`  | Text, primary button, selected state |
| `--ds-accent`    | `settings.accent_color` (currently `#ffa300`) | same | Fills only |
| `--ds-on-accent` | computed from accent luminance | | Text on accent fills |
| `--ds-ok` / `--ds-err` | `#1F7A4D` / `#C42B2B` | `#55C58A` / `#FF7B7B` | Messages only |

Ink tones replace the 11 alpha steps used today (1, .85, .8, .75, .7, .6, .55, .5, .18, .1, .08):

- 100%: titles, prices, active text
- 70%: body and secondary labels
- 40%: disabled, placeholders, struck prices
- 12%: hairlines (replaces `--border-color #eae4da` and the `.18/.1/.08` rules)

Accent rules: used as a fill (badge, live-campaign button, promo tag), never as small text on the ground (`#ffa300` on `#F7F7F4` is about 1.9:1). Selected states (pill, swatch) use ink, not the accent. Status colours merge the duplicate sets in `base.css:4-6` and `layout/theme.liquid:112-127`.

## Space and grid

Base unit 4px. Steps: `--ds-1` 4, `--ds-2` 8, `--ds-3` 16, `--ds-4` 24, `--ds-5` 32, `--ds-6` 48, `--ds-7` 64, `--ds-8` 96. Gaps come from layout (`gap`), not margins.

- Page width 1200, gutter 16.
- Breakpoints: 750 and 990 only. Fold the 768, 900 and 1500/1501 queries into these.
- Control height 48px for buttons, inputs, selects, pills and quantity. Small button 32px. Replaces 38, 46, 55 and 56px variants.

## Shape

| Shape  | Where |
|--------|-------|
| Pill (999px) | Buttons, inputs, selects, variant pills, badges |
| Square (0)   | Media, modals, drawers, tables, promo strips, footer |
| Circle       | Colour swatches only |

Retire: `--variant-pills-radius: 8px` (unused), the hard-coded `100px` pill radius, the 6px popup radius, 9999px badge radius.

## Components

Live reference: the published style guide artifact (private link shared in chat). Specs:

- **Button**: primary = ink fill, bg text. Secondary = 1px ink outline. Accent = accent fill, one per page, live campaigns only. Disabled = 40% opacity. 48px, 15px/600, padding-inline 24.
- **Text link**: 1px underline, 4px offset, 2px on hover.
- **Field**: caption label above, 48px pill, 1px border at 40% ink, ink on hover/focus, error border + 12px message.
- **Variant pill**: four equal columns, 48px. Selected = ink border + inset 1px + weight 600. Disabled = line-through, 40% ink.
- **Swatch**: 40px circle, 1px 12% border, selected = 2px ink ring at 3px offset. Name shown in the label.
- **Price**: 24/600 now price, struck price at 40% ink, accent discount badge, "incl. taxes" in micro.
- **Add-on row**: title (600) + one-line description at 70% ink, 32px outline "Add" button right, hairline above each row.
- **Info row** (delivery, EMI, warranty): 120px caption column, text column, hairline above.
- **Spec list**: two columns, label at 70% ink, hairline above each row.
- **Accordion / FAQ**: hairline above and below, 600 summary, `+` / `−` indicator in ink, content 14px at 70% ink.
- **Reviews**: distribution as 4px bars on a 12% track; review item separated by a hairline; store reply in micro.
- **Promo strip**: ink ground, 12–13px, one accent tag, square.
- **Header / footer**: wordmark left; category links 14px; footer ink ground, captions at 60%.
- **Focus**: 2px ink outline, 2px offset, everywhere (replaces the four ring recipes).

## Migration order (for the build pass)

1. Tokens: add `assets/ds-tokens.css`; point `--border-color` at the new rule; merge status colours.
2. Type: reduce `assets/s3-typography.css` to the six roles; define or remove `.s3_title--xl/--lg`.
3. Controls: `assets/base.css`, `component-product-variant-picker.css`, `component-swatch-input.css`, quantity.
4. Product page: clear the 9 inline styles in `main-product.liquid` and hex colours in the highlight overlay and inventory text; drop dead commented blocks.
5. Chrome: header, mega-menu (hex and px values), footer, announcement strips.
6. Collection and cart: `snippets/card-product.liquid` (11 inline styles), `snippets/cart-drawer.liquid` (14).
7. Services: `remix`, `tshirt-printing`, `stringing`; remove `!important` font overrides unless a service needs its own face.
8. Home: hero, countdown, collage, studio-text embedded `<style>` blocks.

Also fix in step 1: `layout/theme.liquid:136` builds `--font-heading-*` from the body font, so the heading font setting does nothing; `--page-width-base`, `--popup-corner-radius` and `--variant-pills-radius` override their settings.

## Reference notes

- cowboy.com (read from code only): Suisse Int'l, near-black on warm off-white, one rust accent, a short fixed type scale, identical product cards.
- custo.io (read from code only): PP Neue Montreal, single family.
- Open: which aspects beyond type voice and ground colour to borrow.
