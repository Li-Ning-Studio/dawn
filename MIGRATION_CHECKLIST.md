# Dawn -> Horizon Migration Checklist

This checklist is tailored to `/home/prnx/Documents/projects/dawn`. It includes all Preact-backed features and customizations discovered in the repo.

## Inventory & baseline

- Back up the current Dawn theme and settings from Shopify Admin.
- Confirm all Preact features are required in Horizon:
  - Stringing, S-Plus, Remix, T-Shirt Printing, Gripping, Track page.

## Templates & special views

- Migrate `templates/page.track.json` and ensure `#track-root` is present.
- Copy `templates/product.recent-card.liquid` because `assets/recently-viewed.js` depends on it.
- Recreate `templates/*.json` in Horizon where section type names differ.

## Sections to port or re-create

- Custom/modified sections to review and port as needed:
  - `sections/hero-component.liquid`
  - `sections/hero-video-component.liquid`
  - `sections/responsive-slideshow.liquid`
  - `sections/countdown-timer.liquid`
  - `sections/swipeable-products.liquid`
- Recs slider sections (keep slider markup consistent):
  - `sections/related-products.liquid`
  - `sections/pairs-well-with.liquid`
  - `sections/recently-viewed.liquid`

## Snippets & business logic

- Product customization snippets:
  - `snippets/stringing.liquid`
  - `snippets/gripping.liquid`
  - `snippets/remix.liquid`
  - `snippets/tshirt-printing.liquid`
  - `snippets/s-plus.liquid`
- Variant config hooks:
  - `snippets/product-variant-options.liquid`
  - `snippets/product-variant-picker.liquid`
- Eligibility logic:
  - `snippets/buy-buttons.liquid` uses product metafields to gate stringing/remix.
- Payments/integrations:
  - `snippets/gokwik.liquid`
  - `snippets/gokwik-sdk.liquid`
  - `snippets/gokwik-checkout-button.liquid`
  - `snippets/gokwik-buy-now.liquid`
  - `snippets/snapmint-widget.liquid` if still required.

## Settings & data

- Copy custom settings from `config/settings_schema.json`:
  - Product Customisations (stringing, gripping, remix, tshirt printing, knotting)
  - Gokwik Settings
  - D2C Support Settings
  - Dev Config
- Re-enter or migrate values from `config/settings_data.json`:
  - Global feature toggles
  - Collection IDs
  - Tokens and identifiers
- Validate `config/markets.json` compatibility with Horizon.

## Metafields & data dependencies

- Confirm Horizon uses the same metafield keys referenced in snippets:
  - `product.metafields.custom_but_hidden.*`
  - `product.metafields.custom.*`
  - `product.metafields.descriptors.*`
- Ensure service collections exist and are wired:
  - `settings.stringing_collection_id`
  - `settings.tennis_stringing_collection_id`
  - `settings.gripping_collection_id`

## Preact (reax -> assets) migration

- Build and move Preact bundles and shared modules:
  - Feature bundles: `assets/vx-stringing.js`, `assets/vx-splus.js`, `assets/vx-remix.js`,
    `assets/vx-tshirt-printing.js`, `assets/vx-gripping.js`, `assets/vx-track.js`
  - Shared modules: `assets/vx-index.js`, `assets/vx-hooks.module.js`,
    `assets/vx-compat.module.js`, `assets/vx-shopify-client.js`, `assets/vx-utils.js`
- Keep mount points stable across templates/snippets:
  - `stringing-root`, `splus-root`, `remix-modal`, `tshirt-printing-modal`,
    `gripping-root`, `track-root`
- Keep Liquid lazy-load patterns intact where they inject `vx-*.js` on demand.

## CSS & assets

- Carry over custom CSS:
  - `assets/recs-slider.css`
  - `assets/recently-viewed.js`
  - `assets/services.css`
  - `assets/mask-blobs.css`
- Include required fonts:
  - `assets/seguibl.ttf`, `assets/mono3.ttf`, `assets/SpaceMono-Regular.ttf`
- Move service/media assets used by custom features:
  - `assets/rmx-*.glb` models and any related images/icons.

## Layout & global hooks

- Reapply any custom `layout/theme.liquid` logic (Gokwik includes and global scripts).
- Ensure cart surfaces keep Gokwik hooks:
  - `snippets/cart-drawer.liquid`
  - `sections/main-cart-footer.liquid`

## Translations

- Keep `locales/*.json` keys aligned with custom features:
  - `studio.*` keys for stringing/gripping/remix
  - track and customer order strings

## QA after migration

- Core flows: home, collection, product, cart, checkout link, search, account.
- Feature flows: stringing/gripping/remix/t-shirt printing, S-Plus options,
  track page, recently viewed, related/complementary sliders, Gokwik checkout.
- Theme editor: all sections/blocks render with valid settings.
