import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AU_TO_PC, KM_TO_PC, LIGHT_YEAR_PC, LIGHT_DAY_PC, lightDayRulerOpacity, smoothRange, oortLabelOpacity, starLabelOpacity } from './scale';
import { SOLAR_BODIES } from './solarBodies';
import { BINARY_STATE } from './binaryOrbit';
import { heliosphereVisibility } from './heliosphereScale';
import { selectStarLabels } from './starLabelSelection';
import { kuiperOpacity } from './kuiper';
import { barraDesdeDistancia, textoDistancia } from './escalaNavegacion.js';

const format = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const smallLightYears = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 4 });
const vector = new THREE.Vector3();
const right = new THREE.Vector3();
const solarOrigin = new THREE.Vector3();
const earth = new THREE.Vector3(...SOLAR_BODIES.find(body => body.name === 'Tierra').position);
const RULERS = [
  { selector: '[data-ruler]', length: LIGHT_YEAR_PC, gap: 69, day: false },
  { selector: '[data-day-ruler]', length: LIGHT_DAY_PC, gap: 48, day: true },
];

export default function VisualGuides({ overlayRef, labels, focusedBody, origin, binary, aimTarget }) {
  const elapsed = useRef(0);
  const visibleStars = useRef(new Set());
  const labelAlpha = useRef(new Map());
  useFrame(({ camera, size }, delta) => {
    elapsed.current += delta;
    if (!overlayRef.current) return;
    const frameTime = elapsed.current;
    elapsed.current = 0;
    const root = overlayRef.current;
    camera.updateMatrixWorld();
    const pc = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    const earthPc = Math.hypot(camera.position.x + origin[0] - earth.x, camera.position.y + origin[1] - earth.y, camera.position.z + origin[2] - earth.z);
    const barra = root.querySelector('[data-barra-distancia]');
    if (barra) {
      const valor=barraDesdeDistancia(earthPc);
      barra.dataset.valor=valor;
      barra.style.setProperty('--posicion', `${100-valor}%`);
      if (barra.dataset.vista === '') {
        barra.setAttribute('aria-valuenow', valor.toFixed(1));
        barra.setAttribute('aria-valuetext', textoDistancia(earthPc));
      }
    }
    const au = pc / AU_TO_PC;
    root.querySelector('[data-distance]').textContent = au < 1000
      ? `${au < 0.01 ? au.toLocaleString('es-CL', { maximumSignificantDigits: 4 }) : format.format(au)}`
      : `${(pc / LIGHT_YEAR_PC < 0.1 ? smallLightYears : format).format(pc / LIGHT_YEAR_PC)}`;
    root.querySelector('[data-distance-unit]').textContent = au < 1000 ? 'UA' : 'años luz';
    root.querySelector('[data-distance-arc]').setAttribute('stroke-dasharray', `${barraDesdeDistancia(pc) * .75} 100`);
    root.querySelector('[data-distance-detail]').textContent = `${pc < 0.01 ? pc.toLocaleString('es-CL', {maximumSignificantDigits:3}) : format.format(pc)} pc`;
    const inspectingStar = origin.some(Boolean) || focusedBody?.kind === 'star' || aimTarget?.kind === 'star';
    const nameOpacity = inspectingStar ? 0.9 : starLabelOpacity(pc);
    if (focusedBody) {
      const distancePc = camera.position.distanceTo(vector.set(...focusedBody.position).sub({ x: origin[0], y: origin[1], z: origin[2] }));
      const altitude = root.querySelector('[data-body-altitude]');
      if (altitude) altitude.textContent = focusedBody.kind === 'system' || !focusedBody.radiusKm
        ? `Distancia de cámara al sistema: ${format.format(distancePc / AU_TO_PC)} UA`
        : `Altitud de cámara: ${format.format(distancePc / KM_TO_PC - focusedBody.radiusKm)} km`;
    }
    if (aimTarget) {
      const remaining = camera.position.distanceTo(vector.set(...aimTarget.position)
        .sub({ x: origin[0], y: origin[1], z: origin[2] }));
      const readout = root.querySelector('[data-aim-distance]');
      if (readout) readout.textContent = aimTarget.star.physics && remaining < 0.01 * AU_TO_PC
        ? `A ${format.format(remaining / KM_TO_PC)} km del centro`
        : remaining < 0.1 * LIGHT_YEAR_PC
        ? `A ${format.format(remaining / AU_TO_PC)} UA de la cámara`
        : `A ${format.format(remaining / LIGHT_YEAR_PC)} años luz de la cámara`;
    }

    const project = (position, local = false, retained = false) => {
      vector.set(...position);
      if (!local) vector.sub({ x: origin[0], y: origin[1], z: origin[2] });
      vector.applyMatrix4(camera.matrixWorldInverse);
      // Comprobar profundidad en espacio de cámara; NDC z pierde precisión a estas escalas.
      const inFront = -vector.z > camera.near && -vector.z < camera.far;
      vector.applyMatrix4(camera.projectionMatrix);
      return { x: (vector.x + 1) * size.width / 2, y: (1 - vector.y) * size.height / 2,
        visible: inFront && Math.abs(vector.x) < (retained ? 1.02 : 0.97) && Math.abs(vector.y) < (retained ? 0.98 : 0.93) };
    };
    // El lienzo y el DOM se actualizan por separado al cambiar de destino.
    const guides = root.querySelector('[data-binary-guides]');
    if (binary && guides) {
      const points = [project(BINARY_STATE.wr, true), project(BINARY_STATE.o, true)];
      const close = camera.position.length() < 800 * AU_TO_PC;
      ['wr', 'o'].forEach((key, i) => {
        const label = guides.querySelector(`[data-component="${key}"]`);
        label.style.visibility = close && points[i].visible ? 'visible' : 'hidden';
        label.style.transform = `translate(${Math.max(8, Math.min(size.width - 150, points[i].x + 12))}px, ${points[i].y - 25}px)`;
      });
      const [a, b] = points;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const ruler = guides.querySelector('svg');
      ruler.style.visibility = close && a.visible && b.visible && length > 95 ? 'visible' : 'hidden';
      const dx = (b.x - a.x) / Math.max(length, 1e-9), dy = (b.y - a.y) / Math.max(length, 1e-9);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      guides.querySelector('[data-binary-path]').setAttribute('d',
        `M ${a.x} ${a.y + 16} L ${mx - dx * 36} ${my + 16 - dy * 36} M ${mx + dx * 36} ${my + 16 + dy * 36} L ${b.x} ${b.y + 16}`);
      const text = guides.querySelector('[data-binary-distance]');
      text.setAttribute('x', mx); text.setAttribute('y', my + 20);
    }
    const labelElements = root.querySelector('[data-labels]').children;
    const candidates = [];
    labels.forEach((label, i) => {
      if (label.kind !== 'star' || (nameOpacity <= 0.015 && label !== aimTarget)) return;
      const point = project(label.position, false, visibleStars.current.has(label.catalogueId));
      if (!point.visible) return;
      const width = label.width * 0.75;
      candidates.push({ id: label.catalogueId, width,
        x: Math.max(8, Math.min(point.x + 9, size.width - width - 12)), y: point.y - 8,
        hovered: labelElements[i]?.matches(':hover'),
        distance: camera.position.distanceTo(vector.set(...label.position)
          .sub({ x: origin[0], y: origin[1], z: origin[2] })),
      });
    });
    visibleStars.current = selectStarLabels(candidates, visibleStars.current, aimTarget?.catalogueId ?? focusedBody?.star?.i, size.width < 700 ? 6 : 12);
    labels.forEach((label, i) => {
      const el = labelElements[i];
      if (!el) return; // El lienzo y el DOM pueden actualizarse en cuadros distintos.
      const point = project(label.position, false, visibleStars.current.has(label.catalogueId));
      let alpha = 1;
      if (label.kind === 'sun') {
        alpha = 1 - smoothRange(pc / LIGHT_YEAR_PC, 650, 700);
       } else if (label.kind === 'moon') {
        const distance = camera.position.distanceTo(vector.set(...label.position).sub(new THREE.Vector3(...origin)));
        alpha = 1 - smoothRange(distance / AU_TO_PC, 0.015, 0.06);
      } else if (label.kind === 'planet') {
        const radiusPixels = label.au * AU_TO_PC / pc * size.height
          / (2 * Math.tan(camera.fov * Math.PI / 360));
        alpha = smoothRange(radiusPixels, 20, 50);
      } else if (label.kind === 'probe') {
        alpha = smoothRange(au, 100, 250) * (1 - smoothRange(earthPc, 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC));
      } else if (label.kind === 'star') {
        alpha = nameOpacity;
        if (aimTarget === label) alpha = 0.9;
        if (!visibleStars.current.has(label.catalogueId)) alpha = 0;
        const previousAlpha = labelAlpha.current.get(label.catalogueId) || 0;
        alpha = previousAlpha + (alpha - previousAlpha) * (1 - Math.exp(-10 * frameTime));
        labelAlpha.current.set(label.catalogueId, alpha);
        const button = el.querySelector('button');
        if (button) {
          button.disabled = false;
          button.title = 'Doble clic: fijar rumbo sin desplazarse';
        }
      } else if (label.kind === 'oort') {
        alpha = oortLabelOpacity(pc) * 3;
      } else if (label.kind === 'kuiper') {
        alpha = origin.some(Boolean) ? 0 : kuiperOpacity(pc)*2;
      } else if (label.kind === 'heliosphere') {
        alpha = binary ? 0 : heliosphereVisibility(pc) * 0.9;
      }
      // Colocar el nombre junto al borde físico del cuerpo, sin ocultarlo al elegirlo.
      const bodyDistance = label.body?.radiusKm ? camera.position.distanceTo(vector.set(...label.position)
        .sub({x:origin[0],y:origin[1],z:origin[2]})) : Infinity;
      const bodyPixels = (label.body?.radiusKm || 0) * KM_TO_PC / Math.max(bodyDistance, camera.near)
        * size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
      const width = label.width * (label.kind === 'star' ? 0.75 : 1.2);
      const box = { x: Math.max(8, Math.min(point.x + Math.min(bodyPixels, size.width/3) + 9, size.width - width - 12)), y: point.y - 8 };
      const visible = point.visible && alpha > 0.015;
      el.style.opacity = visible ? alpha : 0;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        el.style.transform = `translate(${box.x}px, ${box.y}px)`;
      }
    });

    // Segmentos orientados a cámara con longitudes reales; solo el hueco del texto usa píxeles.
    solarOrigin.copy(earth).sub(new THREE.Vector3(...origin)).project(camera);
    const sx = (solarOrigin.x + 1) * size.width / 2;
    const sy = (1 - solarOrigin.y) * size.height / 2 - 48;
    for (const definition of RULERS) {
      right.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(definition.length);
      const end = project(right.add(earth).toArray());
      const width = end.x - sx;
      const ruler = root.querySelector(definition.selector);
      const alpha = definition.day
        ? lightDayRulerOpacity(earthPc, width, size.width - sx - 12)
        : pc > 0.05 ? smoothRange(width, 155, 210)
          * (1 - smoothRange(width, size.width * 0.7, size.width)) * 0.72 : 0;
      const visible = !binary && end.visible && alpha > 0 && (!definition.day
        || (solarOrigin.z > -1 && solarOrigin.z < 1 && sx >= 12 && sy >= 12 && sy < size.height - 12));
      ruler.style.opacity = visible ? alpha : 0;
      ruler.style.visibility = visible ? 'visible' : 'hidden';
      const middle = (sx + end.x) / 2;
      ruler.querySelector('[data-ruler-path]').setAttribute('d',
        `M ${sx} ${sy + 10} V ${sy} H ${middle - definition.gap} M ${middle + definition.gap} ${sy} H ${end.x} V ${sy + 10}`);
      const text = ruler.querySelector('[data-ruler-text]');
      text.setAttribute('x', middle);
      text.setAttribute('y', sy + 4);
    }
    // Situar la etiqueta de Oort en su envoltura; sin esfera de niebla opaca.
    root.querySelector('[data-oort-note]').style.opacity = !origin.some(Boolean) && oortLabelOpacity(pc) > 0.05 ? 0.45 : 0;
  }, 0);
  return null;
}
