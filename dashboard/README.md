# MAP-AI Explorer

**Open it: <https://map-ai-data.github.io/data/dashboard/>**

The MAP-AI Explorer is an interactive dashboard of the tables in this repository,
based on Garbers and Gregory (2026), [“The Diffusion of Artificial Intelligence
Across Firms: Evidence from Europe”](https://docs.iza.org/dp18434.pdf), IZA
Discussion Paper No. 18434. It shows firm-level AI adoption
by country, region and industry, and the ecosystem roles and technology types of
AI-active firms, for Belgium, France, Germany and Luxembourg, 2016–2024. It reads
in English, German or French.

It has five views:

- **Overview**: headline figures, how AI spread in each country, AI-active firms
  by country, and a country table.
- **Regions**: a map of every NUTS 1, 2 or 3 region, which switches to a heat map
  of where AI-active firms concentrate, the same regions as dots by country, and a
  table to sort and search.
- **Industries**: each industry's AI-active share in the first and the selected
  year, and a heat table of industries by country (NACE sections or divisions,
  NAICS sectors).
- **Technologies & roles**: the mix of AI-active firms over time, by country and
  by industry, with any category highlighted.
- **Validation**: MAP-AI against Eurostat's survey of AI use in enterprises, as in
  Figure A.2 of the paper: each industry's share of firms using AI in both, for any
  survey year or their average, with the correlation, a table of the industries,
  and both measures over time.
- **About the data**: definitions, coverage and how to cite.

A year picker and a **Play** button move every view through the years. Next to
them, country buttons narrow every view to one, two or three of the countries, and
a switch in the header changes the language. Filters are kept in the address, so
any view can be shared as a link.

## Running it

The dashboard is a static page, so any web server can host it.

- **GitHub Pages** serves it from this repository's `main` branch
  (*Settings → Pages → Deploy from a branch*, branch `main`, folder `/ (root)`),
  at the address above.
- **On your computer:** from the repository folder, run
  `python3 -m http.server 8000` and open <http://localhost:8000/dashboard/>.
  Opening `index.html` straight from disk does not work, because browsers block
  pages opened from a file from loading data files.

## How it is built

Plain HTML, CSS and JavaScript with [d3](https://d3js.org); there is no build
step and nothing to install.

| Path | What it holds |
|---|---|
| `index.html` | The page |
| `assets/lib.js` | Shared helpers, the calculations and the chart builders |
| `assets/overview.js`, `regions.js`, `industries.js`, `tech.js`, `validation.js` | One script per view |
| `assets/style.css`, `assets/theme.css` | Layout, and colors and type for light and dark |
| `assets/dash.js` | A small runtime that loads the data and redraws the charts when data, filters or the page width change |
| `assets/vendor/d3.min.js` | d3 v7.9.0 (ISC license, in `d3.LICENSE.txt`) |
| `data/` | The data the page reads (below) |
| `build_data.py` | Rebuilds the table extracts in `data/` from the tables, and the Eurostat extract |
| `eurostat/` | Eurostat's table of AI use in enterprises, as used in the paper |
| `build_map.py` | Rebuilds `data/nuts_geo.json`, the map's region outlines |

## The data

Each table extract in `data/` is a subset of one table in this repository, with
the table's own columns and values:

| File | Rows of | Rows kept |
|---|---|---|
| `country_adoption.json` | `ai_adoption_share_by_nuts_region.csv` | NUTS level 0 (countries) |
| `country_roles.json` | `ai_role_share_by_nuts_region.csv` | NUTS level 0 |
| `country_types.json` | `ai_type_share_by_nuts_region.csv` | NUTS level 0 |
| `region_adoption.json` | `ai_adoption_share_by_nuts_region.csv` | NUTS levels 1–3 |
| `industry_adoption.json` | `ai_adoption_share_by_industry_country.csv` | NACE sections and divisions, NAICS 2-digit sectors |
| `industry_types.json` | `ai_type_share_by_industry_country.csv` | NACE sections |
| `industry_roles.json` | `ai_role_share_by_industry_country.csv` | NACE sections |
| `eurostat_ai.json` | `eurostat/isoc_eb_ain2_page_linear_2_0.csv` | NACE sections and the survey's total |

When the tables change, rebuild the extracts and commit them (standard library
only):

```sh
python3 dashboard/build_data.py
```

`names.json` holds the names of NACE Rev. 2 sections and divisions, NAICS 2022
sectors and NUTS 2024 regions, plus short labels for the AI roles and technology
types, in English and, where they differ, German and French. NUTS 3 names come from Eurostat's NUTS 2024 files; the NUTS 1 and 2 names
were written out and checked against them. The industry names were written out
from the published classifications rather than downloaded, and the German and
French names were translated for this dashboard, so check them against Eurostat
and the US Census Bureau before citing them.

## The Eurostat survey

`eurostat/isoc_eb_ain2_page_linear_2_0.csv` is Eurostat's table
[isoc_eb_ain2](https://ec.europa.eu/eurostat/databrowser/view/isoc_eb_ain2/default/table?lang=en),
*Artificial intelligence by NACE Rev. 2 activity*, as downloaded for the paper:
the share of enterprises with 10 or more persons employed that use at least one AI
technology (`E_AI_TANY`), for Belgium, France, Germany and Luxembourg in the survey
years 2021, 2023 and 2024. `build_data.py` keeps its NACE sections and the survey's
total (`C10-S951_X_K`, all activities except agriculture, mining and finance) in
`eurostat_ai.json`, with Eurostat's columns and flags. Source: Eurostat. Eurostat
allows reuse with the source acknowledged.

## The map

`nuts_geo.json` holds the outlines of the NUTS 2024 regions of the four countries
(levels 0–3) and of the neighbouring countries, as SVG paths in kilometres in the
European equal-area projection (ETRS89-LAEA, EPSG:3035), plus each region's
representative point and area, which the heat map uses. It is built from
Eurostat's [Nuts2json](https://github.com/eurostat/Nuts2json) at 1:10 million:

```sh
python3 dashboard/build_map.py                # downloads the source files
python3 dashboard/build_map.py path/to/Nuts2json   # or uses a local copy
```

The French outermost regions lie outside Eurostat's European frame, so they are
not on the map; the dot chart and the table include them.

Boundaries: © EuroGeographics for the administrative boundaries. Eurostat's
[terms for its NUTS geodata](https://ec.europa.eu/eurostat/web/gisco/geodata/reference-data/administrative-units-statistical-units)
apply to `nuts_geo.json` (credit the source; non-commercial use), not this
repository's CC BY 4.0 license.

## Calculations on the page

- **Several countries together** (country-level adoption, roles and types): AI-active
  firms, or a category's firms, summed over the picked countries and divided by
  the summed denominator. A category's firm count is recovered as
  `share_among_all_firms × n_firms`, as the main README describes. For
  industries, all four countries use the tables' own `Pooled` rows; two or three
  countries weight each country's share by its classified firms, leaving out
  withheld shares, and their mix of roles and types by NACE section sums the
  recovered category counts (withheld below 30 AI-active firms).
- **Changes** are in percentage points, on the year before or since the first
  year; **growth** is a share divided by the same share in the first year.
- The **map** shades each region on one scale for all years at a level, whose
  darkest color starts at the 98th percentile of all regions' shares at that
  level.
- The **heat map** has no firm locations to work from, only regions. It estimates
  each NUTS 3 region's AI-active firms as `ai_adoption_share × n_firms`, spreads
  them around the region's representative point with a Gaussian (σ = 0.25 × √area,
  between 7 and 22 km), sums them on a 4 km grid as firms per km², and colors the
  result on a cube-root scale fixed at the latest year's peak.
- Shares the tables withhold (fewer than 30 firms in the denominator) show as
  hatched cells or missing dots.
- **Validation** follows the paper's Figure A.2. For each NACE section the survey
  reports (C to N without K), the survey's share for several countries is the
  mean of the shares the countries report, as in the paper, and MAP-AI's pools
  their firms (all four countries: the `Pooled` rows); the average of the survey
  years needs all three. The correlation is Pearson's, over the sections with both
  figures. The paper's figure was computed from firm-level data, so a few values
  differ slightly from these, which come from the published tables (with all four
  countries and the average, r = 0.940 here and 0.943 in the paper). Over time,
  MAP-AI's line pools its firms in the same sections, and the survey's rings are
  its total for all the activities it covers.