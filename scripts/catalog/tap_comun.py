"""Utilidades compartidas por las descargas TAP de scripts/catalog (solo biblioteca estándar)."""
import csv
import time
import urllib.error
import urllib.parse
import urllib.request

AGENTE = "Hoshi-catalog/1.0 (descarga reproducible; python-urllib)"
ARCHIVO_IDS = "data/raw/exoplanets/nasa_pscomppars_ids.csv"


def peticion(url, datos=None, intentos=5, espera=10, limite=600):
    """GET o POST (si hay datos) con reintentos pausados. Devuelve (bytes, url_final)."""
    cuerpo = urllib.parse.urlencode(datos).encode() if datos is not None else None
    ultimo = None
    for intento in range(1, intentos + 1):
        try:
            req = urllib.request.Request(url, data=cuerpo, headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(req, timeout=limite) as resp:
                return resp.read(), resp.geturl()
        except urllib.error.HTTPError as err:
            detalle = err.read()[-600:].decode("utf-8", "replace")
            ultimo = f"HTTP {err.code}: {detalle}"
            if err.code == 400:  # consulta inválida: reintentar no la arregla
                raise RuntimeError(f"Consulta rechazada por {url}: {ultimo}")
        except Exception as err:  # red, tiempo agotado, etc.
            ultimo = repr(err)
        print(f"  intento {intento}/{intentos} fallido: {ultimo}", flush=True)
        time.sleep(espera * intento)
    raise RuntimeError(f"Sin respuesta de {url}: {ultimo}")


def anfitriones():
    """Devuelve (ids Gaia DR3 únicos ordenados, {hostname: gaia_dr3_id o ''})."""
    por_anfitrion = {}
    with open(ARCHIVO_IDS, newline="", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            previo = por_anfitrion.get(fila["hostname"], "")
            por_anfitrion[fila["hostname"]] = previo or fila["gaia_dr3_id"].strip()
    ids = sorted({v for v in por_anfitrion.values() if v})
    return ids, por_anfitrion


def lotes(lista, n):
    for i in range(0, len(lista), n):
        yield lista[i:i + n]


def unir_csv(partes):
    """Une respuestas CSV conservando una sola cabecera. Devuelve (texto, filas de datos)."""
    cabecera, cuerpo = None, []
    for texto in partes:
        lineas = texto.replace("\r\n", "\n").split("\n")
        while lineas and lineas[-1] == "":
            lineas.pop()
        if not lineas:
            continue
        if cabecera is None:
            cabecera = lineas[0]
        elif lineas[0] != cabecera:
            raise RuntimeError(f"Cabecera distinta entre lotes: {lineas[0]!r}")
        cuerpo.extend(lineas[1:])
    return "\n".join([cabecera] + cuerpo) + "\n", len(cuerpo)
