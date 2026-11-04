#!/usr/bin/env python3
"""Build the dashboard's map file from Eurostat's NUTS 2024 boundaries.

    python3 dashboard/build_map.py [NUTS2JSON_DIR]

Reads the NUTS 2024 region polygons that Eurostat publishes in Nuts2json
(https://github.com/eurostat/Nuts2json, ETRS89-LAEA / EPSG:3035, 1:10 million),
keeps Belgium, France, Germany and Luxembourg at NUTS levels 0-3 plus the
neighbouring countries for context, and writes dashboard/data/nuts_geo.json:
one row per shape, with its outline as an SVG path in kilometres. NUTS2JSON_DIR
is a local copy of the repository; without it the files are downloaded.

The French outermost regions are not in Eurostat's European frame and are left
out. Boundaries: (c) EuroGeographics for the administrative boundaries. Eurostat's
terms for its NUTS geodata (credit, non-commercial use) apply to nuts_geo.json,
not this repository's CC BY 4.0 licence.
"""

import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dashboard", "data", "nuts_geo.json")
SOURCE = "pub/v2/2024/3035/10M/"
URL = "https://raw.githubusercontent.com/eurostat/Nuts2json/master/" + SOURCE
COUNTRIES = {"BE", "DE", "FR", "LU"}
PAD = 25_000  # metres of margin around the four countries
STEP = 0.5  # km: coordinates are rounded to this grid, well below a pixel on screen


def load(name, folder):
    if folder:
        with open(os.path.join(folder, SOURCE, name), encoding="utf-8") as f:
            return json.load(f)
    with urllib.request.urlopen(URL + name) as res:
        return json.load(res)


def polygons(geometry):
    return geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]


def clip(ring, x0, y0, x1, y1):
    """Sutherland-Hodgman: cut a ring to the frame rectangle."""
    edges = [
        (lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
        (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1)),
    ]
    points = ring
    for inside, cross in edges:
        if not points:
            break
        out = []
        for i, b in enumerate(points):
            a = points[i - 1]
            if inside(b):
                if not inside(a):
                    out.append(cross(a, b))
                out.append(b)
            elif inside(a):
                out.append(cross(a, b))
        points = out
    return points


def number(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    s = s.replace("-0.", "-.") if s.startswith("-0.") else s.replace("0.", ".", 1) if s.startswith("0.") else s
    return "0" if s in ("-0", "") else s


def path(rings, frame):
    """Rings in EPSG:3035 metres to a compact SVG path in km, y pointing down."""
    x0, y1 = frame[0], frame[3]
    out = []
    for ring in rings:
        pts = []
        for x, y in ring:
            p = (round((x - x0) / 1000 / STEP) * STEP, round((y1 - y) / 1000 / STEP) * STEP)
            if not pts or p != pts[-1]:
                pts.append(p)
        if len(pts) > 1 and pts[0] == pts[-1]:
            pts.pop()
        if len(set(pts)) < 3:
            continue
        seg = ["M" + number(pts[0][0]) + "," + number(pts[0][1])]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            dx, dy = bx - ax, by - ay
            seg.append("l" + number(dx) + ("," if dy >= 0 else "") + number(dy))
        out.append("".join(seg) + "z")
    return "".join(out)


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else None
    levels = [load(f"nutsrg_{level}.json", folder)["features"] for level in range(4)]
    ours = [[f for f in features if f["properties"]["id"][:2] in COUNTRIES] for features in levels]

    xs, ys = [], []
    for f in ours[0]:
        for poly in polygons(f["geometry"]):
            xs += [p[0] for p in poly[0]]
            ys += [p[1] for p in poly[0]]
    frame = (min(xs) - PAD, min(ys) - PAD, max(xs) + PAD, max(ys) + PAD)
    w, h = (frame[2] - frame[0]) / 1000, (frame[3] - frame[1]) / 1000

    rows = [{"layer": "frame", "id": "frame", "level": None, "name": "Map frame", "d": f"M0,0H{w:.1f}V{h:.1f}H0z", "w": round(w, 1), "h": round(h, 1)}]
    for f in load("cntrg.json", folder)["features"]:
        props = f["properties"]
        if props["id"] in COUNTRIES:
            continue
        rings = [clip(poly[0], *frame) for poly in polygons(f["geometry"])]
        d = path([r for r in rings if len(r) > 2], frame)
        if d:
            rows.append({"layer": "context", "id": props["id"], "level": None, "name": props["na"].strip(), "d": d, "w": None, "h": None})
    for level, features in enumerate(ours):
        for f in sorted(features, key=lambda f: f["properties"]["id"]):
            props = f["properties"]
            rings = [ring for poly in polygons(f["geometry"]) for ring in poly]
            rows.append({"layer": "region", "id": props["id"], "level": level, "name": props["na"].strip(), "d": path(rings, frame), "w": None, "h": None})

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    regions = sum(1 for r in rows if r["layer"] == "region")
    print(f"nuts_geo.json: {regions} regions, {len(rows) - regions - 1} neighbouring countries, frame {w:.0f} x {h:.0f} km")


if __name__ == "__main__":
    main()
