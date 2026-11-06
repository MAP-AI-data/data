#!/usr/bin/env python3
"""Build the dashboard's data files from this repository's tables.

    python3 dashboard/build_data.py

Reads the CSV tables in the repository root and writes JSON extracts to
dashboard/data/. Each extract is a filtered subset of one table that keeps the
table's own columns and values (empty cells become null), so every number on the
dashboard traces back to a row of a published table. Uses only the standard
library. names.json (industry and region names) is maintained by hand and is
not touched.

eurostat_ai.json, for the Validation view, comes the same way from Eurostat's
table isoc_eb_ain2 (Artificial intelligence by NACE Rev. 2 activity), in
dashboard/eurostat/ as downloaded from Eurostat and used in the paper: the share
of enterprises with 10 or more persons employed using at least one AI
technology, for NACE sections and the survey's total. Source: Eurostat; reuse is
allowed with the source acknowledged.
"""

import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dashboard", "data")

INTEGERS = {"digit_level", "nuts_level", "year", "n_firms", "n_ai_firms", "ai_role", "ai_type"}
FLOATS = {
    "ai_adoption_share",
    "role_share_among_ai_firms",
    "role_share_among_all_firms",
    "type_share_among_ai_firms",
    "type_share_among_all_firms",
}

# (output file, source table, which rows to keep)
EXTRACTS = [
    ("country_adoption", "ai_adoption_share_by_nuts_region", lambda r: r["nuts_level"] == 0),
    ("country_roles", "ai_role_share_by_nuts_region", lambda r: r["nuts_level"] == 0),
    ("country_types", "ai_type_share_by_nuts_region", lambda r: r["nuts_level"] == 0),
    ("region_adoption", "ai_adoption_share_by_nuts_region", lambda r: r["nuts_level"] >= 1),
    (
        "industry_adoption",
        "ai_adoption_share_by_industry_country",
        lambda r: (r["classification"] == "nace" and r["digit_level"] in (1, 2))
        or (r["classification"] == "naics" and r["digit_level"] == 2),
    ),
    ("industry_types", "ai_type_share_by_industry_country", lambda r: r["classification"] == "nace" and r["digit_level"] == 1),
    ("industry_roles", "ai_role_share_by_industry_country", lambda r: r["classification"] == "nace" and r["digit_level"] == 1),
]


EUROSTAT = os.path.join(ROOT, "dashboard", "eurostat", "isoc_eb_ain2_page_linear_2_0.csv")
EUROSTAT_TOTAL = "C10-S951_X_K"  # all activities the survey covers: no agriculture, mining or finance


def eurostat_rows():
    with open(EUROSTAT, newline="", encoding="utf-8") as f:
        for raw in csv.DictReader(f):
            assert (raw["indic_is"], raw["unit"], raw["size_emp"]) == ("E_AI_TANY", "PC_ENT", "GE10"), raw
            code = raw["nace_r2"].strip()
            if len(code) != 1 and code != EUROSTAT_TOTAL:
                continue
            yield {
                "nace_r2": code,
                "geo": raw["geo"],
                "TIME_PERIOD": int(raw["TIME_PERIOD"]),
                "OBS_VALUE": float(raw["OBS_VALUE"]) if raw["OBS_VALUE"] else None,
                "OBS_FLAG": raw["OBS_FLAG"] or None,
                "CONF_STATUS": raw["CONF_STATUS"] or None,
            }


def value(column, text):
    if text == "":
        return None
    if column in INTEGERS:
        return int(text)
    if column in FLOATS:
        return float(text)
    return text


def rows(table, keep):
    with open(os.path.join(ROOT, table + ".csv"), newline="", encoding="utf-8") as f:
        for raw in csv.DictReader(f):
            row = {column: value(column, text) for column, text in raw.items()}
            if keep(row):
                yield row


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, table, keep in EXTRACTS:
        extract = list(rows(table, keep))
        with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(extract, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{name}.json: {len(extract):,} rows of {table}.csv")
    extract = list(eurostat_rows())
    with open(os.path.join(OUT, "eurostat_ai.json"), "w", encoding="utf-8") as f:
        json.dump(extract, f, ensure_ascii=False, separators=(",", ":"))
    print(f"eurostat_ai.json: {len(extract):,} rows of {os.path.basename(EUROSTAT)}")


if __name__ == "__main__":
    main()
