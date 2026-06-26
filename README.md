# MAP-AI: Firm-Level AI Adoption, Roles, and Technology Types in Europe

Aggregated indicators of firm-level **artificial-intelligence adoption**, **AI
ecosystem roles**, and **AI technology types** for four European countries,
derived from the **MAP-AI** (Mapping Artificial Intelligence in Firms) dataset
and described in:

> [Garbers, Julio and Terry Gregory. "The Diffusion of Artificial Intelligence Across Firms: Evidence from Europe." IZA Discussion Paper, No. 18434 (2026).](https://docs.iza.org/dp18434.pdf)

MAP-AI uses a Large Language Model to read firm website content and identify
whether a firm **adopts AI** (uses, develops, or deploys AI technologies), what
**role** it plays in the AI ecosystem, and which **types of AI technology** it
works with. The indicator captures *realized* AI adoption rather than potential
AI exposure. See the paper for the full classification methodology and
validation.

## What is in this repository

This repository publishes aggregated **firm-share** tables. They cover the full
matrix of two aggregation geographies × three indicator families:

| | **AI involvement** | **AI ecosystem roles** | **AI technology types** |
|---|---|---|---|
| **Industry × country** | `ai_adoption_share_by_industry_country` | `ai_role_share_by_industry_country` | `ai_type_share_by_industry_country` |
| **NUTS region** | `ai_adoption_share_by_nuts_region` | `ai_role_share_by_nuts_region` | `ai_type_share_by_nuts_region` |

Each table is provided as both `.parquet` and `.csv`. All tables are in long
format and share the same firm population and denominators (see *Methodology*).

| File (stem) | Rows | Unit |
|---|---:|---|
| `ai_adoption_share_by_industry_country` | 60,584 | classification × code × digit level × country × year |
| `ai_role_share_by_industry_country` | 484,672 | … × role (8) |
| `ai_type_share_by_industry_country` | 666,424 | … × technology type (11) |
| `ai_adoption_share_by_nuts_region` | 5,922 | NUTS code × level × year |
| `ai_role_share_by_nuts_region` | 47,376 | … × role (8) |
| `ai_type_share_by_nuts_region` | 65,142 | … × technology type (11) |

## Coverage

**Countries:** Belgium, France, Germany, Luxembourg (plus a `Pooled` aggregate
that combines all four, in the *industry × country* tables only). The region
tables need no pooled aggregate: NUTS regions are nested within a single country,
so NUTS level 0 already provides the per-country totals.

**Years:** 2016–2024 (9 years).

**Industry codes** (NACE Rev. 2 and NAICS 2022, at 1–4 digit levels):

| Classification | 1-digit | 2-digit | 3-digit | 4-digit |
|---|---|---|---|---|
| NACE Rev. 2 | 21 sections (A–U) | 88 divisions | 272 groups | 615 classes |
| NAICS 2022 | 9 first-digit groups | 24 subsectors | 96 industry groups | 304 industries |

NACE 1-digit codes are the official section letters (A–U); all higher NACE levels
and all NAICS levels are numeric. **Note:** NAICS has no official 1-digit level
(its sectors are 2-digit, some spanning ranges such as 31–33). The NAICS
`digit_level = 1` rows are a non-standard grouping by the first digit of the
4-digit code, retained for backward compatibility; use the 2-digit level for
sector-level analysis.

**NUTS regions** (Eurostat NUTS 2024 classification). A region appears as a row
once at least one firm is located in it; exactly as for industries, its shares
are reported only when the relevant denominator reaches 30 (`n_firms` ≥ 30 for
`ai_adoption_share`). In practice every region present clears the 30-firm
threshold, so no regional adoption share is suppressed.

| NUTS level | Meaning | Code length | Regions present |
|---|---|---|---|
| 0 | Country | 2 | 4 |
| 1 | Major socio-economic regions | 3 | 34 |
| 2 | Basic regions | 4 | 77 |
| 3 | Small regions | 5 | 543 |

## Schema

### AI-involvement tables

`ai_adoption_share_by_industry_country` and `ai_adoption_share_by_nuts_region`:

| Column | Type | Description |
|---|---|---|
| `classification` | string | `"nace"` or `"naics"` *(industry table only)* |
| `code` | string | Industry code, e.g. `"C"`, `"62"`, `"6201"` *(industry table only)* |
| `digit_level` | int | Industry aggregation level: 1, 2, 3 or 4 *(industry table only)* |
| `nuts_code` | string | NUTS region code, e.g. `"FR"`, `"FR1"`, `"FRI11"` *(region table only)* |
| `nuts_level` | int | NUTS aggregation level: 0, 1, 2 or 3 *(region table only)* |
| `country` | string | `"Germany"`, `"France"`, `"Luxembourg"`, `"Belgium"` (and `"Pooled"` for the industry table) |
| `year` | int | Year of observation (2016–2024) |
| `ai_adoption_share` | float | Share of classified firms that are AI-active (null if `n_firms` < 30) |
| `n_firms` | int | Number of classified firms in the cell |

### Role and technology-type tables

The four `ai_role_*` / `ai_type_*` tables add one row per category. They share
this schema (replace `role`→`type`, `ai_role`→`ai_type` for the type tables, and
the geography columns as above):

| Column | Type | Description |
|---|---|---|
| *(geography columns)* | | as in the involvement tables |
| `year` | int | Year of observation (2016–2024) |
| `ai_role` / `ai_type` | int | Category code (roles 1–8, types 1–11; see *Taxonomies*) |
| `ai_role_label` / `ai_type_label` | string | Human-readable category label |
| `role_share_among_ai_firms` / `type_share_among_ai_firms` | float | Share of **AI-active** firms in the cell that fall in this category (null if `n_ai_firms` < 30) |
| `role_share_among_all_firms` / `type_share_among_all_firms` | float | Share of **all classified** firms in the cell that fall in this category (null if `n_firms` < 30) |
| `n_ai_firms` | int | Number of AI-active firms in the cell (denominator of `*_share_among_ai_firms`) |
| `n_firms` | int | Number of classified firms in the cell (denominator of `*_share_among_all_firms`) |

## Methodology

### Firm population and unit

The unit of observation is the firm-year. A firm contributes to a year if and
only if it could be matched to classified website content and that year falls in
2016–2024. `n_firms` therefore counts **classified firms**, and is identical
across the involvement, role, and type tables for the same cell.

### Cumulative indicators

All indicators are **cumulative**: a firm counts as AI-active / as having a given
role / using a given technology type in year *y* if it was ever classified as
such up to and including year *y*. This is the measure underlying the paper's
headline diffusion series.

### `ai_adoption_share`

The share of classified firms in the cell that are AI-active — the mean of the
binary cumulative AI-adoption indicator over the firm-years for which it is
defined. The industry-country adoption table reproduces the previously published
table exactly.

A small number of classified firm-years have an *undetermined* adoption
indicator. The mean drops them from its denominator, whereas `n_firms` still
counts them, so `ai_adoption_share` can differ from `n_ai_firms / n_firms` (the
role/type tables' all-firm denominator) by at most about 0.003, in a minority of
cells. Treat `ai_adoption_share` as the authoritative adoption measure (it is the
one used in the paper).

### Roles and technology types: two denominators

A firm is assigned roles and technology types **only if it is AI-active**, and it
can have **several at once** (the categories are not mutually exclusive — within a
cell the category shares do **not** sum to one). To make both natural readings
available, each category row reports two shares:

- `*_share_among_ai_firms` = firms in the category ÷ `n_ai_firms` — the
  composition of the local AI ecosystem (the framing used in the paper).
- `*_share_among_all_firms` = firms in the category ÷ `n_firms` — the share of
  the whole local firm population, on the same `n_firms` denominator that is
  reported alongside it.

Both denominators (`n_ai_firms` and `n_firms`) are reported, so for any cell
above its suppression threshold the underlying category firm count is recoverable
as `round(share_among_all_firms × n_firms)` or, equivalently,
`round(share_among_ai_firms × n_ai_firms)`.

### Category structure

- **Roles** — categories 1–6 are substantive ecosystem roles, 7 is *Other AI
  role*, and 8 is *AI role cannot be inferred* (7 and 8 are mutually exclusive
  fallbacks).
- **Technology types** — categories 1–9 are substantive technology types, 10 is
  *Other AI technology type*, and 11 is *AI type cannot be inferred* (10 and 11
  are mutually exclusive fallbacks).

### Minimum-firm suppression

To avoid reporting unreliable shares from small samples, a share is set to null
when its denominator is below 30: `ai_adoption_share` and `*_share_among_all_firms`
when `n_firms` < 30, and `*_share_among_ai_firms` when `n_ai_firms` < 30. Counts
(`n_firms`, `n_ai_firms`) are always reported.

### Code validation

Industry codes are validated against the official classification files (Eurostat
NACE Rev. 2 RDF and the 2022 NAICS Structure); NUTS codes against the Eurostat
NUTS 2024 geometry file. Higher aggregation levels are derived from the validated
finest level (4-digit industries; 5-character NUTS3 regions).

## Taxonomies

### AI ecosystem roles

| Code | Label |
|---|---|
| 1 | AI core technology provider |
| 2 | AI application and solution developer |
| 3 | AI adopter or innovative user |
| 4 | AI research or support organization |
| 5 | AI investor or incubator |
| 6 | AI data infrastructure provider |
| 7 | Other AI role |
| 8 | AI role cannot be inferred |

### AI technology types

| Code | Label |
|---|---|
| 1 | Generative AI & conversational systems |
| 2 | Text & language (non-generative) |
| 3 | Image & video (non-generative) |
| 4 | Speech, audio & music |
| 5 | Predictive & analytical applications |
| 6 | Recommendation & personalization |
| 7 | Autonomous systems & robotics |
| 8 | Security & fraud detection |
| 9 | Foundational AI/ML technologies |
| 10 | Other AI technology type |
| 11 | AI type cannot be inferred |

## Main data source

[Common Crawl](https://commoncrawl.org/)

## Citation

If you use this data, please cite:

```bibtex
@techreport{garbers_and_gregory_diffusion_ai,
  title       = {The Diffusion of Artificial Intelligence Across Firms: Evidence from Europe},
  author      = {Garbers, Julio and Gregory, Terry},
  year        = {2026},
  institution = {Institute of Labor Economics (IZA)},
  type        = {IZA Discussion Paper},
  number      = {18434},
  url         = {https://docs.iza.org/dp18434.pdf}
}
```

## License

This dataset is licensed under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license. You are free to share and adapt this data for any purpose, provided you give appropriate credit by citing the paper above.
