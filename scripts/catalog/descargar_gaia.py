#!/usr/bin/env python3
"""Descarga de Gaia DR3 (TAP de ESA) para unificar identificadores en Hoshi.

Uso, desde la raíz del repositorio:
    python3 scripts/catalog/descargar_gaia.py hip     # data/raw/gaia/gaia_dr3_hip.csv
    python3 scripts/catalog/descargar_gaia.py hosts   # data/raw/gaia/gaia_dr3_exoplanet_hosts.csv

Solo biblioteca estándar. No procesa ni modifica los datos recibidos.
"""
import sys
import time

from tap_comun import anfitriones, lotes, peticion, unir_csv

TAP = "https://gea.esac.esa.int/tap-server/tap"
COLUMNAS = (
    "g.source_id, g.ra, g.dec, g.ref_epoch, g.parallax, g.parallax_error, g.pmra, g.pmdec, "
    "g.radial_velocity, g.phot_g_mean_mag, g.bp_rp, g.ruwe, g.non_single_star, "
    "g.teff_gspphot, ap.radius_gspphot, g.distance_gspphot"
)
# radius_gspphot no existe en gaiadr3.gaia_source: vive en gaiadr3.astrophysical_parameters.
# El LEFT JOIN conserva las fuentes sin parámetros astrofísicos (radio vacío).
UNION_AP = " LEFT JOIN gaiadr3.astrophysical_parameters AS ap ON ap.source_id = g.source_id"
CONSULTA_HIP = (
    "SELECT n.original_ext_source_id AS hip, n.angular_distance, n.number_of_neighbours, "
    + COLUMNAS
    + " FROM gaiadr3.hipparcos2_best_neighbour AS n"
    " JOIN gaiadr3.gaia_source AS g ON g.source_id = n.source_id"
    + UNION_AP
)
CONSULTA_CUENTA_HIP = "SELECT COUNT(*) AS n FROM gaiadr3.hipparcos2_best_neighbour"
CONSULTA_HOSTS = "SELECT " + COLUMNAS + " FROM gaiadr3.gaia_source AS g" + UNION_AP + " WHERE g.source_id IN ({ids})"
LOTE_HOSTS = 500
PAUSA = 2


def sincrona(consulta):
    datos = {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": consulta}
    return peticion(TAP + "/sync", datos)[0].decode("utf-8")


def asincrona(consulta):
    datos = {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "PHASE": "RUN", "QUERY": consulta}
    _, trabajo = peticion(TAP + "/async", datos)
    print("  trabajo:", trabajo, flush=True)
    while True:
        fase = peticion(trabajo + "/phase")[0].decode().strip()
        if fase == "COMPLETED":
            break
        if fase in ("ERROR", "ABORTED"):
            raise RuntimeError(f"Trabajo {trabajo} terminó en {fase}")
        time.sleep(5)
    return peticion(trabajo + "/results/result")[0].decode("utf-8")


def descargar_hip():
    esperadas = int(sincrona(CONSULTA_CUENTA_HIP).split()[1])
    print("filas esperadas (COUNT de hipparcos2_best_neighbour):", esperadas)
    texto, filas = unir_csv([asincrona(CONSULTA_HIP)])
    if filas != esperadas:
        raise RuntimeError(f"Descarga cortada: {filas} filas de {esperadas}")
    with open("data/raw/gaia/gaia_dr3_hip.csv", "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    print("gaia_dr3_hip.csv:", filas, "filas")


def descargar_hosts():
    ids, _ = anfitriones()
    numeros = [i.replace("Gaia DR3 ", "", 1) for i in ids]
    if not all(n.isdigit() for n in numeros):
        raise RuntimeError("Hay gaia_dr3_id con formato inesperado")
    partes = []
    for k, lote in enumerate(lotes(numeros, LOTE_HOSTS), 1):
        partes.append(sincrona(CONSULTA_HOSTS.format(ids=", ".join(lote))))
        print(f"  lote {k}: {len(lote)} ids pedidos", flush=True)
        time.sleep(PAUSA)
    texto, filas = unir_csv(partes)
    with open("data/raw/gaia/gaia_dr3_exoplanet_hosts.csv", "w", encoding="utf-8", newline="") as f:
        f.write(texto)
    devueltos = {l.split(",")[0] for l in texto.splitlines()[1:]}
    faltan = [n for n in numeros if n not in devueltos]
    print(f"gaia_dr3_exoplanet_hosts.csv: {len(numeros)} ids pedidos, {filas} filas, {len(faltan)} sin fila")
    for n in faltan:
        print("  sin fila:", n)


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else ""
    if modo == "hip":
        descargar_hip()
    elif modo == "hosts":
        descargar_hosts()
    else:
        sys.exit(__doc__)
