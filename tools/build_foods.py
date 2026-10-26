"""Build data/foods.json from a USDA FoodData Central CSV download.

    python tools/build_foods.py reference/Nutrition/FoodData_Central_csv_2026-04-30

Keeps the three generic datasets (Foundation, SR Legacy, FNDDS survey foods) and
drops the ~2 million US branded products. Values are per 100 g of the food as
described. A nutrient the source does not report is stored as null - unknown,
never zero. FoodData Central is public domain (CC0), so the result can ship.
"""
import csv, json, os, sys

KEEP = {'foundation_food': 'F', 'sr_legacy_food': 'S', 'survey_fndds_food': 'N'}

# key, FDC nutrient id(s) in order of preference, label, unit
NUTRIENTS = [
    ('kcal', ['1008', '2048', '2047'], 'Energy', 'kcal'),
    ('protein', ['1003'], 'Protein', 'g'),
    ('fat', ['1004'], 'Fat', 'g'),
    ('satFat', ['1258'], 'Saturated fat', 'g'),
    ('monoFat', ['1292'], 'Monounsaturated fat', 'g'),
    ('polyFat', ['1293'], 'Polyunsaturated fat', 'g'),
    ('ala', ['1404', '1270'], 'Omega-3 ALA', 'g'),
    ('epa', ['1278'], 'Omega-3 EPA', 'g'),
    ('dha', ['1272'], 'Omega-3 DHA', 'g'),
    ('carbs', ['1005'], 'Carbohydrate', 'g'),
    ('sugars', ['2000'], 'Sugars', 'g'),
    ('fibre', ['1079'], 'Fibre', 'g'),
    ('calcium', ['1087'], 'Calcium', 'mg'),
    ('iron', ['1089'], 'Iron', 'mg'),
    ('magnesium', ['1090'], 'Magnesium', 'mg'),
    ('phosphorus', ['1091'], 'Phosphorus', 'mg'),
    ('potassium', ['1092'], 'Potassium', 'mg'),
    ('sodium', ['1093'], 'Sodium', 'mg'),
    ('zinc', ['1095'], 'Zinc', 'mg'),
    ('copper', ['1098'], 'Copper', 'mg'),
    ('manganese', ['1101'], 'Manganese', 'mg'),
    ('iodine', ['1100'], 'Iodine', 'µg'),
    ('selenium', ['1103'], 'Selenium', 'µg'),
    ('vitA', ['1106'], 'Vitamin A', 'µg'),
    ('betaCarotene', ['1107'], 'Beta-carotene', 'µg'),
    ('lycopene', ['1122'], 'Lycopene', 'µg'),
    ('lutein', ['1123'], 'Lutein + zeaxanthin', 'µg'),
    ('vitC', ['1162'], 'Vitamin C', 'mg'),
    ('vitD', ['1114'], 'Vitamin D', 'µg'),
    ('vitE', ['1109'], 'Vitamin E', 'mg'),
    ('vitK', ['1185'], 'Vitamin K', 'µg'),
    ('thiamin', ['1165'], 'Thiamin (B1)', 'mg'),
    ('riboflavin', ['1166'], 'Riboflavin (B2)', 'mg'),
    ('niacin', ['1167'], 'Niacin (B3)', 'mg'),
    ('pantothenic', ['1170'], 'Pantothenic acid (B5)', 'mg'),
    ('b6', ['1175'], 'Vitamin B6', 'mg'),
    ('folate', ['1190', '1177'], 'Folate (B9)', 'µg'),
    ('b12', ['1178'], 'Vitamin B12', 'µg'),
    ('choline', ['1180'], 'Choline', 'mg'),
]
WANTED = {nid for _, ids, _, _ in NUTRIENTS for nid in ids}


def sig(x):
    """Three significant figures - the source is not more precise than that."""
    if x == 0:
        return 0
    v = float(f'{x:.3g}')
    return int(v) if v == int(v) else v


def rows(folder, name):
    with open(os.path.join(folder, name), newline='', encoding='utf-8') as f:
        yield from csv.DictReader(f)


def main(folder, out):
    sr_cats = {r['id']: r['description'] for r in rows(folder, 'food_category.csv')}
    survey_cats = {r['wweia_food_category']: r['wweia_food_category_description'] for r in rows(folder, 'wweia_food_category.csv')}
    units = {r['id']: r['name'] for r in rows(folder, 'measure_unit.csv')}

    foods = {}
    for r in rows(folder, 'food.csv'):
        t = KEEP.get(r['data_type'])
        if not t:
            continue
        cat = survey_cats.get(r['food_category_id']) if t == 'N' else sr_cats.get(r['food_category_id'])
        foods[r['fdc_id']] = {'t': t, 'name': r['description'].strip(), 'cat': cat or '', 'n': {}, 'p': []}
    print(f'{len(foods)} foods kept', file=sys.stderr)

    seen = 0
    for r in rows(folder, 'food_nutrient.csv'):
        seen += 1
        if seen % 5_000_000 == 0:
            print(f'  {seen:,} nutrient rows read', file=sys.stderr)
        f = foods.get(r['fdc_id'])
        if f is None or r['nutrient_id'] not in WANTED or r['amount'] == '':
            continue
        f['n'][r['nutrient_id']] = float(r['amount'])

    for r in rows(folder, 'food_portion.csv'):
        f = foods.get(r['fdc_id'])
        if f is None or not r['gram_weight']:
            continue
        grams = float(r['gram_weight'])
        if grams <= 0:
            continue
        label = r['portion_description'].strip()
        if not label or label.lower().startswith('quantity not specified'):
            unit = units.get(r['measure_unit_id'], '')
            unit = '' if unit == 'undetermined' else unit
            amount = r['amount'].rstrip('0').rstrip('.') if r['amount'] else ''
            label = ' '.join(x for x in [amount, unit, r['modifier'].strip()] if x)
        if label and not label.isdigit() and len(f['p']) < 8:
            f['p'].append([label[:60], sig(grams)])

    # Foundation lists some foods once per lab sample; keep the most complete one.
    best = {}
    for fdc, f in foods.items():
        key = (f['t'], f['name'].lower()) if f['t'] == 'F' else fdc
        if key not in best or len(f['n']) > len(foods[best[key]]['n']):
            best[key] = fdc
    keep = set(best.values())

    out_foods = []
    for fdc, f in foods.items():
        if fdc not in keep:
            continue
        vals = []
        for _, ids, _, _ in NUTRIENTS:
            v = next((f['n'][i] for i in ids if i in f['n']), None)
            vals.append(None if v is None else sig(v))
        if vals[0] is None and all(v is None for v in vals):
            continue
        out_foods.append([int(fdc), f['name'], f['t'], f['cat'], vals, f['p']])
    out_foods.sort(key=lambda x: x[1].lower())

    data = {
        'source': 'USDA FoodData Central, release 2026-04-30 (Foundation, SR Legacy and FNDDS survey foods). Public domain (CC0). Values per 100 g; null means not reported.',
        'types': {'F': 'Foundation', 'S': 'SR Legacy', 'N': 'Survey (FNDDS)'},
        'nutrients': [[k, label, unit] for k, _, label, unit in NUTRIENTS],
        'foods': out_foods,
    }
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out_foods)} foods written to {out} ({os.path.getsize(out) / 1e6:.1f} MB)', file=sys.stderr)


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    main(sys.argv[1], os.path.join(here, 'data', 'foods.json'))
