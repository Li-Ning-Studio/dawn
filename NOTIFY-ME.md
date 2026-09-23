# PDP back-in-stock signup

## Enable on each store

Theme settings → **Dev Config → Enable back-in-stock signup** (`notify_me_enabled`).
The default is off. Enable only after the backend requirements below are deployed
and verified for that store. Turning the setting off restores the sold-out button.

The existing **Storefront Public Access Token** (`settings.pat`, exposed as
`window.s3_pat`) supplies the request's `Authorization` header. The theme never
uses the private restock webhook token.

The conditional uses the existing `window.s3_brand`:

| Brand     | Signup endpoint                                     |
| --------- | --------------------------------------------------- |
| `Hundred` | `https://sitemap.hndrd.co/out-of-stock/hndrd`       |
| `Studio`  | `https://sitemap.lining.studio/out-of-stock/studio` |

The theme currently derives that brand flag from the hostname: hosts containing
`hndrd.co` select Hundred; other hosts select Studio. Shopify preview domains and
localhost therefore use Studio. Verify the flag before testing each brand; do
not assume a Hundred preview uses the Hundred API automatically.

## Frontend contract

- Main PDP only, including its mobile sticky button. A selected variant must
  exist, be unavailable for sale, and have a nonempty SKU. Invalid option
  combinations, quantity-rule restrictions on otherwise available variants,
  service products, catalog mode, and quick-add do not gain a signup action.
- Required trimmed name (up to 200 characters) and Indian mobile number. Phone
  input accepts 10 digits with optional `+91`/`91`, spaces, parentheses, or
  hyphens; the request sends 10 digits. Email is optional, trimmed and validated
  when supplied, with a maximum of 200 characters.
- POST with URL-encoded query parameters `name`, `number`, `sku`, and `email`
  only when supplied. No JSON body. `Authorization` contains the public token
  directly, without a `Bearer` prefix. Cookies are omitted.
- Every 2xx response means success, including an already-registered response.
  HTTP 400 JSON `{ "message": "invalid query params", "invalid": ["number"] }`
  can identify `name`, `number`, or `email` field errors. Other failures show a
  generic localized retry message; raw API text is never rendered.
- Requests time out after 15 seconds, with manual retries. A request aborted by
  navigation or a variant change may already have saved on the server; backend
  duplicate detection makes a subsequent retry safe. Late responses cannot
  confirm signup for a different variant.
- Details remain in component memory for correction and retry. They are not
  written to browser storage or logged. Success persists for the current
  variant while that component remains mounted.
- Missing/placeholder tokens, unknown brands, JavaScript failure, or unsupported
  native dialogs leave the existing sold-out control available as the fallback.

## Backend handoff — required before activation

Backend changes are a separate task in `Li-Ning-Studio/shopify-server`.
The repository's `master` source was inspected on 2026-09-23; deployment state
was not verified.

### Signup handler

Source: [src/routes/webhooks/out-of-stock.ts](https://github.com/Li-Ning-Studio/shopify-server/blob/master/src/routes/webhooks/out-of-stock.ts),
mounted at `POST /out-of-stock/:facility` in `src/index.ts`.

1. Allow omitted or empty email. Keep name, number, and SKU required, and validate
   a nonempty email. Store absent email as an empty sheet cell, preserving the
   existing column layout.
2. Prevent duplicates using the same SKU and either a matching normalized phone
   or a **nonempty** matching email. Empty emails must never match unrelated
   customers. Conceptually:
   `sameSku && (samePhone || (email !== '' && sameEmail))`.
3. Give signup its own per-facility public-token configuration, matching each
   store's `settings.pat`. For example, map `hndrd` to
   `STOCK_SIGNUP_TOKEN_HNDRD` and `studio` to `STOCK_SIGNUP_TOKEN_STUDIO`.
   Missing configuration must reject signup. Keep `STOCK_AUTH_TOKEN` private
   and exclusive to `/back-in-stock/:facility`; do not change that secret to a
   public token. A public signup token is not proof of customer identity.
4. Preserve the existing phone normalization (10 digits become `91` plus the
   number), query parameter names, and HTTP 200 responses for `saved` and
   `already registered`.
5. Configure `VALID_URLS` for both storefront domains. Existing CORS code allows
   POST, OPTIONS, and Authorization. Its localhost presets only cover ports
   3000/3001; add the chosen HTTP preview origin (for example,
   `http://127.0.0.1:9292`) explicitly in `getAllowedOrigins` for development.
   The current domain expansion prefixes HTTPS, so adding an HTTP URL to
   `VALID_URLS` alone will not work. OPTIONS must succeed without a signup token.

### Phone-only notifications

Source: [src/routes/back-in-stock/kwikengage.ts](https://github.com/Li-Ning-Studio/shopify-server/blob/master/src/routes/back-in-stock/kwikengage.ts).

The current event uses email for `customer_id`. Adapt customer identification
for requests without email using a KwikEngage-supported phone-based identity.
Provider acceptance of that identity must be verified by the backend owner;
this theme change does not establish it. Confirm an actual test restock alert
reaches a phone-only registration before activation.

## Acceptance checklist

- Test both brand endpoints and the correct public token; do not use live
  customer details in test registrations.
- Check initial sold-out and single-variant pages, direct variant links,
  available/sold-out transitions, rapid option changes, nonexistent combinations,
  missing SKU, and combined-product navigation. Confirm the submitted SKU.
- Check desktop/mobile dialog layout, Escape/close, focus restoration, and
  sticky-button label/action/scroll visibility. Signup must never add to cart or
  invoke customisation validation.
- Test missing name/phone, optional email, invalid email, phone normalization,
  names/SKUs with query-special characters, duplicate clicks, timeout, failed
  requests, server field validation, retries, and closing/reopening while saving.
- Confirm the feature-off and missing-token fallbacks, and existing in-stock
  purchase/customisation flows.
- After backend deployment, make controlled signups with and without email on
  each brand; confirm the sheet row, normalized number, exact SKU, deduplication,
  and successful phone-only restock delivery. Then enable per store.

Static checks: Theme Check and Prettier with the Liquid plugin for touched files.
These checks do not verify deployed CORS, sheet writes, or notification delivery.
