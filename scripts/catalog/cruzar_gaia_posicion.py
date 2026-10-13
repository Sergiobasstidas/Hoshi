#!/usr/bin/env python3
"""Enlace por posición con Gaia DR3 de las estrellas de AT-HYG que no lo tienen vía HIP.

Uso, desde la raíz del repositorio:
    python3 scripts/catalog/cruzar_gaia_posicion.py xmatch   # sube posiciones a CDS XMatch
    python3 scripts/catalog/cruzar_gaia_posicion.py validar  # valida pares y pide columnas a Gaia TAP

Pasos:
 1. Toma las filas de AT-HYG cuyo HIP no figura en gaia_dr3_hip.csv (o que no tienen HIP),
    propaga su posición J2000 a la época 2016.0 de Gaia con el movimiento propio de AT-HYG
    y las sube a CDS XMatch contra vizier:I/355/gaiadr3 con radio de 5″.
 2. Valida cada candidato con paralaje y magnitud; descarta los ambiguos.
 3. Para los aceptados pide a Gaia TAP las mismas columnas que gaia_dr3_hip.csv.

Solo biblioteca estándar. Los crudos quedan en data/raw/gaia/ (ver FUENTES.md).
"""
import csv
import io
import math
import sys
import time
import urllib.request
import uuid

from tap_comun import AGENTE, lotes, peticion, unir_csv
from descargar_gaia import COLUMNAS, UNION_AP, sincrona, LOTE_HOSTS, PAUSA

XMATCH = "http://cdsxmatch.u-strasbg.fr/xmatch/api/v1/sync"
ATHYG = "data/raw/hyglike_from_athyg_v32.csv"
GAIA_HIP = "data/raw/gaia/gaia_dr3_hip.csv"
SUBIDA = "data/raw/gaia/xmatch_subida_posicion.csv"
CRUDO = "data/raw/gaia/xmatch_gaia_dr3_posicion.csv"
RECHAZADOS = "data/raw/gaia/gaia_dr3_posicion_rechazados.csv"
SALIDA = "data/raw/gaia/gaia_dr3_posicion.csv"

CRUDO_AMPLIO = "data/raw/gaia/xmatch_gaia_dr3_posicion_amplio.csv"
RADIO_ARCSEC = 5
# Las filas con posición del catálogo Gliese (pos_src = GJ) tienen errores de hasta ~2′
# que no siguen el movimiento propio. Como su distancia y movimiento propio ya vienen de
# Gaia, se buscan en un radio amplio y se exige que paralaje y movimiento propio coincidan.
RADIO_AMPLIO_ARCSEC = 180
COLUMNAS_AMPLIO = ["angDist", "id", "ra", "dec", "Source", "RAdeg", "DEdeg", "Plx", "e_Plx", "pmRA", "pmDE", "Gmag", "BP-RP", "RUWE"]
TOL_PLX_AMPLIO = 0.01
TOL_PM_AMPLIO_REL = 0.02
TOL_PM_AMPLIO_MAS = 2.0
EPOCA_GAIA = 2016.0
EPOCA_ATHYG = 2000.0
# Tolerancias de validación. La paralaje de Hipparcos tiene ~1 mas de error, por eso el
# margen absoluto; la magnitud es la que descarta estrellas de fondo dentro del radio.
TOL_PLX_REL = 0.20
TOL_PLX_ABS_MAS = 2.5
TOL_MAG = 1.0
# Sin paralaje en Gaia no se puede validar la distancia: se exige más a posición y magnitud.
TOL_MAG_SIN_PLX = 0.5
SEP_SIN_PLX = 1.5


def num(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def v_desde_gaia(g, bp_rp):
    """V de Johnson desde G y BP−RP (Riello et al. 2021, tabla C.2; válido −0,5 < BP−RP < 5)."""
    if g is None or bp_rp is None:
        return None
    c = bp_rp
    return g - (-0.02704 + 0.01424 * c - 0.2156 * c * c + 0.01426 * c ** 3)


def filas_sin_gaia():
    with open(GAIA_HIP, newline="", encoding="utf-8") as f:
        con_gaia = {fila["hip"] for fila in csv.DictReader(f)}
    filas = []
    with open(ATHYG, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["id"] == "0" or (r["hip"] and r["hip"] in con_gaia):
                continue
            if num(r["ra"]) is None or num(r["dec"]) is None or not (num(r["dist"]) or 0) > 0:
                continue
            filas.append(r)
    return filas


def propagada(r):
    """(ra, dec) en grados en la época de Gaia. pmra de AT-HYG incluye cos(dec), en mas/año."""
    ra, dec = num(r["ra"]) * 15, num(r["dec"])
    anios = EPOCA_GAIA - EPOCA_ATHYG
    pmra, pmdec = num(r["pmra"]) or 0, num(r["pmdec"]) or 0
    dec2 = dec + pmdec * anios / 3.6e6
    ra2 = (ra + pmra * anios / 3.6e6 / max(1e-6, math.cos(math.radians(dec)))) % 360
    return ra2, dec2


def subir():
    filas = filas_sin_gaia()
    enviar(filas, SUBIDA, CRUDO, RADIO_ARCSEC)
    amplias = [r for r in filas if r["pos_src"] == "GJ" and r["dist_src"] in ("G_R3", "G_R2")]
    enviar(amplias, None, CRUDO_AMPLIO, RADIO_AMPLIO_ARCSEC)
    reducir(CRUDO_AMPLIO)


def reducir(ruta):
    """La respuesta de radio amplio pesa ~195 MB: se conservan solo las columnas que usa la validación."""
    with open(ruta, newline="", encoding="utf-8") as f:
        filas = [[c[k] for k in COLUMNAS_AMPLIO] for c in csv.DictReader(f)]
    with open(ruta, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(COLUMNAS_AMPLIO)
        w.writerows(filas)
    print(f"{ruta}: reducido a {len(COLUMNAS_AMPLIO)} columnas, {len(filas)} pares")


def enviar(filas, SUBIDA, CRUDO, RADIO_ARCSEC):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["id", "ra", "dec"])
    for r in filas:
        ra, dec = propagada(r)
        w.writerow([r["id"], f"{ra:.7f}", f"{dec:.7f}"])
    texto = buf.getvalue()
    if SUBIDA:
        with open(SUBIDA, "w", encoding="utf-8", newline="") as f:
            f.write(texto)
    print(f"radio {RADIO_ARCSEC}″: {len(filas)} estrellas sin enlace Gaia por HIP")
    campos = {"request": "xmatch", "distMaxArcsec": str(RADIO_ARCSEC), "RESPONSEFORMAT": "csv",
              "colRA1": "ra", "colDec1": "dec", "cat2": "vizier:I/355/gaiadr3"}
    limite = uuid.uuid4().hex
    partes = []
    for k, v in campos.items():
        partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    partes.append(f'--{limite}\r\nContent-Disposition: form-data; name="cat1"; filename="hoshi.csv"\r\n'
                  f'Content-Type: text/csv\r\n\r\n'.encode() + texto.encode() + b"\r\n")
    partes.append(f"--{limite}--\r\n".encode())
    req = urllib.request.Request(XMATCH, data=b"".join(partes), headers={
        "User-Agent": AGENTE, "Content-Type": f"multipart/form-data; boundary={limite}"})
    inicio = time.time()
    with urllib.request.urlopen(req, timeout=1800) as resp:
        cuerpo = resp.read()
    with open(CRUDO, "wb") as f:
        f.write(cuerpo)
    print(f"{CRUDO}: {len(cuerpo)} bytes, {cuerpo.count(bytes([10])) - 1} pares, {time.time() - inicio:.0f} s")


def validar():
    athyg = {r["id"]: r for r in filas_sin_gaia()}
    candidatos = {}
    with open(CRUDO, newline="", encoding="utf-8") as f:
        for c in csv.DictReader(f):
            candidatos.setdefault(c["id"], []).append(c)
    aceptados, rechazados = {}, []
    cuenta = {"sin_candidato": 0, "plx+mag": 0, "mag": 0, "ambiguo": 0, "no_valida": 0}
    for id_, r in athyg.items():
        cs = candidatos.get(id_, [])
        if not cs:
            cuenta["sin_candidato"] += 1
            continue
        plx_h, mag_h = 1000 / num(r["dist"]), num(r["mag"])
        buenos = []
        for c in cs:
            sep, plx, e_plx = num(c["angDist"]), num(c["Plx"]), num(c["e_Plx"]) or 0
            g, bp_rp = num(c["Gmag"]), num(c["BP-RP"])
            v = v_desde_gaia(g, bp_rp)
            # Sin color Gaia se compara G con V admitiendo G hasta 1,5 mag más brillante.
            d_mag = None if mag_h is None or g is None else (v - mag_h if v is not None else g - mag_h)
            if d_mag is None:
                motivo = "sin magnitud"
            elif plx is not None and plx > 0:
                ok_plx = abs(plx - plx_h) <= max(TOL_PLX_REL * plx_h, TOL_PLX_ABS_MAS + 3 * e_plx)
                ok_mag = abs(d_mag) <= TOL_MAG if v is not None else -1.5 <= d_mag <= 0.5
                motivo = None if ok_plx and ok_mag else ("paralaje" if not ok_plx else "magnitud")
                via = "plx+mag"
            else:
                ok = sep <= SEP_SIN_PLX and v is not None and abs(d_mag) <= TOL_MAG_SIN_PLX
                motivo = None if ok else "sin paralaje Gaia"
                via = "mag"
            if motivo is None:
                buenos.append((c, via))
            else:
                rechazados.append([id_, c["Source"], c["angDist"], f"{plx_h:.4f}", c["Plx"], r["mag"], c["Gmag"], c["BP-RP"], motivo])
        if len(buenos) == 1:
            c, via = buenos[0]
            aceptados[id_] = (c, via, len(cs))
            cuenta[via] += 1
        elif buenos:
            cuenta["ambiguo"] += 1
            for c, _ in buenos:
                rechazados.append([id_, c["Source"], c["angDist"], f"{plx_h:.4f}", c["Plx"], r["mag"], c["Gmag"], c["BP-RP"], "ambiguo"])
        else:
            cuenta["no_valida"] += 1
    # Segunda pasada, radio amplio: solo estrellas aún sin enlace con posición Gliese.
    amplios = {}
    with open(CRUDO_AMPLIO, newline="", encoding="utf-8") as f:
        for c in csv.DictReader(f):
            if c["id"] not in aceptados:
                amplios.setdefault(c["id"], []).append(c)
    cuenta["plx+pm"] = 0
    for id_, cs in amplios.items():
        r = athyg[id_]
        plx_h, pmra_h, pmdec_h = 1000 / num(r["dist"]), num(r["pmra"]), num(r["pmdec"])
        if pmra_h is None or pmdec_h is None:
            continue
        buenos = []
        for c in cs:
            plx, pmra, pmdec = num(c["Plx"]), num(c["pmRA"]), num(c["pmDE"])
            if plx is None or pmra is None or plx <= 0:
                continue
            d_pm = math.hypot(pmra - pmra_h, pmdec - pmdec_h)
            if (abs(plx - plx_h) <= TOL_PLX_AMPLIO * plx_h
                    and d_pm <= max(TOL_PM_AMPLIO_MAS, TOL_PM_AMPLIO_REL * math.hypot(pmra_h, pmdec_h))):
                buenos.append(c)
        if len(buenos) == 1:
            aceptados[id_] = (buenos[0], "plx+pm", len(cs))
            cuenta["plx+pm"] += 1
        elif buenos:
            cuenta["ambiguo"] += 1
    # Una fuente Gaia no puede quedar asignada a dos estrellas de Hoshi.
    por_fuente = {}
    for id_, (c, _, _) in aceptados.items():
        por_fuente.setdefault(c["Source"], []).append(id_)
    cuenta["fuente_repetida"] = 0
    for fuente, ids in por_fuente.items():
        if len(ids) > 1:
            for id_ in ids:
                c, via, _ = aceptados.pop(id_)
                cuenta[via] -= 1
                cuenta["fuente_repetida"] += 1
                rechazados.append([id_, fuente, c["angDist"], "", c["Plx"], athyg[id_]["mag"], c["Gmag"], c["BP-RP"], "fuente Gaia repetida"])
    print("candidatos:", len(athyg), cuenta, "aceptados:", len(aceptados))
    with open(RECHAZADOS, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["id", "source_id", "angDist", "plx_hoshi", "plx_gaia", "mag_hoshi", "Gmag", "bp_rp", "motivo"])
        w.writerows(rechazados)

    fuentes = sorted({c["Source"] for c, _, _ in aceptados.values()}, key=int)
    consulta = "SELECT " + COLUMNAS + " FROM gaiadr3.gaia_source AS g" + UNION_AP + " WHERE g.source_id IN ({ids})"
    partes = []
    for k, lote in enumerate(lotes(fuentes, LOTE_HOSTS), 1):
        partes.append(sincrona(consulta.format(ids=", ".join(lote))))
        print(f"  lote {k}: {len(lote)} ids", flush=True)
        time.sleep(PAUSA)
    texto, filas = unir_csv(partes)
    gaia = {g["source_id"]: g for g in csv.DictReader(io.StringIO(texto))}
    if len(gaia) != len(fuentes):
        raise RuntimeError(f"Gaia TAP devolvió {len(gaia)} filas de {len(fuentes)} pedidas")
    cabecera = texto.split("\n", 1)[0].split(",")
    with open(SALIDA, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        # id = ID AT-HYG; number_of_neighbours = candidatos dentro del radio; validacion = plx+mag | mag | plx+pm (radio amplio).
        w.writerow(["id", "angular_distance", "number_of_neighbours", "validacion"] + cabecera)
        for id_ in sorted(aceptados, key=int):
            c, via, vecinos = aceptados[id_]
            g = gaia[c["Source"]]
            w.writerow([id_, c["angDist"], vecinos, via] + [g[k] for k in cabecera])
    print(f"{SALIDA}: {len(aceptados)} filas")


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    if modo == "xmatch":
        subir()
    elif modo == "validar":
        validar()
    else:
        sys.exit(__doc__)
