#!/usr/bin/env python3
"""Convert the BLS 4.0 xlsx export into the app's food database format.

Reads data-src/BLS_4_0_2025_DE/BLS_4_0_Daten_2025_DE.xlsx (not committed; free
download at https://blsdb.de after registration, © Max Rubner-Institut) and
writes public/data/bls-nutrients.csv and public/data/bls-nutrients.json.

Nutrient values are taken over unchanged from the BLS (per 100 g edible
portion). The only transformation is decoding the raw IEEE-754 doubles stored
in the xlsx back to their shortest decimal representation (what Excel
displays), e.g. "9.3000000000000007" -> 9.3. Only the emoji column is added.

Two kinds of food are dropped rather than shown with an unsafe Phe value (a
false 0 is the most dangerous error in a PKU app), and the full list of what
was removed is written to scripts/bls-dropped-foods.txt for auditing:

  1. Phe not determined: the BLS marks it "-". No value can be shown.
  2. Implausible Phe = 0: the BLS stores literal 0 while the food clearly
     contains protein (> 0.5 g, or two or more other amino acids measured).
     Any real protein contains phenylalanine, so this 0 is a data error — the
     BLS should have written "-" but wrote 0. Genuine zeros (oils, sugar,
     spirits, water, salt, single-amino-acid additives like MSG) have no
     protein/amino-acid profile and are kept, as are trace markers.

Uses only the Python standard library: python3 scripts/bls-convert.py
"""

import csv
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data-src" / "BLS_4_0_2025_DE" / "BLS_4_0_Daten_2025_DE.xlsx"
OUT_CSV = ROOT / "public" / "data" / "bls-nutrients.csv"
OUT_JSON = ROOT / "public" / "data" / "bls-nutrients.json"
OUT_DROPPED = ROOT / "scripts" / "bls-dropped-foods.txt"

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

# BLS component code -> output field (values per 100 g, units as in the BLS:
# phe/protein/fat/carbs/sugar/fiber/salt in g, kcal in kcal)
NUTRIENTS = [
    ("PHE", "phe"),
    ("ENERCC", "kcal"),
    ("PROT625", "protein"),
    ("FAT", "fat"),
    ("CHO", "carbs"),
    ("SUGAR", "sugar"),
    ("FIBT", "fiber"),
    ("NACL", "salt"),
]


def load_shared_strings(zf):
    strings = []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    for si in root.iter(f"{NS}si"):
        strings.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    return strings


def col_index(cell_ref):
    letters = re.match(r"[A-Z]+", cell_ref).group()
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def iter_rows(path):
    """Stream rows of sheet1 as lists (str values as stored, or None)."""
    zf = zipfile.ZipFile(path)
    shared = load_shared_strings(zf)
    with zf.open("xl/worksheets/sheet1.xml") as f:
        row = None
        for event, elem in ET.iterparse(f, events=("start", "end")):
            if event == "start" and elem.tag == f"{NS}row":
                row = []
            elif event == "end" and elem.tag == f"{NS}c":
                ctype = elem.get("t", "n")
                v = elem.find(f"{NS}v")
                if v is None or v.text is None:
                    value = None
                elif ctype == "s":
                    value = shared[int(v.text)]
                else:
                    value = v.text
                idx = col_index(elem.get("r", "")) if elem.get("r") else len(row)
                while len(row) < idx:
                    row.append(None)
                row.append(value)
                elem.clear()
            elif event == "end" and elem.tag == f"{NS}row":
                yield row
                elem.clear()


# Non-numeric BLS value markers: below limit of detection/quantification and
# trace amounts count as 0 (food-composition convention); "-" means the value
# was not determined and stays empty (foods without a Phe value are dropped —
# a made-up 0 would be unsafe in a PKU app).
TRACE_MARKERS = {"<LOD", "<LOQ", "<LOD or <LOQ", "TR"}

# The 17 amino acids the BLS lists besides Phe. Used only to detect implausible
# Phe zeros — never written to the output. Component codes -> value columns are
# resolved from the header at runtime.
OTHER_AMINO_ACIDS = [
    "ALA", "ARG", "ASP", "CYSTE", "GLU", "GLY", "HIS", "ILE", "LEU", "LYS",
    "MET", "PRO", "SER", "THR", "TRP", "TYR", "VAL",
]

# A Phe of literal "0" is a data error, not a natural zero, when the food
# demonstrably contains mixed protein — either >0.5 g protein, or two or more
# other amino acids measured (any real protein must contain Phe). Such foods
# are dropped: the BLS should have marked Phe as "-" (not determined) but wrote
# 0 instead, and a false 0 is the most dangerous error in a PKU app. Genuine
# zeros (oils, sugar, spirits, water, salt, and single-amino-acid additives
# such as monosodium glutamate) have no protein or amino-acid profile and are
# kept. Trace markers are NOT literal zeros and are always kept.
IMPLAUSIBLE_ZERO_MIN_PROTEIN = 0.5
IMPLAUSIBLE_ZERO_MIN_OTHER_AMINO_ACIDS = 2


def to_number(raw):
    """Shortest decimal that round-trips to the stored double (Excel display)."""
    if raw is None or raw == "-":
        return None
    if raw in TRACE_MARKERS:
        return 0
    value = float(raw)
    return int(value) if value == int(value) else value


def amino_acid_count(row, amino_columns):
    """How many of the other amino acids are present (> 0) for this row."""
    count = 0
    for col in amino_columns:
        value = to_number(row[col]) if col < len(row) else None
        if value:
            count += 1
    return count


# --- Emoji assignment -------------------------------------------------------
# First match wins: rules of the food's BLS main group (first letter of the
# BLS code), then shared rules, then the group's fallback. Patterns are
# regexes matched case-insensitively against the German food name.

SHARED_RULES = [
    # dishes & prepared
    (r"pizza", "🍕"),
    (r"burger|hot dog", "🍔"),
    (r"suppe|brühe|bouillon|bouillabaisse|fond|consommé|eintopf|gulasch"
     r"|ragout|labskaus", "🍲"),
    (r"spaghetti|makkaroni|lasagne|nudel|teigwaren|tortellini|ravioli|pasta", "🍝"),
    (r"pommes|kroketten", "🍟"),
    (r"kartoffel", "🥔"),
    (r"\breis\b|risotto|paella|wildreis", "🍚"),
    (r"milchreis|grießbrei", "🍮"),
    # sweets & baked
    (r"schokolade|schoko|nougat|praline|kakao", "🍫"),
    (r"honig", "🍯"),
    (r"konfitüre|marmelade|gelee\b", "🍓"),
    (r"kuchen(?!brot)|torte", "🍰"),
    (r"keks|plätzchen|lebkuchen", "🍪"),
    (r"waffel", "🧇"),
    (r"(?<![rR])eis\b|eiscreme|sorbet|parfait", "🍨"),
    (r"kaffee|espresso|mokka(?!creme)", "☕"),
    # eggs, dairy, cheese
    (r"\beier|\bei\b|hühnerei|eigelb|eiklar|omelett|rührei|spiegelei", "🥚"),
    (r"käse|gouda|edamer|emmentaler|camembert|brie|mozzarella|feta|parmesan"
     r"|quark", "🧀"),
    (r"butter(?!milch|blume)", "🧈"),
    (r"joghurt|jogurt|milch|sahne|rahm|kefir|drink", "🥛"),
    # fish & seafood
    (r"garnele|shrimp|krabbe|hummer|languste|scampi|krebs|meeresfrüchte", "🦐"),
    (r"tintenfisch|kalmar|sepia|krake|oktopus", "🦑"),
    (r"auster|muschel|schnecke", "🦪"),
    (r"fisch|lachs|forelle|hering|matjes|rollmops|kabeljau|dorsch|scholle"
     r"|seelachs|seezunge|zander|hecht|karpfen|barsch|makrele|sardine|sardelle"
     r"|thunfisch|rotbarsch|schellfisch|steinbutt|heilbutt|sprotte|schleie"
     r"|renke|\baal\b|kaviar", "🐟"),
    # sausage & meat (wurst before offal so Leberwurst stays a sausage)
    (r"wurst|würst|wiener|salami|knacker", "🌭"),
    (r"speck|bacon", "🥓"),
    (r"schinken", "🍖"),
    (r"huhn|hühner|hähnchen|pute|truthahn|gans|ente(?!nmuschel)|geflügel"
     r"|wachtel", "🍗"),
    (r"leber|\bherz|zunge|niere|bries|innereien|kutteln", "🍖"),
    (r"\breh|hirsch|\bwild(?!reis)|\bhase|kaninchen", "🍖"),
    (r"schnitzel|braten|steak|frikadelle|boulette|roulade|kotelett|geschmort"
     r"|schmor|klopse|eisbein|kasseler|tafelspitz|saumagen", "🍖"),
    (r"rind|schwein|kalb|lamm|hammel|ziege|hack|fleisch|mett", "🥩"),
    # mushrooms, vegetables
    (r"pilz|champignon|pfifferling|morchel|shiitake", "🍄"),
    (r"tomate", "🍅"),
    (r"karotte|möhre|mohrrübe", "🥕"),
    (r"blumenkohl|brokkoli|broccoli", "🥦"),
    (r"spinat|kohl|kraut(?!er)|wirsing|mangold|salat", "🥬"),
    (r"erbse", "🫛"),
    (r"bohne|linse|tofu|soja", "🫘"),
    (r"zucchini|gurke", "🥒"),
    (r"kürbis", "🎃"),
    (r"paprika", "🫑"),
    (r"zwiebel|lauch|porree", "🧅"),
    (r"knoblauch", "🧄"),
    (r"aubergine", "🍆"),
    (r"mais(?!chen)", "🌽"),
    (r"avocado", "🥑"),
    (r"spargel|sellerie|fenchel|rübe|rote bete|rote-bete|chicoree"
     r"|schwarzwurzel|topinambur|okra|romanesco|artischocke|bambus|kohlrabi"
     r"|radieschen|rettich|pastinake", "🥕"),
    (r"gemüse|ratatouille|allerlei", "🥬"),
    # nuts & seeds
    (r"erdnuss|nuss|mandel|pistazie|cashew|pekan|macadamia", "🥜"),
    (r"kastanie|marone|sesam|mohn|leinsamen|chia|sonnenblumenkern|kürbiskern"
     r"|\bkern", "🌰"),
    # fruit
    (r"banane", "🍌"),
    (r"apfel(?!sine)|äpfel", "🍎"),
    (r"erdbeer", "🍓"),
    (r"kirsche|kirsch(?!wasser)", "🍒"),
    (r"himbeer|heidelbeer|blaubeer|brombeer|johannisbeer|preiselbeer"
     r"|stachelbeer|holunder|cranberr", "🫐"),
    (r"traube", "🍇"),
    (r"pfirsich|nektarine|aprikose|pflaume|zwetsch|mirabelle", "🍑"),
    (r"birne", "🍐"),
    (r"orange|apfelsine|mandarine|clementine|grapefruit|pampelmuse", "🍊"),
    (r"zitrone|limette", "🍋"),
    (r"ananas", "🍍"),
    (r"mango\b|papaya", "🥭"),
    (r"kokos", "🥥"),
    (r"wassermelone", "🍉"),
    (r"melone", "🍈"),
    (r"rhabarber", "🥬"),
    (r"saft|nektar|schorle|smoothie", "🧃"),
    (r"frucht|obst|tutti", "🍇"),
    (r"sülze", "🍖"),
    # grains & bread (bread first so Weizenbrot stays bread)
    (r"brot(?!frucht)|brötchen|toast|baguette|grissini", "🍞"),
    (r"flocken|müsli|porridge|hafer|buchweizen", "🥣"),
    (r"couscous|bulgur|quinoa|hirse|grünkern|graupen|dinkel|grieß|getreide"
     r"|weizen|teig\b", "🌾"),
    # sauces & dips (late so main-ingredient rules win first)
    (r"sauce|soße|salsa|aioli|mayonnaise|remoulade|dressing|ketchup"
     r"|schaum", "🥫"),
]

GROUP_RULES = {
    # Bread & small baked goods
    "B": [
        (r"brezel|laugen", "🥨"),
        (r"croissant", "🥐"),
        (r"baguette", "🥖"),
        (r"bagel", "🥯"),
        (r"brötchen|semmel|weck", "🥖"),
        (r"toast", "🍞"),
    ],
    # Cereals & grain products
    "C": [
        (r"mais|popcorn|cornflakes", "🌽"),
        (r"müsli|flocken|porridge|brei|cerealien|crispies", "🥣"),
        (r"kleie|keim|mehl|grieß|schrot|stärke|graupen", "🌾"),
    ],
    # Long-life bakery & pastries
    "D": [
        (r"waffel", "🧇"),
        (r"brezel|salzstangen|laugen|cracker|kräcker", "🥨"),
        (r"croissant|plunder|blätterteig", "🥐"),
        (r"berliner|krapfen|donut|spritzkuchen", "🍩"),
        (r"muffin|cupcake", "🧁"),
        (r"strudel|tarte|\bpie\b", "🥧"),
        (r"kuchen|torte|stollen|biskuit|baiser|windbeutel|brandteig|brandmasse"
         r"|eclair", "🍰"),
        (r"keks|plätzchen|zwieback|lebkuchen|spekulatius|makrone|printen", "🍪"),
    ],
    # Eggs & pasta
    "E": [],
    # Fruit
    "F": [
        (r"saft|nektar|smoothie", "🧃"),
        (r"granatapfel|kaki|sharon|feige|dattel|passionsfrucht|maracuja", "🥭"),
        (r"birne|quitte", "🍐"),
        (r"himbeere|brombeere|heidelbeere|blaubeere|johannisbeere|preiselbeere"
         r"|holunderbeere|stachelbeere|sanddorn|hagebutte|beere", "🫐"),
        (r"traube|rosine|sultanine|korinthe", "🍇"),
        (r"zitrone|limette", "🍋"),
        (r"orange|apfelsine|mandarine|clementine|grapefruit|pampelmuse|kumquat", "🍊"),
        (r"pfirsich|nektarine|aprikose|pflaume|zwetsch|mirabelle|reneklode", "🍑"),
        (r"wassermelone", "🍉"),
        (r"melone", "🍈"),
        (r"ananas", "🍍"),
        (r"mango|papaya|guave|litschi|cherimoya|kaktusfeige", "🥭"),
        (r"kiwi", "🥝"),
        (r"kokos", "🥥"),
        (r"avocado", "🥑"),
        (r"olive", "🫒"),
        (r"rhabarber", "🥬"),
        (r"banane", "🍌"),
    ],
    # Vegetables
    "G": [
        (r"saft", "🧃"),
        (r"tomate", "🍅"),
        (r"karotte|möhre|mohrrübe", "🥕"),
        (r"paprika", "🫑"),
        (r"chili|peperoni", "🌶️"),
        (r"gurke", "🥒"),
        (r"zucchini", "🥒"),
        (r"aubergine", "🍆"),
        (r"brokkoli|blumenkohl|romanesco", "🥦"),
        (r"mais", "🌽"),
        (r"zwiebel|lauch|porree|schalotte", "🧅"),
        (r"knoblauch|bärlauch", "🧄"),
        (r"kürbis", "🎃"),
        (r"erbse|zuckerschote", "🫛"),
        (r"bohne|linse", "🫘"),
        (r"olive", "🫒"),
        (r"ingwer", "🫚"),
        (r"kartoffel|süßkartoffel", "🥔"),
        (r"avocado", "🥑"),
        (r"spargel|sellerie|fenchel|kohlrabi|radieschen|rettich|rübe|topinambur"
         r"|schwarzwurzel|pastinake|artischocke|bambus|palmherzen", "🥕"),
    ],
    # Legumes, soy products, nuts, seeds, sprouts
    "H": [
        (r"sprossen|keimling", "🌱"),
        (r"drink", "🥛"),
        (r"tofu|soja|tempeh|seitan", "🫘"),
        (r"erdnuss|nuss|mandel|pistazie|cashew|pekan|macadamia|kokos", "🥜"),
        (r"kastanie|marone|sesam|mohn|lein|chia|kern|samen|saat", "🌰"),
    ],
    # Potatoes & starches
    "K": [
        (r"pommes|chips|rösti|puffer", "🍟"),
        (r"kloß|klöße|knödel|gnocchi|schupfnudel", "🥟"),
        (r"maniok|cassava|tapioka|yamswurzel|taro|batate|süßkartoffel", "🥔"),
        (r"stärke|mehl|sago", "🌾"),
    ],
    # Milk & dairy
    "M": [
        (r"butter(?!milch)", "🧈"),
        (r"eis|sorbet", "🍨"),
        (r"pudding|flammeri|dessert|grießbrei|milchreis|mousse|creme", "🍮"),
        (r"joghurt|jogurt|kefir|dickmilch|buttermilch|molke|sauermilch", "🥛"),
        (r"quark|frischkäse|hüttenkäse", "🧀"),
        (r"sahne|rahm|schmand|crème", "🥛"),
    ],
    # Non-alcoholic beverages
    "N": [
        (r"kaffee|espresso|cappuccino|mokka", "☕"),
        (r"eistee", "🥤"),
        (r"\btee\b|tee\b|kräutertee|früchtetee|matetee", "🍵"),
        (r"wasser", "💧"),
        (r"saft|nektar|schorle|smoothie|most", "🧃"),
        (r"limonade|cola|brause|energ", "🥤"),
        (r"kakao|trinkschokolade|malz", "☕"),
    ],
    # Alcoholic beverages
    "P": [
        (r"bier|malzbier|ale|porter", "🍺"),
        (r"sekt|champagner|prosecco", "🥂"),
        (r"wein(?!brand)|glühwein|apfelwein|cidre|cider|sherry|portwein|wermut", "🍷"),
        (r"likör|cocktail|punsch|bowle|aperitif", "🍸"),
        (r"korn|wodka|rum|whisky|gin|tequila|weinbrand|obstbrand|obstler"
         r"|branntwein|schnaps|spirituose|cognac|calvados|grappa|ouzo|absinth"
         r"|kirschwasser", "🥃"),
    ],
    # Fats & oils
    "Q": [
        (r"käse", "🧀"),
        (r"olivenöl", "🫒"),
        (r"öl", "🫗"),
        (r"butter|margarine|schmalz|talg|fett", "🧈"),
    ],
    # Condiments, seasonings, baking ingredients
    "R": [
        (r"salz", "🧂"),
        (r"essig", "🫙"),
        (r"senf|ketchup|mayonnaise|remoulade|dressing|sauce|soße|dip|chutney"
         r"|tomatenmark|paste", "🥫"),
        (r"petersilie|dill|schnittlauch|basilikum|kräuter|minze|rosmarin|thymian"
         r"|oregano|salbei|estragon|kerbel|koriander|lorbeer", "🌿"),
        (r"pfeffer|curry|zimt|muskat|kümmel|anis|nelke|kardamom|safran|vanille"
         r"|paprika|chili|ingwer|kurkuma|gewürz", "🌶️"),
        (r"hefe|backpulver|gelatine|pektin|verdickung", "🌾"),
        (r"brotaufstrich|aufstrich", "🥫"),
        (r"creme|krem", "🍰"),
    ],
    # Sugar, sweets, ice cream
    "S": [
        (r"eis|sorbet|parfait", "🍨"),
        (r"konfitüre|marmelade|gelee|fruchtaufstrich|pflaumenmus|apfelkraut", "🍓"),
        (r"sirup|dicksaft|melasse", "🍯"),
        (r"marzipan|krokant|halva", "🍬"),
        (r"bonbon|karamell|gummi|lakritz|dragee|kaubonbon|brausepulver"
         r"|schaumkuss|schokokuss", "🍬"),
        (r"müsliriegel|riegel", "🍫"),
        (r"zucker|süßstoff|fondant", "🍬"),
    ],
    # Fish & seafood
    "T": [
        (r"garnele|shrimp|krabbe|hummer|languste|scampi|krebs|flusskrebs", "🦐"),
        (r"tintenfisch|kalmar|sepia|krake|oktopus", "🦑"),
        (r"auster|muschel|schnecke", "🦪"),
        (r"kaviar|rogen", "🐟"),
    ],
    # Meat (red meat cuts)
    "U": [
        (r"speck|bacon", "🥓"),
        (r"schinken", "🍖"),
        (r"knochen|rippe", "🦴"),
    ],
    # Poultry, game, offal
    "V": [
        (r"huhn|hühner|hähnchen|hahn|pute|truthahn|gans|ente|geflügel|wachtel"
         r"|taube|strauß|poularde|suppenhuhn", "🍗"),
        (r"leber|niere|herz|zunge|hirn|bries|magen|innereien|blut|lunge|milz"
         r"|euter|pansen", "🍖"),
        (r"pastete|paste", "🍖"),
    ],
    # Sausages & processed meat
    "W": [
        (r"schinken(?!wurst)", "🍖"),
        (r"speck|bacon", "🥓"),
    ],
    # Dishes & prepared foods (X: mostly savory dishes, Y: menus/composites)
    "X": [
        (r"salat", "🥗"),
        (r"^\S*(sauce|soße)|mayonnaise|remoulade|dressing|ketchup|pesto|dip\b", "🥫"),
        (r"sandwich|belegt", "🥪"),
        (r"döner|kebab|gyros|schawarma", "🥙"),
        (r"wrap|burrito|enchilada|fajita", "🌯"),
        (r"taco", "🌮"),
        (r"sushi|maki", "🍣"),
        (r"curry", "🍛"),
        (r"frühlingsrolle|maultasche|wan tan|dim sum|kloß|klöß|knödel", "🥟"),
        (r"pfannkuchen|crêpe|eierkuchen|palatschinke|kaiserschmarrn", "🥞"),
        (r"auflauf|gratin|moussaka|pfanne|ragout|gulasch|geschnetzelt|frikassee"
         r"|chili (con|sin) carne", "🍲"),
        (r"pastete|quiche", "🥧"),
        (r"püree|brei|kaltschale", "🥣"),
        (r"tsatsiki|zaziki", "🥒"),
    ],
    "Y": [
        (r"salat", "🥗"),
        (r"^\S*(sauce|soße)|mayonnaise|remoulade|dressing", "🥫"),
        (r"sandwich|belegt", "🥪"),
        (r"döner|kebab|gyros", "🥙"),
        (r"sushi|maki", "🍣"),
        (r"curry", "🍛"),
        (r"kloß|klöß|knödel|maultasche|frühlingsrolle", "🥟"),
        (r"pfannkuchen|crêpe|eierkuchen|kaiserschmarrn|waffel", "🥞"),
        (r"pudding|mousse|dessert|kompott|grütze|creme|crème|tiramisu"
         r"|pannacotta|zabaione|charlotte|schnee\b", "🍮"),
        (r"scheiterhaufen|savarin|plotzer|michel|baba\b", "🍰"),
        (r"auflauf|gratin|moussaka|pfanne|risotto|frikassee|topf", "🍲"),
    ],
}

GROUP_FALLBACK = {
    "B": "🍞",  # bread
    "C": "🌾",  # cereals
    "D": "🍪",  # pastries
    "E": "🍝",  # pasta
    "F": "🍇",  # fruit
    "G": "🥬",  # vegetables
    "H": "🫘",  # legumes
    "K": "🥔",  # potatoes
    "M": "🥛",  # dairy
    "N": "🥤",  # beverages
    "P": "🍸",  # alcohol
    "Q": "🧈",  # fats
    "R": "🧂",  # condiments
    "S": "🍬",  # sweets
    "T": "🐟",  # fish
    "U": "🥩",  # meat
    "V": "🍖",  # poultry/game/offal
    "W": "🌭",  # sausage
    "X": "🍽️",  # dishes
    "Y": "🍽️",  # dishes
}


def compile_rules():
    compiled = {}
    for group, rules in GROUP_RULES.items():
        compiled[group] = [(re.compile(p, re.I), e) for p, e in rules]
    shared = [(re.compile(p, re.I), e) for p, e in SHARED_RULES]
    return compiled, shared


def assign_emoji(code, name_de, group_rules, shared_rules):
    group = code[0]
    for rx, emoji in group_rules.get(group, []):
        if rx.search(name_de):
            return emoji
    for rx, emoji in shared_rules:
        if rx.search(name_de):
            return emoji
    return GROUP_FALLBACK.get(group, "🍽️")


def main():
    if not XLSX.exists():
        sys.exit(f"Source file not found: {XLSX}")

    rows = iter_rows(XLSX)
    header = next(rows)

    def resolve_column(code):
        matches = [i for i, h in enumerate(header) if h and h.startswith(f"{code} ")
                   and "Datenherkunft" not in h and "Referenz" not in h]
        if len(matches) != 1:
            sys.exit(f"Expected exactly one column for {code}, found {len(matches)}")
        return matches[0]

    columns = {field: resolve_column(code) for code, field in NUTRIENTS}
    phe_col = columns["phe"]
    amino_columns = [resolve_column(code) for code in OTHER_AMINO_ACIDS]

    group_rules, shared_rules = compile_rules()
    items = []
    fallback_hits = Counter()
    dropped_missing = []
    dropped_bad_zero = []
    for row in rows:
        if not row or not row[0]:
            continue
        code, name_de, name_en = row[0], row[1], row[2]
        item = {"id": code, "de": name_de, "en": name_en}
        for _, field in NUTRIENTS:
            item[field] = to_number(row[columns[field]])
        if item["phe"] is None:
            dropped_missing.append(f"{code} {name_de}")
            continue
        # A literal-0 Phe (not a trace marker) is an error when the food clearly
        # contains protein; such entries should have been "-" and are dropped.
        if row[phe_col] == "0" and (
            (item["protein"] or 0) > IMPLAUSIBLE_ZERO_MIN_PROTEIN
            or amino_acid_count(row, amino_columns) >= IMPLAUSIBLE_ZERO_MIN_OTHER_AMINO_ACIDS
        ):
            dropped_bad_zero.append(f"{code} {name_de}")
            continue
        emoji = assign_emoji(code, name_de, group_rules, shared_rules)
        if emoji == GROUP_FALLBACK.get(code[0]):
            fallback_hits[code[0]] += 1
        item["emoji"] = emoji
        items.append(item)

    fieldnames = ["id", "de", "en"] + [f for _, f in NUTRIENTS] + ["emoji"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(items)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2, separators=(",", ":"))
        f.write("\n")

    # Record exactly which foods were removed, so the drop rules are auditable.
    with open(OUT_DROPPED, "w", encoding="utf-8") as f:
        f.write(f"# Phe not determined (marker '-'): {len(dropped_missing)}\n")
        f.write("\n".join(dropped_missing))
        f.write(f"\n\n# Implausible Phe = 0 (protein > {IMPLAUSIBLE_ZERO_MIN_PROTEIN} g or "
                f">= {IMPLAUSIBLE_ZERO_MIN_OTHER_AMINO_ACIDS} other amino acids present): "
                f"{len(dropped_bad_zero)}\n")
        f.write("\n".join(dropped_bad_zero))
        f.write("\n")

    print(f"{len(items)} foods written to {OUT_CSV.name} and {OUT_JSON.name}")
    print(f"{len(dropped_missing)} foods dropped: Phe not determined ('-')")
    print(f"{len(dropped_bad_zero)} foods dropped: implausible Phe = 0 (see {OUT_DROPPED.name})")
    print("group fallback emojis used:",
          dict(sorted(fallback_hits.items())), f"(total {sum(fallback_hits.values())})")


if __name__ == "__main__":
    main()
