# scripts/exoplanets/fetch_nasa_catalog_types.py
# Descarga el tipo de planeta (gigante gaseoso, tipo Neptuno, supertierra, terrestre) que
# la NASA asigna a cada ficha de su catálogo, desde la API pública de listados de
# science.nasa.gov. La NASA no publica los límites de esos tipos.
# Uso: python3 -I scripts/exoplanets/fetch_nasa_catalog_types.py data/raw/exoplanets/nasa_science_catalog_types.csv
import json, time, urllib.request, urllib.parse, re, csv, sys
out = []
page = 1
while True:
    q = urllib.parse.urlencode({'post_types[]':'exoplanet','number_of_items':100,'response_format':'json','show_pagination':'true','paged':page,'current_page':page,'orderby':'title','order':'ASC'})
    req = urllib.request.Request('https://science.nasa.gov/wp-json/smd/v1/content-list/?'+q, headers={'User-Agent':'Mozilla/5.0 (Hoshi research)'})
    for attempt in range(4):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=60)); break
        except Exception as e:
            print('retry', page, e, file=sys.stderr); time.sleep(2**attempt*2)
    items = d['type']['content']
    total = d['type']['pagination_meta']['total']
    for it in items:
        ex = it.get('excerpt') or ''
        m = re.search(r' is an? (.+?) exoplanet', ex)
        cf = it.get('customFields') or {}
        out.append((it['title'], m.group(1) if m else '', (cf.get('planet_mass') or {}).get('value',''), it['permalink']))
    print(page, total, len(out), file=sys.stderr)
    if page >= total or not items: break
    page += 1
    time.sleep(0.4)
with open(sys.argv[1], 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['title','tipo_en_texto','planet_mass','permalink']); w.writerows(out)
