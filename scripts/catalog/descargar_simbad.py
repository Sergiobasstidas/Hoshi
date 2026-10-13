#!/usr/bin/env python3
"""Descarga de identificadores de SIMBAD (TAP del CDS) para los anfitriones de exoplanetas.

Uso, desde la raíz del repositorio:
    python3 scripts/catalog/descargar_simbad.py   # data/raw/simbad/simbad_exoplanet_hosts.csv

Pasadas, todas con la misma consulta y lotes de <= 300 identificadores:
  1. anfitriones con gaia_dr3_id, consultados por "Gaia DR3 <source_id>";
  2. anfitriones sin gaia_dr3_id, consultados por su hostname tal cual;
  3. anfitriones con gaia_dr3_id que SIMBAD no resolvió en la pasada 1, por hostname.
La columna query_id es el identificador tal como lo devuelve SIMBAD; el archivo
simbad_exoplanet_hosts_mapa.csv enlaza cada hostname con lo enviado y con ese query_id.
Solo biblioteca estándar. No procesa ni modifica los datos recibidos.
"""
import csv
import io
import time

from tap_comun import anfitriones, lotes, peticion, unir_csv

TAP = "https://simbad.cds.unistra.fr/simbad/sim-tap/sync"
CONSULTA = (
    "SELECT i1.id AS query_id, b.main_id, b.otype, b.sp_type, b.plx_value, i2.id AS alias"
    " FROM ident AS i1 JOIN basic AS b ON b.oid = i1.oidref"
    " JOIN ident AS i2 ON i2.oidref = b.oid WHERE i1.id IN ({ids})"
)
LOTE = 300
PAUSA = 2
SALIDA = "data/raw/simbad/simbad_exoplanet_hosts.csv"
MAPA = "data/raw/simbad/simbad_exoplanet_hosts_mapa.csv"
NO_RESUELTOS = "data/raw/simbad/simbad_exoplanet_hosts_no_resueltos.txt"


def consulta(identificadores):
    lista = ", ".join("'" + i.replace("'", "''") + "'" for i in identificadores)
    datos = {
        "REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv",
        "MAXREC": "2000000", "QUERY": CONSULTA.format(ids=lista),
    }
    texto = peticion(TAP, datos)[0].decode("utf-8")
    time.sleep(PAUSA)
    return texto, {f["query_id"] for f in csv.DictReader(io.StringIO(texto))}


def norma(s):
    return " ".join(s.split()).lower()


def pasada(nombre, identificadores):
    """Consulta por lotes; devuelve (respuestas CSV, {identificador enviado: query_id devuelto}).

    SIMBAD compara ident.id con su propia normalización: 'alf Tau' encuentra '* alf Tau' y
    devuelve esa forma en query_id. Si un lote devuelve formas que no coinciden con lo enviado,
    los identificadores sin emparejar se consultan de uno en uno solo para saber a cuál
    corresponde cada una (esas respuestas no se añaden al CSV: ya están en la del lote).
    """
    partes, mapa = [], {}
    for k, lote in enumerate(lotes(identificadores, LOTE), 1):
        texto, devueltos = consulta(lote)
        partes.append(texto)
        por_norma = {norma(d): d for d in devueltos}
        sueltos = [i for i in lote if norma(i) not in por_norma]
        for i in lote:
            if norma(i) in por_norma:
                mapa[i] = por_norma[norma(i)]
        extras = devueltos - set(mapa.values())
        if extras:
            for i in sueltos:
                _, uno = consulta([i])
                if uno:
                    mapa[i] = sorted(uno)[0]
        print(f"  {nombre} lote {k}: {len(lote)} ids, {len(devueltos)} resueltos, "
              f"{len(extras)} con otra forma", flush=True)
    return partes, mapa


def main():
    ids, por_anfitrion = anfitriones()
    sin_gaia = sorted(h for h, g in por_anfitrion.items() if not g)

    partes1, mapa1 = pasada("gaia", ids)
    partes2, mapa2 = pasada("hostname", sin_gaia)
    repesca = sorted(h for h, g in por_anfitrion.items() if g and g not in mapa1)
    partes3, mapa3 = pasada("repesca", repesca)

    texto, filas = unir_csv(partes1 + partes2 + partes3)
    with open(SALIDA, "w", encoding="utf-8", newline="") as f:
        f.write(texto)

    pendientes = []
    with open(MAPA, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["hostname", "gaia_dr3_id", "enviado", "query_id"])
        for h in sorted(por_anfitrion):
            g = por_anfitrion[h]
            if g in mapa1:
                w.writerow([h, g, g, mapa1[g]])
            elif h in mapa2 or h in mapa3:
                w.writerow([h, g, h, mapa2.get(h) or mapa3[h]])
            else:
                w.writerow([h, g, "", ""])
                pendientes.append(h)
    with open(NO_RESUELTOS, "w", encoding="utf-8") as f:
        f.write("".join(h + "\n" for h in pendientes))

    print(f"anfitriones: {len(por_anfitrion)} ({len(ids)} con gaia_dr3_id, {len(sin_gaia)} sin él)")
    print(f"pasada 1 (Gaia DR3): {len(ids)} ids pedidos, {len(mapa1)} resueltos")
    print(f"pasada 2 (hostname, sin Gaia): {len(sin_gaia)} pedidos, {len(mapa2)} resueltos")
    print(f"pasada 3 (repesca por hostname): {len(repesca)} pedidos, {len(mapa3)} resueltos")
    print(f"{SALIDA}: {filas} filas; sin resolver: {len(pendientes)}")


if __name__ == "__main__":
    main()
