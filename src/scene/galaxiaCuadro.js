import { parametrosCuadro } from './galaxiaModelo.js';

// Un cuadro del volumen de la galaxia (GalaxiaVolumen.jsx): uniforms de la marcha según la pose, la marcha en el
// sub-rectángulo s·W × s·H del render target y los uniforms de la composición. Fuera del componente: modifica objetos
// de three.js que el componente guarda.
const TACTIL = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
export function dibujarVolumen({ gl, camera, origin, marcha, objetivo, recursos, malla, alfa, tamano, barra }) {
    gl.getDrawingBufferSize(tamano);
    if (objetivo.width !== tamano.x || objetivo.height !== tamano.y) objetivo.setSize(tamano.x, tamano.y);
    camera.updateMatrixWorld();
    const p = parametrosCuadro({ camara: { position: camera.position, elementos: camera.matrixWorld.elements, fov: camera.fov, aspecto: camera.aspect },
      origin, lienzo: [tamano.x, tamano.y], telefono: TACTIL, mapa: recursos.mapa, barra: barra,
      // B queda como se mostró: punto negro 1 a ±20°.
      ...(recursos.ruido && { negro: 1, alturaNegro: 20 * Math.PI / 180 }) });
    if (typeof window !== 'undefined') window.__galaxiaF7 = { o: p.o, s: p.s, nMedio: p.nMedio, N: p.N, iota: p.iota, ancho: p.ancho, alto: p.alto };
    const u = marcha.material.uniforms;
    u.uCam.value.set(...p.o);
    u.uRayos.value.set(p.base[0][0], p.base[1][0], p.base[2][0], p.base[0][1], p.base[1][1], p.base[2][1], p.base[0][2], p.base[1][2], p.base[2][2]);
    u.uTan.value.set(...p.tan); u.uPixAng.value = p.pixAng; u.uDh.value = p.dh; u.uPasosMax.value = p.nMax;
    u.uNegro.value = p.N; u.uInterior.value = p.iota;
    u.uEmision.value = recursos.emision; u.uPolvo.value = recursos.polvo; u.uRuido.value = recursos.ruido;
    objetivo.viewport.set(0, 0, p.ancho, p.alto);
    const previo = gl.getRenderTarget();
    gl.setRenderTarget(objetivo);
    gl.render(marcha.escena, marcha.camara);
    gl.setRenderTarget(previo);
    const c = malla.material.uniforms;
    c.uLienzo.value.copy(tamano); c.uEscala.value = p.ancho / tamano.x; c.uOpacidad.value = alfa;
}
