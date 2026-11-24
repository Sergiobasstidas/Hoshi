import { PRESUPUESTO, crearMapaCpu, parametrosCuadro } from './galaxiaModelo.js';

// Un cuadro del volumen de la galaxia (GalaxiaVolumen.jsx): uniforms de la marcha según la pose, la marcha en el
// sub-rectángulo ancho × alto del render target y los uniforms de la composición. Fuera del componente: modifica objetos
// de three.js que el componente guarda.
const TACTIL = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
// cruce: { W, sinBrazos, fuerzaCerca } (pesoVolumen). En el cruce el volumen se ve a medias y gasta menos muestras:
// presupuesto × (0,3 + 0,7·W).
export function dibujarVolumen({ gl, camera, origin, marcha, objetivo, recursos, malla, alfa, tamano, barra, cruce }) {
    const { sinBrazos, fuerzaCerca } = cruce;
    // La CPU usa la misma planta que la GPU (con el promedio por anillos) para el punto negro.
    const mapa = sinBrazos > 0 ? crearMapaCpu({ ...recursos.copia, escalaE: recursos.escalaE, anillos: recursos.anillos, sinBrazos }) : recursos.mapa;
    gl.getDrawingBufferSize(tamano);
    if (objetivo.width !== tamano.x || objetivo.height !== tamano.y) objetivo.setSize(tamano.x, tamano.y);
    camera.updateMatrixWorld();
    const p = parametrosCuadro({ camara: { position: camera.position, elementos: camera.matrixWorld.elements, fov: camera.fov, aspecto: camera.aspect },
      origin, lienzo: [tamano.x, tamano.y], telefono: TACTIL, mapa, barra, fuerzaCerca,
      muestras: (TACTIL ? PRESUPUESTO.tel : PRESUPUESTO.pc) * (0.3 + 0.7 * cruce.W),
      negro: 1, alturaNegro: 20 * Math.PI / 180 });
    const u = marcha.material.uniforms;
    u.uCam.value.set(...p.o);
    u.uRayos.value.set(p.base[0][0], p.base[1][0], p.base[2][0], p.base[0][1], p.base[1][1], p.base[2][1], p.base[0][2], p.base[1][2], p.base[2][2]);
    u.uTan.value.set(...p.tan); u.uPixAng.value = p.pixAng; u.uDh.value = p.dh; u.uPasosMax.value = p.nMax;
    u.uNegro.value = p.N; u.uInterior.value = p.iota;
    u.uAnillos.value = recursos.texAnillos; u.uSinBrazos.value = sinBrazos; u.uCercaFuerza.value = fuerzaCerca;
    u.uEmision.value = recursos.emision; u.uPolvo.value = recursos.polvo; u.uRuido.value = recursos.ruido;
    objetivo.viewport.set(0, 0, p.ancho, p.alto);
    objetivo.scissor.set(0, 0, p.ancho, p.alto); objetivo.scissorTest = true;
    const previo = gl.getRenderTarget();
    gl.setRenderTarget(objetivo);
    gl.render(marcha.escena, marcha.camara);
    gl.setRenderTarget(previo);
    const c = malla.material.uniforms;
    c.uLienzo.value.copy(tamano); c.uEscala.value.set(p.ancho / tamano.x, p.alto / tamano.y); c.uOpacidad.value = alfa;
}
