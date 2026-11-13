# Racket finder

The finder is a theme-only consultation for full-length badminton rackets. Four required questions collect experience, current style, desired benefit and maximum budget. Weight is an optional refinement after results. There is no backend, AI service, contact capture or saved-shortlist link. Device storage retains answers, not prices or products.

## Ownership and setup

| Content                                                                                                           | Source                                                |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Questions, placement/layout, answer IDs, personality mapping, scoring weights and budgets                         | `reax/src/components/racket-finder/config.ts`         |
| Interface and personality copy                                                                                    | `locales/en.default.json` and storefront translations |
| Heading, introduction, supporting copy, personality image URLs, browse collection, result count and reveal toggle | Racket finder section settings                        |
| Eligible products, model groups, reviewed specifications, playing strengths and player levels and considerations  | Shopify `racket_finder_profile` entries               |
| Prices, availability, images and names                                                                            | Locale-aware Shopify Ajax product requests            |

Create a Shopify page and assign `page.racket-finder`. Theme code does not create the Page or profile definitions. The existing profile definition must be storefront-readable and publishable. No Settings metaobject, campaign selection or rules override is used. An old `?campaign=` parameter has no effect.

Choose **Browse collection** in the Racket finder section settings to control the browse link below results. Liquid passes the selected collection's URL to the finder; JavaScript does not construct a collection path. If no collection is selected or it no longer resolves, the link is hidden. The supplied page template selects `badminton-rackets`; existing store templates need the picker set if they do not receive that template update. This destination does not change recommendation eligibility or ranking.

Collection-picker verification (2026-11-05): 56 tests, TypeScript, formatting and the shared build passed. Shopify CLI Theme Check reported no findings in the changed theme files; 19 unrelated files retained findings. The skill validator could not start because its dependency was missing. The bundle was rebuilt locally; theme-editor/browser verification and store deployment remain unperformed for this change.

Liquid serializes section result count, personality image URLs, profile completeness and enabled profiles. The browser uses the same typed flow definitions as tests. Liquid renders translated, HTML-escaped `data-message-*` attributes on the finder section; `index.tsx` reads its dataset into the existing messages dictionary; merchant considerations are rendered directly as plain text. There are no synthetic translation keys or separate question-copy overrides. Weight guidance uses `racket_finder.handling_help`.

`config.ts` contains the shared data types and quiz definitions. `index.tsx` validates and combines the Liquid profile payload with those definitions before mounting the finder. Tests compile this entry in memory using the existing Vite dependency to retain profile-loading coverage without a separate loader module.

File consolidation verification (2026-11-07): all 58 tests, the locale bridge, TypeScript and the shared production build passed. Quiz configuration matched the pre-consolidation snapshot exactly, and every generated JavaScript asset was byte-for-byte identical to the existing assets. No storefront behaviour or store data changed.

The complete profile feed supports at most 250 active records (including disabled records). A truncated feed fails closed; archive old records as Draft or implement pagination before exceeding that limit. Invalid profiles or missing payloads show the translated error; there is no test-catalogue fallback. Result count must be 1–3. Optional flex and balance may be missing, but unsupported nonblank values are rejected.

### Changing questions and personalities

Each question in `config.ts` declares `placement: 'quiz' | 'refinement'` and `layout: 'rows' | 'compact'`. Quiz questions are required and follow array order; refinements appear on results, use their own title/help and do not advance the quiz. An optional `defaultOption` displays a refinement's neutral choice without saving or scoring an invented answer. Keep its meaning neutral, as with weight's No preference. Presentation no longer depends on question IDs.

To add an informational question, add its definition/options with `weight: 0`, set placement/layout and add locale strings; add matching `data-message-*` attributes in `sections/racket-finder.liquid` and run the finder checks. Adding a question to the quiz makes it required. New matching effects still need explicit engine rules, explanations and tests: presentation metadata is not a scoring framework. Keep existing answer IDs stable, and bump `version` only when their meanings become incompatible. Adding a question or removing an option can keep the version; valid saved answers survive and the quiz resumes at the first gap.

Each personality definition owns its copy keys. Its image URL comes from the Racket finder section’s Personality images settings. Downloads save that same image without a separate generated design. The separate `exploration` presentation owns the unsure-result copy; it is not a sixth personality. `personalityQuestion` names the question whose selected option determines personality; the shipped value is `style`. Artwork changes apply to both the displayed card and its download.

### Editing personality artwork

Open the theme editor, choose the `racket-finder` page template, and open **Racket finder → Personality images**. Each of the five personalities has a URL field, not an image picker. Paste a direct HTTPS image URL from your external host. The selected URL supplies both the result artwork and its download; no JavaScript rebuild is needed for later URL changes. The host must allow cross-origin image fetching for downloads. If it does not, display can still work but downloading shows the existing error message.

The page template is prefilled with the existing five URLs. Existing store templates that do not receive this template update need these fields filled in manually. Blank, missing or non-HTTPS values hide that personality’s image and download button, while preserving its text, saved answers and recommendations. There is no hardcoded artwork fallback. Unsure results still have no image or download. Internal setting IDs retain `comeback_kid` and `wild_card`, with editor labels The Counterpuncher and All-Court Ace.

## Matching behaviour

This section describes the implemented fixed flow as of 2026-11-02. Profile facts, playing strengths and player levels are editorial inputs. The staging migration and its verification are recorded below; these checks do not independently reverify the underlying product claims.

### Questions and personality

All experience levels answer the same four questions, with no branches. Unknown answer IDs and removed fields are discarded. Incomplete core answers cannot produce recommendations.

Selecting a quiz answer advances automatically after the same 320 ms selection pause as stringing. Questions fade out and move down 8 px over 180 ms, then the next question fades in using the same duration and ease curve. Next and Back use the same transition without the selection pause. Reduced motion skips the pause and animation. Selecting a budget opens results using that new answer. Back retains previous selections, and selecting the same answer again also advances. Rapid selections replace the pending advance; navigation cancels it, and controls are disabled during the outgoing fade to prevent skipped steps. Timers are cleared on unmount. The Next button remains available for retained answers. Keyboard activation follows the same flow, with focus moving to the next heading. Weight refinement updates results in place without advancing or completing the quiz again.

Question transitions are local to `Finder.tsx`: `answering → waiting → leaving → answering`. A small reducer accepts replacement destinations while waiting and rejects extra navigation while leaving. Next/Back skip waiting; reduced motion cancels the transition and navigates immediately. One layout-effect timer owns the current phase and is cleaned up when that phase is replaced or the finder unmounts. No state-machine dependency or extra runtime file is required.

| Question          | Matching effect                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| Experience        | Up to 1 point; beginners can activate a verified-flex tie-breaker             |
| Current style     | Up to 4 points; directly selects personality and supported balance preference |
| Desired benefit   | Required, but contributes no score or personality selection                   |
| Budget            | Hard maximum in integer paise                                                 |
| Weight refinement | Exact class filter; no points                                                 |

Style maps directly: attack → Smash Merchant; speed → Speed Demon; control → Court Chessmaster; counter → The Counterpuncher; adapt → All-Court Ace. Internal IDs remain `comeback-kid` and `wild-card` for the renamed personalities. Unsure, missing or invalid style answers return no personality (`identify()` returns `null`); incomplete answers still cannot produce recommendations. There is no personality voting or tie-resolution algorithm. Experience, benefit, budget and weight do not change identity.

Named results introduce their heading with “Your game leans towards…”. Unsure results show “Finding your court style”, existing exploratory copy and the neutral note, with no illustration or named-personality introduction. Named results with an image URL offer Download my card, which fetches and saves the displayed artwork using its image format. Unsure results have no artwork and do not show a download button. Download failures show the existing translated retry message; a successful download does not navigate away from the shortlist. The supplied page template retains the current artwork URLs as editable settings. Saved answers keep version `3.0.0`; an existing unsure session now opens the exploratory result without losing its answers.

### Eligibility and primary score

Execution order:

1. Clean answers and require all four core answers.
2. Exclude disabled profiles, wrong weight classes, missing live products and selling-plan-only products.
3. Select each product's cheapest available, non-subscription variant within budget; equal-price variants use ascending variant ID. Invalid or negative prices are excluded.
4. Score matching playing strengths and player levels.
5. Refine primary-score ties using verified specifications where coverage is complete.
6. Sort by primary score, specification score, higher product price, then stable handle.
7. Keep the first candidate per model group and return up to the section result count.

Budget is inclusive: ₹5,000 qualifies for a ₹5,000 maximum; ₹5,000.01 does not. Unlimited imposes no price ceiling. The budget is never expanded to fill results. INR budgets are not applied to another currency: personality remains visible with a currency explanation.

For style and experience only:

```text
question contribution = question weight × matched answer tags / selected answer tag count
primary score = style contribution + experience contribution
```

| Style   | Tags                  | Points per matching tag |
| ------- | --------------------- | ----------------------- |
| Attack  | power                 | 4                       |
| Speed   | speed                 | 4                       |
| Control | control               | 4                       |
| Counter | speed, control        | 2                       |
| Adapt   | power, speed, control | 4/3                     |
| Unsure  | none                  | 0                       |

Beginner matches `beginner`, Intermediate matches `intermediate`, and Advanced matches `advanced`, each for 1 point. Strengths and levels are separate lists; duplicate choices earn nothing. The saved answer IDs remain `new`, `developing` and `experienced`. No rounding or penalties are applied. Experience is a preference, not an exclusion. An eligible zero-score product can appear if few stronger candidates qualify; scores are relative editorial fit, not calibrated performance ratings.

Weight choices map to exact reviewed classes: Lighter → 5U, Middle → 4U, Heavier → 3U; No preference applies no restriction. A selected 3U can never return a 4U substitute. Empty selections suggest changing weight or budget. Duplicate lowercase weight tags are ignored and need no migration. A selected weight produces an explanation from the reviewed class even if its old matching tag is absent.

### Specification ties

Specifications never override a stronger primary score. Within each group of equal primary scores:

- Balance adds 0.5 for Head Heavy with attack, Head Light with speed, Even Balanced with adaptable style, or Head Light/Even Balanced with counter. Control and unsure imply no balance preference.
- Beginners receive 0.25 for Flexible or Medium shafts. Intermediate/Advanced do not imply a shaft preference.
- Each attribute is used only if every eligible candidate in that primary-score group has its verified value. Missing balance skips balance for that group; complete flex may still contribute, and vice versa. Coverage is checked after budget, stock and weight eligibility.

Example: two Intermediate attacking candidates with strength `power` and level `intermediate` both score 5. If one has unknown balance, neither earns a balance bonus. With equal specification scores, the higher-priced candidate wins. If both balances are verified and only one is Head Heavy, that candidate wins before the price tie-breaker. These examples describe rules, not live product evidence.

Separate weight products share a model group, preventing duplicate models. The cheapest qualifying variant is selected within each product; the higher-price tie-breaker applies between equally suitable products. Results can be shorter than the configured limit.

### Explanations and specifications

Explanations follow style, selected weight, then experience priority, displaying at most two. Desired benefit never supplies a reason. Consideration text is maintained in the product profile and rendered as text, not HTML.

Cards show reviewed weight, shaft flex and balance on categorical scales. Missing optional specifications say Not verified and have no marker. The finder does not infer grams, grip size, tension or specifications from names. Scale intervals are categories, not measured performance differences.

## New launches

1. Publish the product to the Online Store.
2. Create a Racket profile referencing the exact product.
3. Set a model group shared by its weight versions, reviewed weight class, playing strengths, suitable levels and buying guidance. Optionally record Product URL and the actual review date. Add flex/balance only when verified for that product.
4. Enable the profile and publish it as Active. It joins on the next page load without a theme rebuild.
5. Check relevant answers, budgets and product links in preview. Disable or draft the profile to remove it.

Use the field reference, exact suitability vocabulary and consideration-writing guide below when creating entries. Fixtures are test data and never enter production recommendations.

## Racket-profile field reference

The fields below describe the current theme contract. Keep keys stable even when editor-facing labels change. All choice values are exact and case-sensitive.

| Field (key)                              | Requirement and purpose                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal name (`name`)                   | Required Admin label, such as Example model — 4U. Not used for ranking.                                                                                        |
| Product (`product`)                      | Required reference to the exact product. One enabled profile per product handle. Live price, stock, image and title come from this product.                    |
| Model group (`model`)                    | Required nonblank group shared by weight versions. Use stable lowercase kebab-case, e.g. example-model. Results show one version per group.                    |
| Weight class (`weight_class`)            | Required: `2U`, `3U`, `4U`, `5U`, `6U`, `7U`, `8U`. Refinements select exactly 3U, 4U or 5U. Never infer from a title.                                         |
| Playing strengths (`playing_strengths`)  | Required nonempty list of `power`, `speed`, `control`. Multiple choices allowed when supported by reviewed evidence.                                           |
| Suitable player levels (`player_levels`) | Required nonempty list of `beginner`, `intermediate`, `advanced`. Multiple choices allowed. Each matching level earns one point.                               |
| Buying guidance (`consideration`)        | Required customer-facing plain text. Does not affect ranking; follow the writing guide below.                                                                  |
| Product URL (`evidence_url`)             | Optional editorial product-page link. Existing key and URLs are preserved. Product reference, not this URL, controls customer links. Omitted from finder JSON. |
| Reviewed on (`reviewed_on`)              | Optional actual date evidence was checked. No automatic expiration or score. Migration and copy edits do not renew the review. Omitted from finder JSON.       |
| Review notes (`review_notes`)            | Optional internal explanation and supporting evidence for editorial choices. Omitted from finder JSON; not a secret field or access-control boundary.          |
| Include in recommendations (`enabled`)   | Must be true, with the entry Active and storefront-readable. Kept separate from publication for possible profile reuse.                                        |
| Verified shaft flex (`shaft_flex`)       | Optional: `Flexible`, `Medium`, `Hard Flex`. Leave blank when unknown.                                                                                         |
| Verified balance (`balance`)             | Optional: `Head Heavy`, `Even Balanced`, `Head Light`. Leave blank when unknown.                                                                               |

Malformed included profiles fail configuration loading. Both suitability lists must contain at least one supported choice; unknown or empty choices are rejected. Blank review metadata does not prevent recommendations. Missing flex/balance remains unknown, never inferred. Optional metadata does not remove the editorial requirement to support product claims.

### Suitability vocabulary and examples

Playing strengths are editorial judgments, not measured ratings or automatic consequences of specifications. Select only justified strengths and levels; do not select everything to boost visibility. Enter each choice separately. Adding a new choice requires matching code, tests and documentation changes.

| Strength  | Assign when reviewed evidence supports | Style points                       |
| --------- | -------------------------------------- | ---------------------------------- |
| `power`   | Attacking/power-oriented play          | Attack +4; Adapt +4/3              |
| `speed`   | Speed and handling-oriented play       | Speed +4; Counter +2; Adapt +4/3   |
| `control` | Placement/control-oriented play        | Control +4; Counter +2; Adapt +4/3 |

| Strengths          | Levels         | Illustrative result before specification ties |
| ------------------ | -------------- | --------------------------------------------- |
| `speed`, `control` | `intermediate` | Intermediate Counter: 2 + 2 + 1 = 5           |
| `power`            | `beginner`     | Beginner Attack: 4 + 1 = 5                    |
| `power`            | `advanced`     | Advanced Attack: 4 + 1 = 5                    |

Profile choices do not assign personality; the player's style answer does. Desired benefit earns no points. Weight, flex and balance belong only in their dedicated fields.

### Writing “Buying guidance”

This is a short buying guide for the specific racket. It should help someone recognise when the racket could suit them and understand a relevant trade-off. The same copy can appear for different players and answer combinations, so write about the product rather than claiming to know the reader's answers.

Use one plain-text paragraph, usually **two short sentences and roughly 25–45 words**. This is an editorial target, not a software limit. Lead with the strongest evidence-backed reason to consider the model; follow with one useful preference, trade-off or comparison that helps the shopper decide.

A useful structure is: **who or what it suits → what to weigh before choosing**. For example, identify its reviewed emphasis on quick exchanges, then mention comparing a more substantial option if that is the feel the player prefers. A trade-off should be informative, not an invented drawback added to satisfy a template.

Writing rules:

- Base every product-specific statement on reviewed evidence for the exact model and weight version. Verified class, flex or balance can provide context, but do not automatically prove every power, control or handling claim.
- Explain why a characteristic matters in a familiar playing situation. Avoid merely repeating the weight, flex and balance already displayed on the card.
- Keep the tone useful and confident without promises: “worth considering if…” or “compare…” can acknowledge differences in preference without making the copy vague.
- Avoid “perfect for everyone”, guaranteed stronger smashes, injury-prevention claims, unsupported superlatives and absolute rules such as “stiffer always means more control”. Do not imply that a recommendation guarantees fit.
- Do not write “you selected…” or “because you are a beginner”; dynamic answer-specific explanations are generated separately. Do not claim the desired-benefit question caused the recommendation.
- Avoid current prices, stock levels, discounts and model-specific comparisons that will quickly go stale. Do not add tension limits, exact grams or setup advice unless verified and necessary to the decision.
- Use plain sentences, with no HTML, Markdown formatting, bullet lists or links. The field is rendered directly as text; it is not a locale key or automatically translated by the theme's locale dictionary.

**Illustrative copy for a model whose quick-exchange positioning is verified:**

> Worth considering if you enjoy quick exchanges and frequent changes of racket direction. If you prefer a more substantial feel through your shots, compare a heavier option before deciding.

**Illustrative copy for a model whose attacking emphasis is verified:**

> An option to explore if attacking shots are a priority in your game. If fast defensive exchanges matter just as much, compare a model reviewed for quick handling before choosing.

These are writing examples, not approved copy for an existing product. Use them only when their claims match the profile's evidence, and tailor the wording to the model rather than copying it across the catalogue.

Before publishing, check:

1. Does the opening give a specific, supported reason to consider this racket?
2. Does the second sentence help make a choice rather than add generic caution?
3. Is every factual claim supported for this exact product and weight version?
4. Does the paragraph make sense regardless of which answers produced the recommendation?
5. Is it concise, understandable and free of changing price/stock information?

### Staging migration — 2026-11-02

The migration splits legacy tags into explicit strengths and levels: `new` → `beginner`, `developing` → `intermediate`, and either `experienced` or `competitive` → `advanced`. Duplicate levels collapse. Legacy weight tags and `handling` are ignored. Existing claims, product references, groups, URLs, review dates and specifications are preserved; review notes start blank.

Advanced now earns a full point for every advanced-suitable profile. Both weight versions of Flareon Typhoon, Hyfonic Lazer and Nitrix Thunder previously earned only 0.5 and gain 0.5. This approved change can reorder Advanced results and their specification tie groups. Beginner and Intermediate primary scores are unchanged.

The staging migration first backs up the definition and entries, adds optional fields, backfills all profiles, verifies preservation, then makes the new lists required. After deploying the new finder to development theme 183247143196, a CLI audit found no finder snippets or section in the other eight staging themes. The legacy tags field was then removed. All 20 entries retained their IDs, publication state and original values except the deliberately retired tags. No production migration or theme publication is included.

## Refresh, storage and presentation

The section loads `vx-racket-finder.js` directly as a module. `index.tsx` owns the Start button, returning to the introduction through an `onHome` callback, video playback and theme-editor mount/unmount cleanup. There is no separate lazy loader, hover preload, dynamic-import retry or `finder:start`/`finder:home` event bridge. Start is enabled after configuration validates; valid saved answers resume automatically. Fresh visitors do not fetch product data until starting the quiz. Video playback follows introduction visibility and reduced motion without a MutationObserver.

`Finder.tsx` also owns the specification and explanation formatting helpers formerly in `reasons.ts`. The runtime has five source files: entry, configuration, UI, matching engine and platform helpers.

Product loading uses four concurrent requests with ten-second timeouts, cancellation on unmount and explicit partial/total failure states with retry. Requests begin during the quiz; restored results, stale tab returns and stale completion/refinement refresh commerce data after 60 seconds. Prices and stock are never saved locally. Product pages remain authoritative for final pricing and stringing options.

Catalogue loading is independent of question transitions. A single state update commits products, failed handles and ready status together; aborted or superseded requests cannot commit. Recommendation ranking is memoized by configuration, answers, products and currency, so animation phases, download status and announcements do not rerun it. The shortlist reveal has mutually exclusive `idle`, `waiting` and `revealing` phases. Editing answers, refining weight or restarting cancels any pending reveal.

Answers use the stable `hndrd-racket-finder` storage key and an explicit schema version in `config.ts`. Bump that version only when saved answer meanings become incompatible. Copy, artwork, profile and presentation edits preserve answers. Same-version sessions retain all valid answers even when incomplete. Unknown questions and removed options are discarded individually, and the quiz resumes at the first unanswered quiz question. Complete sessions open results. Known v2 and fingerprinted v3 sessions use the same cleaning/resume path while the current version is `3.0.0`; other versions reset. Answers are still written on completion or refinement, not on each quiz selection. Blocked storage does not interrupt the quiz. Forget removes persistence; restart also clears current answers.

Weight updates retain focus and personality and do not emit completion again. The section’s optional results reveal is enabled in the supplied template and defaults on for new sections; existing explicit off settings remain off. It runs only after a fresh quiz or full restart. Before results, a typography-only preparation view lasts 2.5 seconds from mount, independently of catalogue requests. Its heading appears immediately and supporting line enters after 900 ms using the existing 180 ms question motion. Unsure answers get exploratory copy instead of a named-personality promise. Reduced motion shows both lines statically for the same duration. Saved sessions, answer edits and weight refinements bypass this pause. At its end the personality appears even if products are still loading; existing loading, currency, empty and failure states remain authoritative. The optional card entrance starts only once results are visible and recommendations are ready. Saving and completion tracking remain at quiz completion; the timer emits no events and is cancelled when the preparation view unmounts. Focus moves to the preparation heading and then the results heading. Questions use the PDP typography and flat answer rows; mobile weight options scroll horizontally. Existing supplied video and personality artwork and categorical scales remain in place. The hero is muted, loops without controls, pauses while the quiz is visible and does not autoplay with reduced motion.

## Analytics

Custom events publish only when Shopify's Customer Privacy API allows analytics. Denied events are not replayed. Missing APIs or receivers never interrupt the finder. Every event includes the explicit flow version:

| Event suffix (`racket_finder_`) | Fields                               |
| ------------------------------- | ------------------------------------ |
| started                         | none                                 |
| answered                        | question, answer                     |
| completed                       | archetype                            |
| product_clicked                 | archetype, handle, variant, position |
| card_downloaded                 | archetype                            |

Question and answer IDs remain stable. Named-result analytics retain existing personality IDs; unsure results send `archetype: exploring` for completed and product_clicked events. Only results with artwork offer downloads and emit card_downloaded. Older unsure events were attributed to `wild-card`; historical events are not rewritten. No contact information is sent. An existing customer-events pixel must subscribe for reporting; publishing does not create a dashboard or customer profile.

## Development and verification

Run `pnpm check:racket-finder` after installing root and `reax` dependencies. It runs the finder suite, checks translation-attribute coverage, checks TypeScript and builds all shared Preact entries once into a temporary directory. CI runs the same command. `cd reax && pnpm build:once` writes production assets and exits; the existing `build` command retains watch behaviour.

There is no translation-generation script or generated message snippet. Add a locale key and its matching `data-message-*` attribute together; every attribute uses `t | escape` so Shopify resolves the active storefront language and quotes remain safe. Editing existing wording needs only the locale file, with no JavaScript rebuild. JavaScript changes still use the normal Preact build. Preserve old hashed assets for cached storefront pages.

Data-attribute translation verification (2026-11-07): all 60 tests, TypeScript, formatting and the shared build passed. Tests check complete, unique locale-to-attribute mappings, escaping filters, numeric budget keys and interpolation. Local Chrome fixtures passed at 1440px and 390px, including translated headings, quotes, apostrophes, ampersands, Unicode, line breaks and markup-like text, plus quiz navigation, results and restored answers. These fixtures verify browser decoding and rendering, not live Shopify translation delivery. Theme Check found no finder-section issues; 19 unrelated files retain findings. The skill validator could not start because its bundled dependency was missing. The finder asset was rebuilt; nothing was deployed.

The fixed-flow refactor compared 360 style/experience/budget/weight scenarios against the previous implementation using identical product fixtures: personality and result ordering were unchanged. Tests separately cover weight-tag independence, plain-text considerations, version compatibility, copy edits, stock/budget failures and specification coverage. These are local fixture checks, not live catalogue evidence.

The explicit suitability migration passed 52 tests, TypeScript and the shared seven-entry build. Rechecking the 360-scenario baseline preserved all 240 Beginner/Intermediate result orderings and every personality; 56 Advanced orderings changed under the approved one-point rule. Final Admin readback confirmed all 20 migrated profiles and the new definition. These scenarios use fixtures, not live commerce data.

Staging deployment succeeded to development theme 183247143196 only. Theme Check reported no finder findings; 19 unrelated files still have existing findings. The skill's separate Liquid validator could not start because its bundled dependency was missing, so the repository Shopify CLI Theme Check was used. Backups and readback artifacts are at `/tmp/finder-staging-before.raw`, `/tmp/finder-staging-final.json` and `/tmp/finder-migration-verification.json`; copy these elsewhere before clearing temporary files if rollback records are needed.

Rendered desktop/mobile QA remains unverified: the public preview is password-protected, the previous local preview is unavailable and this session lacks the browser execution tool. Verify keyboard navigation, restored answers, strict weight/budget results, product links, download/reveal, theme-editor remounting and actual analytics receipt in an authenticated preview before production publication.

Auto-advance verification (2026-11-05): the 52-test suite, locale bridge, TypeScript and shared build passed. Local Chrome checks against the rebuilt finder and fixture products passed at 1440px and 390px: answer selection, Back, selecting retained or changed answers, Space/arrow-key activation, heading focus, final budget persistence, budget editing, reload and weight refinement without another completion event. These interaction checks do not verify the authenticated storefront or live analytics delivery.

Motion follow-up (2026-11-05): the same checks passed with normal and reduced motion at both widths. Browser checks observed the selected answer before advancing, disabled options during the outgoing fade, the 180 ms CSS transition and removal of animations/transitions for reduced motion. The 52 tests, TypeScript, locale bridge and shared build passed again; the finder bundle was rebuilt.

Setup cleanup (2026-11-05): 56 tests, the locale bridge, TypeScript, formatting and the shared build passed. A before/after comparison of all 360 experience/style/budget/weight fixture combinations preserved complete recommendation output (including scores and reasons) and personality. New cases cover question placement, informational questions, compatible partial sessions, added questions, removed options/questions, malformed storage and incompatible versions. The finder bundle was rebuilt locally. Rendered browser QA and storefront deployment were not repeated for this cleanup.

Personality naming update (2026-11-05): 58 tests, the locale bridge, TypeScript, formatting and the shared build passed. All 360 fixture scenarios preserve complete recommendation output; the 300 named-style scenarios keep their internal identity and the 60 unsure scenarios now return `null`. Tests cover the two displayed names, neutral exploration presentation and saved adaptable/unsure sessions. Theme Check found no finder or changed-locale issues; 19 unrelated files retain findings. The bundle was rebuilt locally. Desktop/mobile rendering, downloaded-card wrapping and actual analytics receipt remain unverified for this update; nothing was deployed.

Runtime simplification verification (2026-11-07): all 62 tests, TypeScript and the shared production build passed. The direct entry replaces `assets/racket-finder.js`; presentation helpers now live in `Finder.tsx`; Canvas export and its unused colours/locale strings were removed. Local Chrome fixtures passed at 1440px with normal motion and 390px with reduced motion: Start/Back-to-intro, video play/pause calls, automatic question advancement, results, downloaded image bytes matching the supplied artwork response, download errors, weight refinement, restored sessions, theme-editor cleanup/remounting, denied analytics consent, unsure-result download omission and invalid configuration. Product and CDN responses were fixtures; live CDN CORS/download delivery, real video playback and authenticated storefront rendering were not verified. Theme Check reported no findings in the changed section or locale; 19 unrelated files retain findings. The skill validator could not start because its bundled dependency was missing. The compiled finder asset matches a fresh shared build; nothing was deployed.

Personality image URL settings verification (2026-11-09): five translated URL fields now supply artwork through the section payload; the page template is seeded with the existing URLs and compiled configuration contains no artwork fallback. All 66 tests, TypeScript and the shared production build passed. Tests cover independent external-host URLs, blank/missing/unsupported values, unchanged identities/rankings/version, and PNG/JPEG/WebP download extensions and bytes. Theme Check reported no findings in the changed files; 19 unrelated files retain findings. The skill validator remains unavailable because its bundled dependency is missing. Theme-editor rendering and downloads from the chosen external hosts were not verified live; nothing was deployed.

Finder state cleanup verification (2026-11-09): all 70 tests, TypeScript, formatting and the shared production build passed. Four new reducer tests cover replacing pending selections, Back/Next bypassing the selection pause, rejecting navigation during the outgoing fade, and cancellation. A temporary LinkeDOM fixture exercised the production bundle with real timers: rapid selections, outgoing navigation lock, Back during the selection delay, reduced-motion navigation, results, weight refinement without another completion event, changed-budget persistence, restored results, catalogue failure/retry, restart and pending-timer cleanup on section unload. The compiled finder asset matches the fresh shared build and its imported shared chunk is unchanged. Local server binding and Chrome launch were blocked by this session's sandbox, so this verification does not establish rendered animation, layout, native keyboard behaviour or live-store operation. No runtime dependencies or files were added, matching rules are unchanged, and nothing was deployed.

Results preparation verification (2026-11-09): all 70 existing finder tests, TypeScript, formatting and the shared production build passed. A temporary LinkeDOM fixture exercised the built entry with real timers: results remained hidden at 2 seconds and appeared between 2.4 and 3 seconds; it also covered reduced-motion navigation, result heading focus, exploratory copy, slow catalogue requests, restored/edited result bypass, refinement, restart, disabled reveal settings and preparation timer cleanup on section unload. Completion events were not duplicated by the timer. Theme Check found no issues in the changed finder section or locales; 19 unrelated files retain findings. The compiled finder matches the fresh build, and its shared chunks are unchanged. This fixture does not verify rendered motion, responsive appearance, native keyboard behaviour or live-store operation. Nothing was deployed.
