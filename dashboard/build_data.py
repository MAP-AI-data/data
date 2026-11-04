#!/usr/bin/env python3
"""Build the dashboard's data files from this repository's tables.

    python3 dashboard/build_data.py

Reads the CSV tables in the repository root and writes JSON extracts to
dashboard/data/. Each extract is a filtered subset of one table that keeps the
table's own columns and values (empty cells become null), so every number on the
dashboard traces back to a row of a published table. Uses only the standard
library. names.json (industry and region names) is maintained by hand and is
not touched.
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


if __name__ == "__main__":
    main()
