# Hoshi — historial de avance

Registro del avance del proyecto. A partir de aquí cada cambio queda descrito en su commit; este archivo resume los hitos para leerlos de corrido. Detalle técnico en la [documentación](DOCUMENTACION.md).

## Base del proyecto (antes del 11/10/2026)

Desarrollo anterior al historial Git, reunido en la primera instantánea del repositorio.

- **Sistema solar:** Sol, planetas y Luna con radios físicos a escala, órbitas con sus inclinaciones y primeras texturas.
- **Exploración estelar:** catálogo local de 118.660 estrellas, búsqueda por nombre e identificadores, vuelo libre y origen flotante para conservar la precisión.
- **Entorno solar:** cinturón de Kuiper, heliosfera, nube de Oort y representación esquemática de las Voyager.
- **Estrellas y sistemas:** radio y temperatura estimados para 362 estrellas, Próxima Centauri con valores publicados, WR 140 como sistema de dos componentes y Eta Carinae como registro propio.
- **Mapa de púlsares:** capa activable con los 14 púlsares de las placas Pioneer y Voyager.
- **Contexto galáctico:** reconstrucción de la Vía Láctea con volumen a partir de la imagen de ESA/Gaia y navegación hasta 200.000 años luz.

## 11/10/2026 — Primera publicación

- Repositorio y despliegue en Cloudflare Pages.
- Ajustes de exposición de la galaxia y del ritmo de los viajes: avance sostenido y llegada más larga.
- Icono y título del sitio.

## 12/10/2026 — Escala y visores

- Etiquetas de estrellas más estables y navegación por escalas.
- Escala lateral ondulada con vista previa y viaje al hacer clic.
- Dial de velocidad integrado y visor de distancia.

## 13/10/2026 — Precisión, sistemas múltiples y orden

- **Correcciones:** el generador del buscador y sus pruebas vuelven a coincidir; la ficha distingue parámetros publicados de estimados.
- **Carga:** el catálogo se descarga aparte del bloque inicial, que baja de 15,9 MB a 1,3 MB. El sistema solar y la interfaz aparecen antes que las estrellas.
- **Orientación galáctica:** al ver la Vía Láctea la cámara toma como vertical el polo norte galáctico y el disco queda horizontal y centrado.
- **Visor de distancia:** mide hasta el objetivo actual y lo nombra.
- **Posiciones más precisas:** las coordenadas se recalculan desde ascensión recta, declinación y distancia. Antes estaban redondeadas a unas 206 UA y las componentes de un mismo sistema se superponían.
- **Sistemas múltiples:**
  - Binarias con órbita publicada (ORB6): la compañera aparece sobre su elipse al acercarse. Órbitas validadas contra las efemérides del propio catálogo.
  - Pares anchos sin órbita (WDS) y jerarquías: Castor muestra sus pares interiores y su compañera lejana.
  - Etiqueta, color por clase espectral y tamaño por brillo para cada compañera.
  - Masas del Multiple Star Catalog: las dos estrellas giran en torno a su centro común.
  - Binarias simples: masas publicadas de Sirio y Procyon, y razón de masas de SB9 para 61 pares.
  - Total: 5.615 sistemas y 6.848 componentes.
- **Interfaz:** visores más pequeños abajo a la izquierda y créditos en la esquina inferior derecha.
- **Datos preparados, aún sin mostrar:** sistemas planetarios (NASA Exoplanet Archive y exoplanet.eu) y enlace del catálogo con Gaia DR3 y SIMBAD.
- **Orden del repositorio:** documentación técnica pública, README nuevo y retirada de archivos sin uso.
