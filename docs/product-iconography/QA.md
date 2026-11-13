# Review and verification

Reviewed 23 October 2026.

**Superseded design direction:** the user rejected the initial three boards as too detailed. The recommendation below is retained as review history, not current guidance. See [revision 2](REVISION-2.md) for the current minimal, abstract direction and new visual review.

## Completed

- Twelve original On SVG files downloaded and parsed as XML; all use an 80 × 80 viewBox. Source URLs and annotations are retained in `references.json`.
- The supplied screenshot is preserved locally and was attached to each independent built-in Image Generation call.
- All three requested boards were generated, displayed in chat and saved in the workspace. The displayed order is Object outlines (1), Technical sections (2), Objects with movement (3).
- Visually inspected all three full-board outputs: each contains the twelve requested labels in a 4-column, 3-row arrangement; the labels are readable and the diagrams stay within their cells. The drawings use black outlines on white, with no product values assigned.
- Shaft bending and string-bed tension use different diagrams. String gauge depicts diameter across a strand; construction depicts internal filaments. Storage compartments and shoe storage have separate subjects.
- The requested generation size was 1600 × 1200. The built-in tool returned each at 1448 × 1086, preserving the 4:3 aspect ratio. Originals are kept at their native resolution; no resize or claim of exact 1600 × 1200 output is made.
- The offline reference index includes the actual On SVGs at 32, 48 and 80 CSS pixels. The generated board footers are illustrative size samples, not calibrated small-icon tests.

## Design critique

| Board                     | Useful result                                                                                                         | Refinement needed before production                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Object outlines       | Most direct continuation of the supplied reference. Whole-object balance, flex and storage diagrams are recognisable. | Reduce racket string grids and outsole tread detail. Simplify shoe/support drawing and equalise optical size across the horizontal racket and compact icons. Feather must stay paired with the Weight label rather than imply every product is lightweight.                                    |
| 2 — Technical sections    | Diameter and filament cross-sections distinguish gauge from construction particularly clearly.                        | Some subjects remain whole-object views rather than strict sections; the outsole is a tread view. Simplify the bag cutaway, keep the support insert schematic and make sectional crop boundaries deliberate. A scale and a racket balance diagram need clear labels to avoid semantic overlap. |
| 3 — Objects with movement | Arrows help explain flex, tension, ventilation and shoe insertion.                                                    | Densest outsole and mesh patterns need simplification. Remove the vertical guide beside the feather in a production revision because it can suggest length. The shoe's opposing arrows are schematic and cannot establish actual lateral support performance.                                  |

Recommendation: use the first board as the family baseline, borrow the second board's string cross-sections, and reserve the third board's arrows for flex, tension and airflow. This is a design recommendation; no direction has been selected on the user's behalf.

## Evidence boundaries

- On source extraction and local SVG validation are complete. A source asset reference is not proof that an icon is visibly rendered on every product-page viewport.
- No new live browser screenshots were captured, and the offline HTML index has not been rendered in a browser in this session because the in-app browser execution tool was unavailable.
- No claim is made that these raster concept boards are production SVGs, dimensionally exact technical diagrams or approved SKU-specific illustrations.
- Exact 32/48/80-pixel legibility for the original HNDRD icons remains a vector-stage check. The board illustrations have not been cropped into production icons.
- Product data gaps are recorded in `README.md`, especially shoe weight basis, missing string gauge/length evidence and the Aeris/Nova Pro description inconsistency.
- No theme, translation, API, metafield or existing design-system files were changed. No storefront, cart or checkout tests were needed for this document-only delivery.
