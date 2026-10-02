# Studio Theme README

This document gives new teammates a map of the theme with a focus on the custom services we ship (stringing, knotting, gripping, remix, and T-shirt printing). Keep it close when you are onboarding a new store or chasing a regression in one of the services.

## Getting Started

- Install Node 18+ and pnpm. Log in with `shopify login` before running any CLI commands.
- Pull the latest theme files with `pnpm run pull` (wrap it with the correct `SHOPIFY_FLAG_STORE=<store>.myshopify.com`).
- Start local development via `pnpm dev` or `npm run dev`. Both proxy to `shopify theme dev` and honour `SHOPIFY_FLAG_STORE`.
- Run `npx shopify theme check` before you ship to keep Liquid lint clean.
- Format with `npx prettier --write .` (the repo has `@shopify/prettier-plugin-liquid` configured).
- Preact bundles are built in `reax/`. Run `cd reax && pnpm install && pnpm build` after you touch anything under `reax/src/**`.
- Preact entry filenames stay stable (`vx-tshirt-printing.js`, etc.); shared dependencies use content-hashed filenames (`vx-hooks.module-<hash>.js`). Rebuild all entries together and include every emitted dependency in the theme release.
- The frozen `assets/vx-MultiStepForm.js` comes from `46f50aeb^` and must retain exports `M`, `f`, and `g`. Cached Stringing/Gripping entries from that revision still need the helper exports. Checking against `HEAD` alone misses these older callers; verify both pre-`46f50aeb` and current entry graphs against retained assets. New implementations belong only in hashed chunks.
- Deploy new hashed dependencies before updating entry bundles. Preserve earlier hashed assets and the legacy unversioned chunks: cached pages still import those exact URLs. Do not overwrite legacy chunks with a newer build or delete them during asset cleanup. `emptyOutDir: false` preserves them locally; deployment must retain them too. A hard refresh is not a shopper-facing cache migration strategy.

## Architecture Crash Course

- Theme assets live where Dawn expects them: global layouts in `layout/`, sections in `sections/`, reusable snippets in `snippets/`, translations in `locales/`, and settings in `config/`.
- Service UI is server-rendered by snippets in `snippets/` and hydrated by the matching Preact bundles compiled into `assets/vx-*.js` from `reax/src/components/**`.
- All services write configuration onto `window.s3_*`. `assets/product-form.js` reads those flags when a shopper clicks "Add to cart" and adds the right mix of main product, service variants, and accessory SKUs in one bundle.
- Shared styles for service cards live in `assets/services.css`. Tweak in there rather than touching base Dawn CSS.

## Services Deep Dive

### BXGY automatic gifts

The theme adds gift merchandise; Shopify's native automatic Buy X Get Y discount
sets its price. Gifts remain independent cart lines that shoppers can edit or
remove. Editing the purchased product later does not synchronise its gifts.

**Shopify setup**

- Keep the existing `buy_x_get_y` metaobject fields: `offer_name`,
  `trigger_collection` (one collection reference), and `free_product` (one product
  reference). Make `free_product` optional if the definition currently requires it.
- Add optional `free_collection` with type **Collection**, accepting **one value**
  (`collection_reference`). Preserve the definition's storefront read access.
- `free_product` takes priority whenever populated, including when it is sold out.
  Clear it to use `free_collection`; the sources are never combined. The first
  matching offer still wins if trigger collections overlap.
- Use a dedicated manual gift collection. Its products and the trigger collection
  must be available to the Online Store. Empty collections add nothing. The theme
  checks the complete product count and omits the gift set if Liquid returns only
  part of it; keep gift collections at 50 products or fewer.
- Configure a matching native automatic discount: buy one qualifying product and
  get one item from `free_product`, or N items from `free_collection`, free. N is
  the collection's product count when the full set is available. Enable repeat
  applications per order for multiple qualifying units. Changing collection
  membership or skipping sold-out gifts does not update this quantity. The theme
  keeps successfully added gifts even if Shopify leaves them chargeable.
- Align native discount dates, customer/market eligibility and combinations with
  the offer's storefront availability. The theme does not read discount settings
  or enforce free prices. A scheduled, expired or inapplicable discount can leave
  auto-added merchandise chargeable. Disable the metaobject entry when its offer
  should stop auto-adding gifts.

**Addition and stock handling**

The theme selects each product's first available variant and adds one of each gift
per purchased unit in that submission. Customised purchases still use their
existing quantity of one. Products with no available variant are skipped; the
remaining gifts are still added. If every gift is sold out, only the purchased
product is added. A sold-out `free_product` does not fall back to the collection.

Purchased products and required customisations are added and validated first;
gifts are then added individually in sequential requests. Each gift is attempted
once. A failed or partially fulfilled request triggers a cart read before moving
on to the next gift, preserving any units successfully added. The paid purchase
and failed gift requests are never resent. If the cart cannot be read, remaining
attempts stop and the theme makes one read-only refresh to open the updated cart
drawer or notification. Unconfirmed gifts do not show a review message or cause a
redirect. If the refresh also fails, the theme leaves the current page in place
without rendering stale cart sections.

The final cart sections are refreshed after gift processing. Skipped or partially
added gifts produce a notice, without removing successful gifts or checking their
prices. Existing cart lines remain untouched. Notices persist across page navigation
for up to five minutes, or until the next add-to-cart submission.

`snippets/bxgy-offers.liquid` prepares the offer data, `assets/bxgy.js` manages gift
selection/recovery, and `assets/product-form.js` sequences the requests. This
covers the existing product-form flow, not bulk order controls or accelerated
checkout buttons. Run `node --test tests/bxgy.test.cjs` for request-flow coverage.
Before activating a collection offer, verify its metaobject and native discount
together on staging: quantities 1 and 2, stock failures, cart edits, customisations
and the final checkout prices. The metaobject definition and discount changes are
Shopify Admin setup; deploying theme files alone does not create them.

### Stringing and Knotting

**What shoppers see**

Customers pick "Pro Stringing" on eligible rackets, choose a string, colour, tension, and optionally upgrade to four-knot stringing. The UI is rendered by `snippets/stringing.liquid` and hydrated by `reax/src/components/stringing` (compiled to `assets/vx-stringing.js`).

**Toggle switches**

- `settings.is_stringing_enabled_globally` must be true.
- The product needs metafield `custom_but_hidden.studio_pro_stringing` (boolean or enum). Value `strung` makes the "factory strung" copy render.
- Set `settings.stringing_collection_id` to the numeric Shopify collection id that holds string SKUs (the code wraps it in `gid://shopify/Collection/<id>` before querying). Optional: `settings.tennis_stringing_collection_id` if you mirror the feature for tennis.
- Enable `settings.is_knotting_enabled_globally` to surface the 2-knot vs 4-knot choice.

**Shopify data to create**

- Hidden service products:
  - Handle `studio-pro-stringing` (contains the paid service variant).
  - Handle `studio-four-knots-service` (upsell when a customer selects four knots).
- Collection of string products linked to `settings.stringing_collection_id`.
- Each string product needs:
  - `Metafields > custom > durability | control | repulsion_power | hitting_sound | shock_absorption` with numeric values (out of 10) used for filtering and charts.
  - `Metafield custom_but_hidden.short_description` (displayed under the title).
  - `Metafield custom_but_hidden.product_tag` (optional badge).
  - Option 1 colour values with swatches enabled so the UI pulls the hex from `optionValues[].swatch.color`.
- On the racket itself, set `Metafield custom.maximum_racket_tension` so the tension picker hides options above the safe limit.

**How it adds to cart**

1. `snippets/stringing.liquid` exposes the service variant ids via `window.s3_stringing_service_variant_id` and `window.s3_four_knots_service_variant_id`.
2. When the shopper submits the form, `assets/product-form.js` looks for checked inputs named `string-variant`, `string-tension`, and `knot-config` and adds:

   - the stringing service variant,
   - the selected string variant,
   - and (if four knots selected) the four-knot service variant.

   The racket is added first, and each service or add-on uses Shopify's native `parent_id` relationship so the cart, checkout, and order keep the customisation grouped.

**New store checklist**

- Create the two hidden service products with the exact handles listed above.
- Ensure every racket that should offer stringing has the `studio_pro_stringing` metafield populated and a `maximum_racket_tension` value.
- Populate the string collection and map its numeric id into theme settings.
- Flip on the stringing and knotting checkboxes in theme settings once products, collections, and metafields are in place.
- Translate copy under `locales/en.default.json > studio.stringing.*` (duplicate keys were intentional; keep them synced if you localise).

### Gripping

**What shoppers see**

Eligible rackets surface a "Gripping Service" card. Customers can keep the factory grip or pick from curated aftermarket grips. Hydration comes from `reax/src/components/gripping` compiled to `assets/vx-gripping.js`.

**Toggle switches**

- `settings.is_gripping_enabled_globally` must be true.
- Product metafield `custom_but_hidden.studio_grip_service` must be set.
- `settings.gripping_collection_id` points to the collection of grip SKUs.
- Optional `settings.factory_grip_image` adds the marketing image for the "no grip" option.

**Shopify data to create**

- Hidden service product with handle `studio-gripping-service`.
- Collection of grip products referenced by `settings.gripping_collection_id`.
- Each grip product uses:
  - `custom_but_hidden.short_description` for the UI blurb.
  - Colour swatches on option values so the picker can render circles.

**How it adds to cart**

- `snippets/gripping.liquid` emits `window.s3_gripping_service_variant_id` and a hidden input `#selected-grip-variant-id` that keeps the chosen variant id and sku.
- `assets/product-form.js` checks that hidden field and adds both the service variant and the selected grip variant as child lines of the racket.

**New store checklist**

- Build the grip collection, note its numeric id, and drop it into theme settings.
- Create the `studio-gripping-service` product and lock it from storefront visibility.
- Confirm product metafields and translations `studio.gripping.*` exist.

### Remix (3D Customisation)

**What shoppers see**

Racket, paddle, or bag products with the Remix flag render a "Personalise" line item. Clicking loads a Radix modal powered by `reax/src/components/remix` (`assets/vx-remix.js`) that overlays a 3D model with editable decals.

**Toggle switches**

- `settings.is_remix_enabled_globally` must be true.
- Product metafield `custom_but_hidden.stickers` must be truthy.
- The selected variant needs metafield `custom_but_hidden.rmx_3d_model` pointing to a media item or metaobject whose `name` matches an asset `assets/rmx-<name>.glb`.

**Shopify data to create**

- Hidden service products:
  - Handle `remix` for rackets.
  - Handle `paddle-remix` for pickleball paddles.
  - Handle `bag-remix` for products whose Shopify product type is exactly `Badminton Kitbags`.
- Variant-level metafields used to skin the configurator:
  - `rmx_racket_frame_color`
  - `rmx_racket_grip_color`
  - `rmx_logo_color`
  - `rmx_sticker_text_color`
- Optional: upload matching `mono3.ttf` and `SpaceMono-Regular.ttf` (already in assets) if you replicate on a new store.

**How it adds to cart**

- `sections/main-product.liquid` resolves the service product by product type, and `snippets/remix.liquid` writes its first variant id to `window.s3_remix_service_variant_id`.
- The Preact app exposes `window.s3_remix_modal_controller.openModal()` so the Liquid label can open the modal.
- `assets/product-form.js` looks for the rendered `#the-sticker` element and adds the correct remix service variant with encoded sticker text.

**New store checklist**

- Upload the `.glb` models to `assets/` with the `rmx-<name>.glb` naming scheme.
- Populate the remix service products and hide them from the storefront.
- Configure variant metafields for colours and set the `stickers` metafield on eligible products.
- Translate copy under `locales/en.default.json > studio.remix.*` if you localise.

### T-Shirt Printing

**What shoppers see**

Apparel flagged for personalisation shows a "Make this T-Shirt yours" option. The modal (from `reax/src/components/tshirt-printing`, compiled to `assets/vx-tshirt-printing.js`) lets customers preview up to 12 letters, periods, or spaces on a render of the product colourway. The feature-flagged upgrade adds a country and included brand logo. Its selector defaults to India and also offers Indonesia, China, Japan, Malaysia, and Denmark. Printed country names stay uppercase English while selector labels are translated.

**Toggle switches**

- `settings.is_tshirt_printing_enabled_globally` must be true.
- Product metafield `custom_but_hidden.customise` must be truthy.
- The optional second line requires the `theme_feature_flag` metaobject entry with handle `tshirt-printing-second-line` and its `enabled` boolean set to true. A missing flag or missing plus service variant keeps the original one-line experience.
- The independent `tshirt-printing-materials` entry in that same definition enables Standard, Gold, Hologram, Reflective and Rose Gold swatches on all printing-eligible shirts. Standard remains the default and uses the existing variant colour metafields. When materials are enabled, country/logo availability uses the selected finish's Plus service, not the Standard Plus service. The second-line flag still controls whether country/logo can be added at all.

**Shopify data to create**

- Hidden service product handle `t-shirt-printing`.
- Unlisted two-line service product with handle `t-shirt-printing-plus` and variant SKU `T-SHIRT-PRINTING-PLUS` (SKU matching is case-insensitive).
- Variant metafields to drive the preview:
  - `tpr_t_shirt_color` (hex) for the garment fill.
  - `tpr_text_color` (hex) for the printed text.
- Optional texture asset `tshirt-texture.png` already lives in `assets/`; swap if the illustration changes.
- `BarlowCondensed-SemiBold.ttf` supplies the enhanced preview font (license below). Both lines have equal cap heights; the SVG composition scales to the shirt and shrinks together for long text. Its dimensions are illustrative, not physical print measurements.
- Supply transparent `lining-logo.svg` and `hndrd-logo.svg` assets. `window.s3_brand` resolves `Studio` to logo identifier `lining` and `Hundred` to `hndrd`. The included logo appears beneath the country in the same color as the text. Unknown brands or failed logo loads block applying the upgrade, while name-only printing remains usable.

**How it adds to cart**

- `snippets/tshirt-printing.liquid` sets `window.s3_tshirt_printing_service_variant_id` and loads the module lazily.
- The Preact modal sets `#the-tshirt-text` and, when applied, `#the-tshirt-second-line` with the applied logo identifier in `data-logo-id`. `assets/product-form.js` adds either the original service or `t-shirt-printing-plus`, never both. The uppercase country is sent as `_tshirtSecondLine`, with `_tshirtLogo` set to `lining` or `hndrd`; both use `_textColor`. Name-only items omit the country and logo properties.
- The country cross removes the country/logo draft and preserves the name. Apply commits the new package; discard restores the previous package. The bottom Remove button clears all printing. Re-adding the country defaults to India.
- Complete desktop/mobile visual checks with both actual logos before rollout.

**Optional print finishes**

- Resolve these eight additional product handles and their matching variant SKUs (case-insensitive): `t-shirt-printing-gold`, `t-shirt-printing-hologram`, `t-shirt-printing-reflective`, `t-shirt-printing-rose-gold`, and the corresponding `t-shirt-printing-plus-gold`, `t-shirt-printing-plus-hologram`, `t-shirt-printing-plus-reflective`, `t-shirt-printing-plus-rose-gold`. They must be resolvable by the Online Store theme and purchasable. A missing, mismatched or unavailable variant disables only that finish/package; it never substitutes Standard.
- Reuse the existing `theme_feature_flag` definition (display name plus boolean field `enabled`, storefront access enabled). Create an **Active** entry named "T-shirt printing materials", handle **`tshirt-printing-materials`**, initially with **Enabled = false**. Liquid reads `metaobjects.theme_feature_flag['tshirt-printing-materials'].enabled.value`; a missing entry or false value preserves the current flow.
- The selected finish applies to name, country and included logo together. Static gradients approximate the supplied material samples; they do not promise physical reflective or holographic behaviour. Existing print dimensions, country list and logo mapping are unchanged.
- Swatches show the selected package's total service price, read from Shopify. The country/logo link shows that finish's Plus-minus-single difference. Non-positive prices or upgrade differences display the translated FREE label; no MRP or fixed rupee amount drives the charge.
- Exactly one printing service variant is added, replacing the Standard service. Material-aware selections include `_tshirtMaterial` (`standard`, `gold`, `hologram`, `reflective`, `rose-gold`). Standard keeps the existing `_textColor`; specialty orders use `GOLD`, `HOLOGRAM`, `REFLECTIVE`, or `ROSE GOLD`. Name, country, logo, SKU, native parent relationship and rollback contracts are retained. Legacy modals omit `_tshirtMaterial` and still resolve Standard.
- Finish changes are drafts until Apply; Discard restores the committed finish. Removing country/logo retains the finish, while removing personalisation resets Standard. A package change that leaves an unavailable finish selected blocks Apply until the shopper explicitly chooses an available combination.
- The modal only exposes finishes when the current PDP's `product-form` advertises `supportsTshirtMaterials`. This prevents a newly loaded modal paired with a cached old form from ordering the wrong service. Keep legacy globals and all retained Preact dependency chunks; deploy new dependencies before changed entries.
- With the flag enabled, printing resolves ten unique product handles (two Standard plus eight specialty). Audit other page features against Shopify's 20-unique-handle `all_products` limit before extending this list.
- Before enabling, test all ten finish/package combinations, both independent flags, missing/unavailable services, FREE price variations, Apply/Discard/Remove, shirt variant changes, cached/new scripts, mobile/desktop previews and real cart/checkout/order properties. An unpublished theme still shares Shopify product and inventory data. Turning this flag off hides the new selector; existing cart/order service lines are not rewritten.

**New store checklist**

- Keep the `t-shirt-printing` product active and directly resolvable by the Online Store theme.
- Create the `t-shirt-printing-plus` product with variant SKU `T-SHIRT-PRINTING-PLUS` (any letter case is accepted). Set its product status to **Unlisted** so Liquid can resolve it without surfacing it in search or recommendations.
- Make the plus variant purchasable before enabling the feature: give it inventory, continue selling when out of stock, or disable inventory tracking. The theme deliberately keeps the one-line experience when this variant is unavailable.
- Create the reusable `theme_feature_flag` definition with a display-name field and an `enabled` boolean, then create the `tshirt-printing-second-line` entry. Its definition type must be exactly `theme_feature_flag`, its boolean field key must be exactly `enabled`, and the entry must be active. Keep it disabled until the product, font, and theme code are deployed.
- Populate variant metafields for every colourway.
- Confirm the product carries the `customise` metafield toggle.
- Update translations under `locales/en.default.json > studio.tshirt_printing.*` when localising.

## New Store Launch Checklist

1. Create all hidden service products with handles:

   - `studio-pro-stringing`
   - `studio-four-knots-service`
   - `studio-gripping-service`
   - `remix`
   - `paddle-remix`
   - `t-shirt-printing`
   - `t-shirt-printing-plus`

   Keep them in the "Services" product type. Products resolved through `all_products` must remain active and directly accessible; use Shopify's **Unlisted** product status when they should stay out of search and recommendations.

2. Build the collections referenced by theme settings and capture their numeric ids (Shopify Admin -> open the collection -> copy the number at the end of the URL).
3. Configure theme settings under "Product Customisations" (toggle checkboxes, paste collection ids, upload optional factory grip image).
4. Create and assign product metafields:
   - Booleans for `studio_pro_stringing`, `studio_grip_service`, `stickers`, `customise`.
   - Numbers for `maximum_racket_tension`.
   - Variant-level colour metafields listed above.
   - String product metric metafields under `custom` namespace.
5. Upload supporting assets (`rmx-*.glb`, optional textures) into `assets/`.
6. Verify translations exist in `locales/en.default.json` for the `studio.*` namespaces. Duplicated English strings are placeholders-replace them with store-specific copy or locales.
7. Run through the CX journey in `shopify theme dev`: select each service, add to cart, and confirm `cart.js` shows the racket as the parent with its service and add-on child lines.

## Key Paths Reference

- Theme snippets: `snippets/stringing.liquid`, `snippets/gripping.liquid`, `snippets/remix.liquid`, `snippets/tshirt-printing.liquid`.
- Service scripts: `assets/vx-stringing.js`, `assets/vx-gripping.js`, `assets/vx-remix.js`, `assets/vx-tshirt-printing.js` (source in `reax/src/components/**`).
- Cart orchestration: `assets/product-form.js`.
- Shared styles: `assets/services.css`.
- Theme settings: `config/settings_schema.json` ("Product Customisations" group) and defaults in `config/settings_data.json`.
- Translation keys: `locales/en.default.json` under the `studio.*` namespace buckets.

## Validation Tips

- Always rebuild the Preact bundles (`cd reax && pnpm build`) before you push service changes, otherwise Shopify will still serve the previous `assets/vx-*.js` files.
- Use the browser console to inspect `window.s3_*` coverage if a bundle fails-missing values usually point to misconfigured handles or metafields.
- If a collection id is wrong, the Preact fetch falls back to the "empty" translation and logs to console; keep DevTools open while testing.
- Theme Check will not catch missing metafields, so keep this README's checklist handy when onboarding a new store.

Welcome aboard-reach out in #dev-themes if any of these flows diverge from what you see locally.
