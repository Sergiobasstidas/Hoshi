#!/usr/bin/env python3
"""Descarga de catálogos de estrellas cercanas y de 2MASS para el registro HSB.

Uso, desde la raíz del repositorio:
    python3 scripts/catalog/descargar_cercanas.py gcns    # data/raw/gcns/gcns_main.csv.gz
    python3 scripts/catalog/descargar_cercanas.py cns5    # data/raw/cns5/cns5_main.csv
    python3 scripts/catalog/descargar_cercanas.py tmass   # data/raw/tmass/gaia_dr3_tmass.csv.gz
    python3 scripts/catalog/descargar_cercanas.py astrometria  # data/raw/gaia/gaia_dr3_registro.csv.gz
    python3 scripts/catalog/descargar_cercanas.py hipparcos    # data/raw/hipparcos/hipparcos_2007.csv.gz

- GCNS (Gaia Catalogue of Nearby Stars, Gaia Collaboration, Smart et al. 2021) desde el TAP de
  GAVO (Heidelberg), tabla gcns.main. No se bajan las columnas dist_* ni las coordenadas y
  velocidades derivadas de ellas: salen de un modelo de distancias.
- CNS5 (Golovin et al. 2023) desde el TAP de GAVO, tabla cns5.main (la versión publicada).
- 2MASS: vecino más probable de Gaia DR3 en 2MASS (gaiadr3.tmass_psc_xsc_best_neighbour) en el
  TAP de ARI (Heidelberg), para los Gaia DR3 del registro HSB, de CNS5 y de la capa del millón
  (data/raw/gaia/gaia_dr3_1m.csv.gz). Los identificadores se suben en lotes (TAP_UPLOAD).
- Astrometría y fotometría de Gaia DR3 (gaiadr3.gaia_source en ARI) de cada Gaia DR3 del registro HSB y
  de CNS5, para elegir distancia y color de cada estrella.
- Hipparcos, nueva reducción (van Leeuwen 2007), tabla completa `hipparcos` del TAP de ARI.

Solo biblioteca estándar. No procesa ni modifica los datos recibidos; al final imprime el
sha256 y el número de filas de cada archivo para su FUENTES.md.
"""
import csv
import gzip
import hashlib
import io
import os
import sys
import time
import urllib.request
import uuid

from tap_comun import AGENTE, peticion, unir_csv

GAVO = "https://dc.zah.uni-heidelberg.de/tap"
ARI = "https://gaia.ari.uni-heidelberg.de/tap"
COLUMNAS_GCNS = (
    "source_id, ra, dec, parallax, parallax_error, pmra, pmdec, ruwe, phot_g_mean_mag, "
    "phot_bp_mean_mag, phot_rp_mean_mag, adoptedrv, adoptedrv_error, adoptedrv_refname, "
    "gcns_prob, wd_prob, name_2mass, name_wise"
)
# Franjas de ascensión recta para que cada consulta síncrona quede bajo el límite de filas.
FRANJAS_RA = 12
LOTE_TMASS = 100000
PAUSA = 2


def sincrona(tap, consulta, maxrec=1000000):
    datos = {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "MAXREC": str(maxrec), "QUERY": consulta}
    return peticion(tap + "/sync", datos)[0].decode("utf-8")


def contar(tap, consulta):
    return int(sincrona(tap, consulta).split()[1])


def guardar(ruta, texto, comprimir):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    datos = texto.encode("utf-8")
    if comprimir:
        # mtime fijo: el mismo contenido da siempre el mismo .gz.
        buf = io.BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb", mtime=0) as g:
            g.write(datos)
        datos = buf.getvalue()
    with open(ruta, "wb") as f:
        f.write(datos)
    print(f"{ruta}: {len(datos)} bytes, sha256 {hashlib.sha256(datos).hexdigest()}")


def descargar_gcns():
    esperadas = contar(GAVO, "SELECT COUNT(*) FROM gcns.main")
    partes = []
    paso = 360 / FRANJAS_RA
    for k in range(FRANJAS_RA):
        desde, hasta = k * paso, (k + 1) * paso
        condicion = f"ra >= {desde} AND ra < {hasta}" if k < FRANJAS_RA - 1 else f"ra >= {desde}"
        partes.append(sincrona(GAVO, f"SELECT {COLUMNAS_GCNS} FROM gcns.main WHERE {condicion}"))
        print(f"  franja {k + 1}/{FRANJAS_RA}", flush=True)
        time.sleep(PAUSA)
    texto, filas = unir_csv(partes)
    if filas != esperadas:
        raise RuntimeError(f"Descarga cortada: {filas} filas de {esperadas}")
    guardar("data/raw/gcns/gcns_main.csv.gz", texto, True)
    print("gcns.main:", filas, "filas")


def descargar_cns5():
    esperadas = contar(GAVO, "SELECT COUNT(*) FROM cns5.main")
    texto, filas = unir_csv([sincrona(GAVO, "SELECT * FROM cns5.main")])
    if filas != esperadas:
        raise RuntimeError(f"Descarga cortada: {filas} filas de {esperadas}")
    guardar("data/raw/cns5/cns5_main.csv", texto, False)
    print("cns5.main:", filas, "filas")


def votable_ids(ids):
    filas = "".join(f"<TR><TD>{i}</TD></TR>" for i in ids)
    return (
        '<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">'
        '<RESOURCE><TABLE name="ids"><FIELD name="source_id" datatype="long"/>'
        f"<DATA><TABLEDATA>{filas}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>"
    ).encode("utf-8")


def sincrona_con_tabla(tap, consulta, tabla, intentos=5):
    limite = "--" + uuid.uuid4().hex
    campos = {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "MAXREC": "10000000",
              "UPLOAD": "ids,param:ids", "QUERY": consulta}
    cuerpo = b""
    for nombre, valor in campos.items():
        cuerpo += f'--{limite}\r\nContent-Disposition: form-data; name="{nombre}"\r\n\r\n{valor}\r\n'.encode()
    cuerpo += (f'--{limite}\r\nContent-Disposition: form-data; name="ids"; filename="ids.xml"\r\n'
               "Content-Type: application/x-votable+xml\r\n\r\n").encode() + tabla + f"\r\n--{limite}--\r\n".encode()
    for intento in range(1, intentos + 1):
        try:
            req = urllib.request.Request(tap + "/sync", data=cuerpo, headers={
                "User-Agent": AGENTE, "Content-Type": f"multipart/form-data; boundary={limite}"})
            with urllib.request.urlopen(req, timeout=1800) as resp:
                return resp.read().decode("utf-8")
        except Exception as err:  # red, tiempo agotado, etc.
            print(f"  intento {intento}/{intentos} fallido: {err!r}", flush=True)
            time.sleep(10 * intento)
    raise RuntimeError("Sin respuesta de " + tap)


def ids_registro():
    ids = set()
    with open("data/catalog/hsb_registro.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            ids.update(g for g in (r["gaia_dr3"],) if g)
    with open("data/raw/cns5/cns5_main.csv", newline="", encoding="utf-8") as f:
        ids.update(r["gaia_edr3_id"] for r in csv.DictReader(f) if r["gaia_edr3_id"])
    return sorted(ids, key=int)


def ordenar_y_guardar(ruta, partes):
    texto, filas = unir_csv(partes)
    lineas = texto.splitlines()
    texto = "\n".join([lineas[0]] + sorted(lineas[1:], key=lambda l: int(l.split(",")[0]))) + "\n"
    guardar(ruta, texto, True)
    return filas


def descargar_astrometria():
    ids = ids_registro()
    print("Gaia DR3 pedidos:", len(ids), flush=True)
    consulta = ("SELECT g.source_id, g.ra, g.dec, g.ref_epoch, g.parallax, g.parallax_error, g.pmra, g.pmdec, "
                "g.phot_g_mean_mag, g.bp_rp, g.ruwe FROM TAP_UPLOAD.ids AS u "
                "JOIN gaiadr3.gaia_source AS g ON g.source_id = u.source_id")
    partes = []
    for k in range(0, len(ids), LOTE_TMASS):
        partes.append(sincrona_con_tabla(ARI, consulta, votable_ids(ids[k:k + LOTE_TMASS])))
        print(f"  lote {k // LOTE_TMASS + 1}: {len(ids[k:k + LOTE_TMASS])} ids", flush=True)
        time.sleep(PAUSA)
    filas = ordenar_y_guardar("data/raw/gaia/gaia_dr3_registro.csv.gz", partes)
    print("gaia_source:", filas, "filas de", len(ids), "pedidos")


def descargar_hipparcos():
    esperadas = contar(ARI, "SELECT COUNT(*) FROM hipparcos")
    partes = [sincrona(ARI, "SELECT hip, ra, dec, plx, e_plx, pmra, pmdec, hpmag, b_v, e_b_v, v_i, nc, sn FROM hipparcos")]
    filas = ordenar_y_guardar("data/raw/hipparcos/hipparcos_2007.csv.gz", partes)
    if filas != esperadas:
        raise RuntimeError(f"Descarga cortada: {filas} filas de {esperadas}")
    print("hipparcos:", filas, "filas")


def ids_tmass():
    ids = set()
    with open("data/catalog/hsb_registro.csv", newline="", encoding="utf-8") as f:
        ids.update(r["gaia_dr3"] for r in csv.DictReader(f) if r["gaia_dr3"])
    with open("data/raw/cns5/cns5_main.csv", newline="", encoding="utf-8") as f:
        ids.update(r["gaia_edr3_id"] for r in csv.DictReader(f) if r["gaia_edr3_id"])
    with gzip.open("data/raw/gaia/gaia_dr3_1m.csv.gz", "rt", newline="", encoding="utf-8") as f:
        ids.update(r["source_id"] for r in csv.DictReader(f) if r["source_id"])
    if not all(i.isdigit() for i in ids):
        raise RuntimeError("Hay identificadores Gaia con formato inesperado")
    return sorted(ids, key=int)


def descargar_tmass():
    ids = ids_tmass()
    print("Gaia DR3 pedidos:", len(ids), flush=True)
    consulta = ("SELECT u.source_id, n.original_ext_source_id AS tmass, n.angular_distance, "
                "n.number_of_neighbours, n.number_of_mates, n.xm_flag FROM TAP_UPLOAD.ids AS u "
                "JOIN gaiadr3.tmass_psc_xsc_best_neighbour AS n ON n.source_id = u.source_id")
    partes = []
    for k in range(0, len(ids), LOTE_TMASS):
        partes.append(sincrona_con_tabla(ARI, consulta, votable_ids(ids[k:k + LOTE_TMASS])))
        print(f"  lote {k // LOTE_TMASS + 1}: {len(ids[k:k + LOTE_TMASS])} ids", flush=True)
        time.sleep(PAUSA)
    texto, filas = unir_csv(partes)
    lineas = texto.splitlines()
    # Orden fijo por source_id: el archivo no depende del orden de respuesta del servicio.
    texto = "\n".join([lineas[0]] + sorted(lineas[1:], key=lambda l: int(l.split(",")[0]))) + "\n"
    guardar("data/raw/tmass/gaia_dr3_tmass.csv.gz", texto, True)
    print("tmass_psc_xsc_best_neighbour:", filas, "filas de", len(ids), "pedidos")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    acciones = {"gcns": descargar_gcns, "cns5": descargar_cns5, "tmass": descargar_tmass,
                "astrometria": descargar_astrometria, "hipparcos": descargar_hipparcos}
    if modo not in acciones:
        sys.exit(__doc__)
    acciones[modo]()
