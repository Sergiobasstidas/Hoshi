import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { POSES_F7, VARIANTE_F7, VISTA_F7, envolverRender, percentil } from './arnes';
import { mantenerActivo } from '../scene/reposo';

// Deja la cámara en la vista pedida (?vista=) y publica window.hoshiF7 con listo() y medir().
// `irGalaxia(libre)`: vista «Vía Láctea» en un solo cuadro; con `libre`, llega en vuelo libre.
export default function ArnesF7({ listo, irGalaxia, traveling, freeFlight, origin }) {
  const { camera, gl, invalidate } = useThree();
  const estado = useRef({ paso: 0, viajo: false, lista: false });
  useEffect(() => {
    const medicion = { activa: false, consultas: [], info: null };
    const restaurar = envolverRender(gl, medicion);
    const { ctx, ext } = medicion;
    const debug = ctx.getExtension('WEBGL_debug_renderer_info');
    window.hoshiF7 = {
      vista: VISTA_F7, variante: VARIANTE_F7,
      gpu: debug ? ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER),
      lienzo: [ctx.drawingBufferWidth, ctx.drawingBufferHeight],
      // Se resuelve 2,5 s después de dejar la cámara en su lugar (como en el «antes»), para que carguen las texturas.
      listo: () => new Promise(resolver => { const mirar = () => (estado.current.lista ? setTimeout(resolver, 2500) : setTimeout(mirar, 200)); mirar(); }),
      // Dibujo continuo durante `segundos`: mediana y p95 del tiempo por cuadro y de GPU (ms), y renderer.info.
      medir: async (segundos = 5) => {
        medicion.consultas = []; medicion.activa = true;
        const tiempos = []; let previo = performance.now(); const fin = previo + segundos * 1000;
        await new Promise(resolver => {
          const paso = t => { tiempos.push(t - previo); previo = t; invalidate(); if (t < fin) requestAnimationFrame(paso); else resolver(); };
          invalidate(); requestAnimationFrame(paso);
        });
        medicion.activa = false;
        await new Promise(resolver => setTimeout(resolver, 300));
        const gpu = [];
        for (const q of medicion.consultas) {
          if (ext && ctx.getQueryParameter(q, ctx.QUERY_RESULT_AVAILABLE) && !ctx.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6);
          ctx.deleteQuery(q);
        }
        const cuadros = tiempos.slice(1);
        return { vista: VISTA_F7, variante: VARIANTE_F7, cuadros: cuadros.length, mediana: percentil(cuadros, 0.5), p95: percentil(cuadros, 0.95),
          gpuMediana: percentil(gpu, 0.5), gpuP95: percentil(gpu, 0.95), ...medicion.info };
      },
    };
    return () => { restaurar(); delete window.hoshiF7; };
  }, [gl, invalidate]);
  useFrame(() => {
    const e = estado.current;
    if (!listo || e.lista) return;
    if (VISTA_F7 === 'a') { e.lista = true; return; }
    if (e.paso === 0) { e.paso = 1; irGalaxia(VISTA_F7 !== 'b'); mantenerActivo(); return; }
    if (traveling) { e.viajo = true; return; }
    if (!e.viajo || (VISTA_F7 !== 'b' && !freeFlight)) return;
    const pose = POSES_F7[VISTA_F7];
    if (pose) {
      const enEscena = v => v.map((x, i) => x - origin[i]);
      camera.position.set(...enEscena(pose.posicion));
      camera.up.set(...pose.arriba);
      camera.lookAt(...enEscena(pose.mira));
      camera.updateMatrixWorld();
    }
    e.lista = true;
    mantenerActivo();
  });
  return null;
}
