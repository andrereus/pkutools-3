#!/usr/bin/env python3
"""Fill the app's USDA food list with nutrient values from FoodData Central.

Reads data-src/FoodData_Central_sr_legacy_food_json_2018-04.json (not
committed; free download at https://fdc.nal.usda.gov/download-datasets, "SR
Legacy" as JSON, public domain) and rewrites public/data/usda-phe-kcal.json
plus public/data/usda-phe-kcal.csv (the same rows, for auditing). SR Legacy is
the final release of that database, so there is no newer file to fetch.

The USDA publishes English names only. The German, Spanish and French names
and the emoji exist nowhere but in usda-phe-kcal.json, which is committed, so
that file is both input and output: its foods, names and emoji are kept, and
every number is read fresh from the download. Foods are matched by their NDB
number, which is the "id".

Foods whose Phe reads 0 although they demonstrably contain protein are dropped
rather than shown with an unsafe value (a false 0 is the most dangerous error
in a PKU app). The rule is the one scripts/bls-convert.py applies: more than
0.5 g protein, or two or more other amino acids measured. Any real protein
contains phenylalanine, so that 0 is a gap in the data. Genuine zeros (oils,
spirits, water, salt) have neither and are kept. The rule is evaluated on the
download rather than on the list, so scripts/usda-dropped-foods.txt names the
removed foods on every run, also once they have left the list.

Values are per 100 g edible portion. Phe, kcal, protein, fat, sugar and fiber
are taken over unchanged. Two fields are calculated, because the USDA does not
publish them in the form the app and the BLS use:

  salt   Sodium x 2.5, the salt equivalent as Regulation (EU) No 1169/2011
         defines it for food labels. The USDA lists sodium only.
  carbs  "Carbohydrate, by difference" minus total dietary fiber. The USDA
         figure includes fiber; EU labels and the BLS state the available
         carbohydrates without it, and the app lists fiber on a row of its
         own. Where fiber was not determined the subtraction is impossible
         and carbs stays empty, unless the food has no carbohydrates at all.

A nutrient the USDA did not determine is left empty rather than written as 0;
the app then leaves that row out instead of claiming the food contains none.

Uses only the Python standard library: python3 scripts/usda-convert.py
"""

import csv
import json
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data-src" / "FoodData_Central_sr_legacy_food_json_2018-04.json"
OUT_JSON = ROOT / "public" / "data" / "usda-phe-kcal.json"
OUT_CSV = ROOT / "public" / "data" / "usda-phe-kcal.csv"
OUT_DROPPED = ROOT / "scripts" / "usda-dropped-foods.txt"

LOCALES = ["en", "de", "es", "fr"]

# FoodData Central nutrient id -> (working name, unit the download must use).
# The unit is asserted because every conversion below depends on it.
SOURCE_NUTRIENTS = {
    1217: ("phe", "g"),  # Phenylalanine
    1008: ("kcal", "kcal"),  # Energy
    1003: ("protein", "g"),  # Protein
    1004: ("fat", "g"),  # Total lipid (fat)
    1005: ("carbs_total", "g"),  # Carbohydrate, by difference
    2000: ("sugar", "g"),  # Total Sugars
    1079: ("fiber", "g"),  # Fiber, total dietary
    1093: ("sodium", "mg"),  # Sodium, Na
}

# Output fields in file order (g per 100 g, kcal in kcal). Phe and kcal are
# required; the others may be empty.
FIELDS = ["phe", "kcal", "protein", "fat", "carbs", "sugar", "fiber", "salt"]
REQUIRED = ["phe", "kcal"]

# mg sodium -> g salt
SODIUM_MG_TO_SALT_G = Decimal("2.5") / 1000

# FoodData Central ids of the 17 amino acids listed besides Phe (tryptophan
# 1210 to serine 1227, without phenylalanine 1217). Used only to detect
# implausible Phe zeros — never written to the output.
OTHER_AMINO_ACIDS = set(range(1210, 1228)) - {1217}

# A Phe of 0 is a data error, not a natural zero, when the food demonstrably
# contains mixed protein. Same thresholds as in scripts/bls-convert.py.
IMPLAUSIBLE_ZERO_MIN_PROTEIN = Decimal("0.5")
IMPLAUSIBLE_ZERO_MIN_OTHER_AMINO_ACIDS = 2


def read_amounts(food):
    """The food's values for SOURCE_NUTRIENTS, as exact decimals."""
    amounts = {}
    for entry in food["foodNutrients"]:
        nutrient = entry["nutrient"]
        spec = SOURCE_NUTRIENTS.get(nutrient["id"])
        if spec is None or "amount" not in entry:
            continue
        name, unit = spec
        label = f"{food['ndbNumber']} {food['description']}: {nutrient['name']}"
        if nutrient["unitName"] != unit:
            sys.exit(f"{label} is in {nutrient['unitName']}, expected {unit}")
        if name in amounts:
            sys.exit(f"{label} is listed twice")
        # Through str() so 66.27 stays 66.27 instead of its binary neighbour;
        # the two calculated fields would otherwise pick up rounding noise.
        amounts[name] = Decimal(str(entry["amount"]))
    return amounts


def has_implausible_zero_phe(food, amounts):
    if amounts.get("phe") != 0:
        return False
    other_amino_acids = sum(
        1 for entry in food["foodNutrients"]
        if entry["nutrient"]["id"] in OTHER_AMINO_ACIDS and entry.get("amount", 0) > 0
    )
    return (amounts.get("protein", 0) > IMPLAUSIBLE_ZERO_MIN_PROTEIN
            or other_amino_acids >= IMPLAUSIBLE_ZERO_MIN_OTHER_AMINO_ACIDS)


def available_carbs(amounts):
    total, fiber = amounts.get("carbs_total"), amounts.get("fiber")
    if total is None:
        return None
    if fiber is None:
        return total if total == 0 else None
    return total - fiber


def to_number(value):
    """Whole numbers as int, so the files read 109 rather than 109.0."""
    if value is None:
        return None
    return int(value) if value == value.to_integral_value() else float(value)


def main():
    for path in (SOURCE, OUT_JSON):
        if not path.exists():
            sys.exit(f"File not found: {path}")

    with open(SOURCE, encoding="utf-8") as f:
        source = {int(food["ndbNumber"]): food for food in json.load(f)["SRLegacyFoods"]}
    with open(OUT_JSON, encoding="utf-8") as f:
        listed = json.load(f)

    source_amounts = {ndb: read_amounts(food) for ndb, food in source.items()}
    dropped = {ndb: f"{ndb} {food['description']}" for ndb, food in sorted(source.items())
               if has_implausible_zero_phe(food, source_amounts[ndb])}

    items = []
    empty = Counter()
    for entry in listed:
        label = f"{entry['id']} {entry['en']}"
        if entry["id"] not in source:
            sys.exit(f"Not in the download: {label}")
        if entry["id"] in dropped:
            continue
        amounts = source_amounts[entry["id"]]
        sodium = amounts.get("sodium")
        values = {
            **amounts,
            "carbs": available_carbs(amounts),
            "salt": None if sodium is None else sodium * SODIUM_MG_TO_SALT_G,
        }
        item = {"id": entry["id"], **{locale: entry[locale] for locale in LOCALES}}
        for field in FIELDS:
            item[field] = to_number(values.get(field))
            if item[field] is None:
                if field in REQUIRED:
                    sys.exit(f"No {field} value in the download: {label}")
                empty[field] += 1
        item["emoji"] = entry["emoji"]
        items.append(item)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2, separators=(",", ":"))
        f.write("\n")

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        # The csv module defaults to CRLF, which makes git report every row as
        # trailing whitespace (`git diff --check`).
        writer = csv.DictWriter(f, fieldnames=list(items[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(items)

    # Record exactly which foods were removed, so the drop rule is auditable.
    with open(OUT_DROPPED, "w", encoding="utf-8") as f:
        f.write(f"# Implausible Phe = 0 (protein > {IMPLAUSIBLE_ZERO_MIN_PROTEIN} g or "
                f">= {IMPLAUSIBLE_ZERO_MIN_OTHER_AMINO_ACIDS} other amino acids present): "
                f"{len(dropped)}\n")
        f.write("\n".join(dropped.values()))
        f.write("\n")

    print(f"{len(items)} foods written to {OUT_JSON.name} and {OUT_CSV.name}")
    print("left empty (not determined):",
          ", ".join(f"{field} {empty[field]}" for field in FIELDS if empty[field]) or "nothing")
    print(f"{len(dropped)} foods dropped: implausible Phe = 0 (see {OUT_DROPPED.name})")

    # Foods the list could still take: they have a Phe value but no translated
    # names or emoji yet, so they are reported rather than added.
    listed_ids = {entry["id"] for entry in listed}
    unlisted = [f"{ndb} {food['description']}" for ndb, food in source.items()
                if ndb not in listed_ids and ndb not in dropped
                and "phe" in source_amounts[ndb]]
    if unlisted:
        print(f"{len(unlisted)} foods with a Phe value are in the download but not in the "
              f"list: {'; '.join(unlisted[:5])}{' ...' if len(unlisted) > 5 else ''}")


if __name__ == "__main__":
    main()
