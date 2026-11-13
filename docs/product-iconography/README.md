# HNDRD product iconography

Research and concept exploration · 23 October 2026

Open [the visual collection](index.html) for all twelve On references, three revised HNDRD concept boards, the initial-board archive, category mapping and review notes. The collection works offline after downloading this folder. Source links require an internet connection.

## Current direction: revision 2

The user rejected the initial boards as too detailed. The current direction is **very simple, minimal and abstract**, using gauge, string construction and maximum tension as the strongest starting points. Whole-object illustrations are no longer the baseline. See [the revised brief](REVISION-2.md), [new boards](concepts/revision-2/) and [exact revision prompts](revision-2-prompts.json). Initial artwork and notes below remain as research history; the revised brief takes precedence.

## Brief and decisions

- Closely follow the thin, illustrative outline character in the supplied On screenshot, with original HNDRD subject drawings.
- Cover all product categories in phases. Begin with badminton rackets, footwear, strings and bags.
- Deliver references and concept boards. Production SVGs, product assignments, storefront UI and theme integration are a subsequent pass.
- Keep the same twelve attribute subjects across all three boards so differences in drawing approach can be compared directly.
- Preserve existing workspace work. This delivery is contained in `docs/product-iconography/`.

## Contents

| File                                 | Purpose                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `index.html`                         | Offline visual reference and concept collection                                              |
| `references.json`                    | Exact source URLs, local filenames and annotations for twelve On SVGs                        |
| `references/on/`                     | Unmodified competitor reference assets for internal research                                 |
| `references/user-on-cloudnova.png`   | Supplied screenshot, preserved as the primary visual reference                               |
| `concepts/object-outlines.png`       | First displayed concept: recognisable objects and spare internal detail                      |
| `concepts/technical-sections.png`    | Second displayed concept: cutaways and construction diagrams                                 |
| `concepts/objects-with-movement.png` | Third displayed concept: objects with explanatory arrows and guides                          |
| `prompts.json`                       | Exact prompts, reference attachment, output metadata and built-in generation tool provenance |
| `QA.md`                              | Review findings and remaining production checks                                              |

## What we learned from On

The screenshot pairs a pictorial icon with a small attribute label, a prominent value and a quiet horizontal rule. The icons communicate the attribute, while text supplies the product-specific fact. Some drawings identify objects; others explain measurement, construction or intended conditions.

All twelve downloaded SVGs declare an 80 × 80 viewBox. The assets with explicit `stroke-width` attributes use a width of 2; several others use filled paths that represent linework. Do not assume every source is an editable stroked path. The concept boards use those proportions as art direction, not a guarantee of production vector geometry.

| Category          | Product reference                                                                                                                                                                                                                                    | Icon subjects found                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everyday footwear | [Cloudnova 2](https://www.on.com/en-us/products/cloudnova-2-3we3022/womens/biscuit-desert-shoes-3WE30226014)                                                                                                                                         | Standard lacing, heel-to-toe drop, weight                                                                                                             |
| Road running      | [Cloudsurfer 2](https://www.on.com/en-us/products/cloudsurfer-2-3mf1012/mens)                                                                                                                                                                        | Smooth ride, standard lacing, drop, weight                                                                                                            |
| Trail running     | [Cloudultra 3](https://www.on.com/en-us/products/cloudultra-3-m-3mf3023/)                                                                                                                                                                            | Technical terrain, maximum cushioning, drop, weight                                                                                                   |
| Training          | [Cloud X 4](https://www.on.com/en-us/products/cloud-x-4-m-3mg1133/mens)                                                                                                                                                                              | Light stability, star lacing                                                                                                                          |
| Tennis            | [THE ROGER Pro 3](https://www.on.com/en-us/products/the-roger-pro-3-m-3mg1036/mens/black-ash-shoes-3MG10365204)                                                                                                                                      | Hard court, drop, weight                                                                                                                              |
| T-shirts          | [Performance-T](https://www.on.com/en-us/products/performance-t-w-1we1031/womens/navy-black-apparel-1WE10310516)                                                                                                                                     | Close fit, warm conditions; weight asset also referenced in source                                                                                    |
| Outerwear         | [Performance Jacket](https://www.on.com/en-us/products/performance-jacket-m-1mf3077)                                                                                                                                                                 | Close fit, waterproofness; weight asset also referenced in source                                                                                     |
| Shorts            | [Essential Shorts](https://www.on.com/en-us/products/essential-shorts-m-1me1152)                                                                                                                                                                     | Warm climate confirmed in page text; direct SVG extraction was unavailable for this page                                                              |
| Bags              | [Cargo Pack 60L](https://www.on.com/en-us/products/cargo-pack-60l-2uf1030/unisex/biscuit-accessories-2UF10304934), [Speed Pack 24L Elite](https://www.on.com/en-us/products/speed-pack-24l-elite-2ue1016/unisex/cacao-black-accessories-2UE10164936) | Feature descriptions cover storage and dimensions; Cargo source references the shared weight asset. No distinct capacity or compartment icon verified |
| Socks             | [Performance Run Sock Mid](https://www.on.com/en-us/products/performance-run-sock-mid-2uf1005/unisex/flurry-storm-accessories-2UF10055543)                                                                                                           | Source references the shared weight asset; the page describes construction and ventilation in text                                                    |

These are source and content observations. A linked SVG in page source does not establish that it is visibly rendered at every viewport. No new browser screenshots were captured; the supplied screenshot is the only captured On page in this collection. The images in `references/on/` are On's reference artwork and must not be shipped as HNDRD assets.

## HNDRD category map

The local _HNDRD Full Product Catalogue.txt_, labelled 2025–2026, was reviewed first. Current official pages supplemented selected entries. The following map proposes subjects; it does not assign features or values to every product in a family.

| Phase | Product family                                                                  | Proposed attributes                                                                                | Drawing approach and evidence gate                                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Badminton rackets                                                               | Weight/class, balance, shaft flexibility, maximum tension; shaft diameter and material later       | Racket on fulcrum; bent shaft against a straight guide; taut string bed. Keep 3U/4U classes distinct from measured grams; maximum tension is not a recommended stringing tension.                            |
| 1     | Footwear across badminton, pickleball, tennis and cricket                       | Outsole type, support construction, cushioning construction, ventilation; weight where qualified   | Sole tread, midfoot insert, heel section and mesh airflow. Sport-specific outsole drawings must match the SKU. Do not infer fit, support, cushioning or court suitability from weight or category.           |
| 1     | Badminton strings                                                               | Gauge, construction, length; published performance attributes where useful                         | Strand diameter, filament cross-section and coil. Confirm gauge and length rather than inferring them from a model name.                                                                                     |
| 1     | Kit bags, backpacks and shoe bags across sports                                 | Compartment count, separate shoe storage, dimensions; capacity and thermal lining where documented | Open bag partitions, separate shoe pouch, external dimension guides. Distinguish a detachable pouch from an integrated compartment; dimensions do not establish usable litre capacity.                       |
| 2     | Pickleball paddles                                                              | Core thickness, face construction, shape, weight, handle dimensions                                | Paddle edge section, surface layers and wide/elongated silhouettes. Keep thickness and shape variants separate; omit approval badges until their current status is verified.                                 |
| 2     | Tennis rackets and strings                                                      | Head size, balance, weight, grip size, string gauge/construction                                   | Measured head outline, balance diagram and handle section. Confirm strung/unstrung measurement basis and units.                                                                                              |
| 2     | Apparel                                                                         | Fabric, fit, sleeve/garment length; documented functional features                                 | Weave, garment clearance and hem guides. Polyester alone does not prove moisture-wicking or a climate rating.                                                                                                |
| 2     | Socks                                                                           | Height, composition, pack quantity; documented cushioning zones                                    | Ankle silhouette and highlighted textile zones. Keep quarter, ankle and crew variants distinct.                                                                                                              |
| 2     | Grips and grip powder                                                           | Grip type, thickness, material, intended palm condition; powder composition and quantity           | Wrapped handle, grip section and simple powder container. Validate units where catalogue entries omit them.                                                                                                  |
| 2     | Insoles, wristbands and KT tape                                                 | Material, dimensions, pack quantity; documented construction                                       | Insole section, band silhouette and measured tape strip. Avoid implying medical efficacy or transferring catalogue ratings into universal performance claims.                                                |
| 2     | Shuttlecocks, pickleball balls, cricket tennis balls, basketballs and footballs | Material, construction, size, pack quantity; speed/intended surface where documented               | Shuttle profile, ball section and circumference guide. Shuttlecocks are visible in current HNDRD navigation but were not established by the catalogue excerpts; verify individual models before assignments. |

## First twelve subjects

| Subject             | Meaning the drawing must preserve                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Weight              | Identifies the mass attribute; does not assert that every item is lightweight                          |
| Balance             | Shows a balance point on a racket; keeps category and numeric balance point distinct                   |
| Shaft flex          | Bending of the shaft, not the frame or string bed                                                      |
| Max tension         | Tension limit of the racket string bed, not string gauge or a suggested tension                        |
| String gauge        | Diameter across one strand, not length                                                                 |
| String construction | Internal filaments and outer structure, without claiming every string has the illustrated construction |
| Outsole             | The construction or type of sole; no implied grip score or universal court suitability                 |
| Support structure   | A structural component in the shoe, not an anatomical or injury-prevention claim                       |
| Ventilation         | Air passage through material where documented, not a moisture-wicking or waterproof rating             |
| Compartments        | Separate internal storage spaces; drawing is schematic, not a SKU-specific count                       |
| Shoe storage        | A dedicated shoe storage area/pouch; confirm which construction the SKU uses                           |
| Bag dimensions      | Length, width and/or height; no inference of capacity                                                  |

## Three concept directions

**Object outlines (initial direction, rejected):** previously recommended as a starting point for the family. Whole-object silhouettes are closest to the supplied reference and explain attributes with relatively little interpretation.

**Technical sections:** useful for attributes whose meaning depends on construction. String gauge and filament structure are particularly suitable. The drawing style stays light, but the semantic detail is higher.

**Objects with movement:** uses arrows and dotted guides to explain flex, tension, airflow and access. Keep arrows where they clarify meaning; excessive motion marks can imply unsupported performance.

All three were generated independently with the built-in Image Generation tool using the supplied screenshot as the attached style reference. They are raster concept boards, not SVG masters, exact product diagrams or final component artwork. The intended 32/48/80 samples inside the generated images are illustrative; exact pixel-size legibility needs vector-stage testing.

## Product evidence and gaps

- [Phenom](https://in.hndrd.co/products/phenom): the specification table lists non-marking outsole and 350 grams. The weight's reference size and single-shoe/pair basis are not stated in the reviewed evidence. Its description names Goodyear outsole rubber and ThrustFoam. Keep construction claims attached to this model, and qualify weight before publishing a comparison.
- [JP65 Magnite](https://in.hndrd.co/products/jp65-magnite): the reviewed specifications identify nylon multifilament core and nylon monofilament outer material, plus brand-provided performance ratings. The reviewed text does not establish gauge or length. Treat ratings as brand-specific, not universal or independently measured scores.
- [Aeris Pack](https://in.hndrd.co/products/aeris-pack): the description mentions three compartments, thermal lining and a detachable shoe bag, but later calls the product “Nova Pro.” Resolve the naming inconsistency before assigning those features to a final product tile. The concept boards therefore use generic attribute labels with no product values.
- [Nitrix range](https://in.hndrd.co/collections/nitrix): public filters distinguish weight classes, materials, balance and shaft flexibility. Use individual SKU specifications for final assignments; collection filters do not establish every model's attributes.

## Next production step

Choose a board or a deliberate combination of its subjects, refine the selected drawings, then prepare one consistent vector family. Use one baseline drawing grammar and optical alignment; test each master at 32, 48 and 80 pixels with labels and real, verified values. Integrate with the existing product specification data only in a separately authorised implementation pass. No theme changes, public API changes or new metafields are part of this delivery.
