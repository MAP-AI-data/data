# AI Adoption Share by Industry, Country and Year

Industry-level AI adoption shares derived from the **MAP-AI** (Mapping Artificial Intelligence in Firms) dataset, as described in:

> [Garbers, Julio and Terry Gregory. "The Diffusion of Artificial Intelligence Across Firms: Evidence from Europe." IZA Discussion Paper, No. 18434 (2026).](https://docs.iza.org/dp18434.pdf)

## File

`ai_adoption_share_by_industry_country.parquet` (also available as `.csv`)

A single long-format table with **60,584 rows**, covering two industry classification systems (NACE Rev. 2 and NAICS 2022) at four digit levels, for four European countries plus a pooled aggregate, annually from 2016 to 2024.

## Schema

| Column | Type | Description |
|---|---|---|
| `classification` | string | Industry classification system: `"nace"` or `"naics"` |
| `code` | string | Industry code (e.g., `"C"`, `"62"`, `"620"`, `"6201"`) |
| `digit_level` | int | Aggregation level: 1, 2, 3, or 4 |
| `country` | string | `"Germany"`, `"France"`, `"Luxembourg"`, `"Belgium"`, or `"Pooled"` |
| `year` | int | Year of observation (2016-2024) |
| `ai_adoption_share` | float | Share of firms classified as using AI (null if `n_firms` < 30) |
| `n_firms` | int | Number of unique firms in the industry-country-year cell |

## Coverage

**Countries:** Belgium, France, Germany, Luxembourg, and a pooled aggregate combining all four.

**Years:** 2016-2024 (9 years).

**Industry codes:**

| Classification | 1-digit | 2-digit | 3-digit | 4-digit |
|---|---|---|---|---|
| NACE Rev. 2 | 21 sections (A--U) | 88 divisions | 272 groups | 615 classes |
| NAICS 2022 | 9 sectors | 24 subsectors | 96 industry groups | 304 industries |

NACE codes follow the Eurostat NACE Rev. 2 classification. NAICS codes follow the 2022 NAICS structure published by the U.S. Census Bureau. NACE 1-digit codes correspond to section letters (A--U); higher levels are numeric. NAICS codes are numeric at all levels.

## Methodology

### AI adoption measure

The `ai_adoption_share` column reports the share of firms in a given industry-country-year cell whose websites indicate AI usage, as identified by the MAP-AI indicator. MAP-AI uses a Large Language Model (LLM) to classify firm website content and determine whether a firm adopts AI. The indicator captures *realized* AI adoption -- firms that actively use, develop, or deploy AI technologies -- rather than potential AI exposure. See the paper for full details on the classification methodology and validation.

### Construction of this dataset

For each industry-country-year cell, `ai_adoption_share` is computed as the mean of a binary AI adoption indicator across all firms in the cell. The number of unique firms (`n_firms`) is reported alongside each share.

### Minimum firm threshold

Cells with fewer than 30 firms have `ai_adoption_share` set to null to avoid reporting unreliable shares based on small samples. The `n_firms` count is always reported regardless of the threshold.

### Code validation

Industry codes are validated against official classification files (Eurostat NACE Rev. 2 RDF and 2022 NAICS Structure) before aggregation. Higher-level codes (1-digit through 3-digit) are derived from valid 4-digit codes.

## Citation

If you use this data, please cite:

```bibtex
@article{garbers_diffusion_ai,
  title   = {The Diffusion of Artificial Intelligence Across Firms: Evidence from Europe},
  author  = {Garbers, Julio and Gregory, Terry},
  year    = {2025}
}
```

## License

This dataset is licensed under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) license. You are free to share and adapt this data for any purpose, provided you give appropriate credit by citing the paper above.








