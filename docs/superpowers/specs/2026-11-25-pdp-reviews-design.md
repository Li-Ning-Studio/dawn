# PDP reviews in our own Swiss design

Status: approved 2026-11-25 (layout A, data approach A).

## Why

The Judge.me review widget on the product page looks out of place: orange text everywhere, a centred small heading next to the left-aligned FAQ, "4.52 out of 5", a grey reply box. The PDP, finder and cart drawer are moving to the Swiss system in `docs/DESIGN-SYSTEM.md`, which already specs reviews (4px bars on a 12% track, hairline-separated items, store reply in micro). Judge.me stays the review store and the collection tool; we only own the display.

## Goals, non-goals, anti-goals

- Goals: match the Swiss PDP; show rating, breakdown, reviews, photos, store replies, location, date; sort and paging.
- Non-goals: our own submit form, redesigning the Q&A list, star badges on collection cards.
- Anti-goals: reviews disappearing if Judge.me changes its markup; layout shift; orange text.

## Approaches

- **A. Read Judge.me's widget data in the browser, render our own markup (picked).** No backend.
- B. Own server (e.g. Cloudflare Worker) with Judge.me's private token, clean JSON, own submit form. Deferred until we want our own form.
- C. Pure Liquid from metafields. Rejected: only average and count are synced (`reviews.rating`, `reviews.rating_count`).

## Recon findings (live store, Court Flyer, 2026-11-25)

- The Judge.me app block (legacy widget, `#judgeme_product_reviews`) is **server-rendered into the page HTML** with the first 5 reviews. It sits in an Apps section placed in the theme editor; it is not in the repo's `templates/product.json` (the live template has drifted from git).
- Paging endpoint used by Judge.me's own JS, **no token needed**: `GET https://cdn.judge.me/reviews/reviews_for_widget?url=<host>&shop_domain=<x.myshopify.com>&platform=shopify&product_id=<id>&page=<n>&per_page=<n>` → `{ html, total_count, page }`. `html` holds `.jdgm-rev` items.
  - Sort: `sort_by=rating&sort_dir=desc|asc`, `sort_by=most_helpful&sort_dir=desc`, `sort_by=pictures_first&sort_dir=desc`; no sort param = most recent.
  - Filters: `filter_rating=1..5` (its `total_count` gives the star breakdown; no histogram is rendered in the page), `sort_by=with_pictures` (only reviews with photos).
- Review item markup: `.jdgm-rev[data-verified-buyer]`, `.jdgm-rev__rating[data-score]`, `.jdgm-rev__timestamp[data-content="2025-11-24 14:46:15 UTC"]`, `.jdgm-rev__author`, `.jdgm-rev__location`, `.jdgm-rev__title`, `.jdgm-rev__body`, `.jdgm-rev__pics a.jdgm-rev__pic-link[href] img[data-src]`, `.jdgm-rev__reply` (`.jdgm-rev__replier`, `.jdgm-rev__reply-content`).
- "Write a review" (`.jdgm-write-rev-link`) opens a modal **outside** the widget, so the widget can be hidden. "Ask a question" (`.jdgm-ask-question-btn`) opens an inline form **inside** the widget (`.jdgm-question-form-wrapper`).

## Design (as built)

```
desktop (≥990), same columns as the FAQ above      mobile: stacked
┌ left (sticky) ─────┐ ┌ right ─────────────────────────────┐
│ Reviews            │ ├────────────────────────────────────┤
│ 4.5   ★★★★☆        │ │ ★★★★★                 18 Nov 2026  │
│ 42 reviews         │ │ Name                   Dhanbad, IN │
│ 5 ━━━━━━━━──── 30  │ │ Review text                        │
│ 4 ━━━───────── 8   │ │ ↪ store reply (same size, fainter) │
│ … (rows filter)    │ │ [photo][photo]                     │
│ Sort by Most recent⌄│ ├────────────────────────────────────┤
│ [Write a review]   │ │ [Show more reviews]                │
│ [Ask a question]   │                                       │
└────────────────────┘
```

- Section `sections/product-reviews.liquid` (id `judge_product_reviews`, the anchor the title rating links to). Liquid server-renders heading, score (1 decimal), stars and count from `product.metafields.reviews.*`.
- Layout and heading reuse the FAQ section's classes (`grouped-accordions.css`: `.grouped-accordions__layout`, `.grouped-accordions__heading`), so both sections share columns and heading style. Heading size is a section setting (default h1, like the FAQ); at h1 both headings are 28px on desktop (shared rule in `grouped-accordions.css`, so no per-store template change is needed).
- Stars: `assets/icon-star.svg`, a faint row with an ink row on top clipped to `--percent`. The script clones the same markup from `<template data-stars>`.
- Breakdown: the shared `.meter` bar (`base.css`, also used by the cart rewards bar). Rows are buttons that filter by star; tap again to clear. 5 `filter_rating` requests (`per_page=1`) when the section nears the viewport.
- Sort: a borderless native `<select>` under the bars ("Sort by Most recent ⌄", `icon-caret.svg`). "With photos" is a sort option.
- Review item: stars + date, name + location (flush right). No "verified" badge. Bodies with no letters or digits ("....") are dropped. Store reply: reply icon (from `<template data-reply-icon>`) + text at body size, fainter; brand-agnostic (no store name, screen-reader label "Reply from the store").
- `assets/product-reviews.js` (`<product-reviews>`): page 1 parsed from the in-page Judge.me widget; sort, filter and "Show more" via the cdn endpoint; only the latest request renders (a slow "Show more" can't append to a newer sort/filter). Rendering uses `textContent` only. Dates via `Intl` with `data-locale` (language + store country, e.g. `en-IN` → "16 Oct 2026").
- Write/Ask buttons click Judge.me's own links. The widget is moved into our section and hidden except its question form; Judge.me's frame (border/padding) is removed.
- Fallback: widget missing, or nothing parsed while the count says there are reviews → `product-reviews--fallback`, Judge.me's widget shows.
- Empty (0 reviews): "No reviews yet." + "Write the first review".

## Requires

- Judge.me **app block** on the product template (Apps section below ours) and the **Judge.me core app embed** in theme settings. Without the embed (e.g. a dev theme built from the repo's `config/settings_data.json`, which has no app embeds), Judge.me never sets up its widget, so Write/Ask do nothing; the review list still renders.

## Not shown (Judge.me features we don't render)

Published Q&A, custom review form answers, review videos, photo lightbox (photos open in a new tab), helpful votes, translations. Judge.me's widget impression stats drop because its widget is hidden.

## Later

Numbered pagination instead of "Show more" (endpoint already pages; total is known).

## Store setup (per store, in the theme editor)

This theme serves many stores; each store branch (`in-hundred`, `in-lining`, `ae-hundred`, …) owns its own `templates/*.json` and `config/settings_data.json`, synced from Shopify. Do not put a store's template into `dev`/`main`. Per store that uses Judge.me:

1. Product template: add the "Product reviews" section above the Apps section that holds the Judge.me review widget block (keep that block).
2. Keep the Judge.me core app embed on (Theme settings → App embeds).

Stores without Judge.me simply don't add the section.

## Left to the builder

Exact spacing within DS steps; date format (`Intl`, locale of the page); number of reviews per page (taken from how many reviews Judge.me server-rendered on page 1, i.e. the store's Judge.me setting; `data-per-page="5"` is only the fallback).
