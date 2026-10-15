import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera } from 'three';
import { AU_KM, KM_TO_PC, BODY_CAMERA_NEAR_PC, SCENE_FAR_PC, SUN_RADIUS_PC, solarDistance, MAX_FLIGHT_SPEED_PC } from '../src/scene/scale.js';
import { SOLAR_BODIES, MOON, MOON_DISTANCE_KM, bodyView } from '../src/scene/solarBodies.js';
import { EPHEMERIS_DATE, moonOffset, moonPosition, orbitalElements, planetOrbit, planetPosition } from '../src/scene/solarEphemeris.js';
import { encodedDepth } from '../src/scene/depthPrecision.js';
import { readFileSync } from 'node:fs';
import { WR140_ID, identifyStellarTargets, stellarTargets } from '../src/scene/stellarTargets.js';
import { advanceFlight } from '../src/scene/flightMotion.js';
import { canAimStar, createStarAim, advanceStarAim, STAR_AIM_SECONDS, STAR_STOP_PC, approachSpeed, stopBeforeTarget } from '../src/scene/starHeading.js';
import { selectStarLabels } from '../src/scene/starLabelSelection.js';
import { buildSearchIndex, searchStars } from '../src/scene/starSearch.js';
import { buildKuiperPositions, kuiperFadeOut, kuiperOpacity } from '../src/scene/kuiper.js';
import { journeyDistance, journeyProgress, JOURNEY_SECONDS, JOURNEY_ACCELERATION, JOURNEY_DECELERATION } from '../src/scene/starJourney.js';
import { beginJourney, advanceJourney, constrainFlight, PULSAR_VIEW, PULSAR_VIEW_DISTANCE_PC, pulsarFieldOfView } from '../src/scene/navigation.js';
import { PULSARS } from '../src/scene/pulsarData.js';
import { PROXIMA_CATALOGUE_ID, PROXIMA_PHYSICS } from '../src/scene/publishedStellarPhysics.js';
import { HELIOSPHERE_BRIGHTNESS, probeVisibility } from '../src/scene/heliosphereScale.js';

test('Próxima tiene dimensiones físicas publicadas y permite acercarse a menos de una UA', () => {
  const star = JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json',import.meta.url),'utf8')).find(s=>s.i===PROXIMA_CATALOGUE_ID);
  assert.equal(star.n, 'Proxima Centauri');
  assert.equal(PROXIMA_PHYSICS.radiusSolar, .146);
  assert.equal(PROXIMA_PHYSICS.temperatureK, 2980);
  const view = bodyView({kind:'star',position:[star.x,star.y,star.z],radiusKm:PROXIMA_PHYSICS.radiusKm});
  assert.ok(view.distance < .01*AU_TO_PC);
  assert.ok(view.minDistance > PROXIMA_PHYSICS.radiusPc);
  assert.ok(stellarStopDistance(PROXIMA_PHYSICS) < .001*AU_TO_PC);
  assert.ok(bodyView({kind:'star',position:[0,0,0]}).minDistance < AU_TO_PC);
  assert.ok(STAR_STOP_PC < AU_TO_PC);
});

test('Kuiper conserva la misma atenuación del 20 por ciento cerca y lejos; Voyager conserva su transición', () => {
  assert.equal(kuiperOpacity(80*AU_TO_PC),.45*.8);
  assert.equal(kuiperOpacity(155*AU_TO_PC),.45*.8);
  assert.equal(kuiperOpacity(120*AU_TO_PC),.45*.8);
  // Las órbitas de los planetas se apagan con Kuiper.
  assert.equal(kuiperFadeOut(200*AU_TO_PC),1);
  assert.ok(kuiperFadeOut(500*AU_TO_PC)>0 && kuiperFadeOut(500*AU_TO_PC)<1);
  assert.equal(kuiperFadeOut(800*AU_TO_PC),0);
  assert.equal(HELIOSPHERE_BRIGHTNESS,.7*.85);
  assert.equal(probeVisibility(.02*LIGHT_YEAR_PC),0);
  assert.equal(heliosphereVisibility(.02*LIGHT_YEAR_PC),1);
});

test('Cambiar el origen conserva la pose global, permite llegar a la estrella e interrumpir para enfocar el Sol', () => {
  const camera = new PerspectiveCamera(50, 16 / 9);
  camera.position.set(1, 2, 3);
  const origin = [2000, -300, 1500];
  const view = { target: origin, distance: 0.000001,
    journey: { start: camera.position.toArray(), rotation: camera.quaternion.toArray(), arriveFree: true } };
  let motion = beginJourney(camera, view, origin);
  assert.ok(camera.position.clone().add(new Vector3(...origin)).distanceTo(new Vector3(1, 2, 3)) < 1e-10);
  assert.equal(motion.duration, 8);
  for (let i = 0; i < 100; i++) advanceJourney(camera, motion, view, 50, 0.02);
  const interruptedPosition = camera.position.clone().add(new Vector3(...origin));
  const sunView = { target: [0,0,0], journey: {start:interruptedPosition.toArray(),rotation:camera.quaternion.toArray(),headingOnly:true} };
  motion = beginJourney(camera, sunView, [0,0,0]);
  for (let i = 0; i < 100; i++) advanceJourney(camera, motion, sunView, 50, 0.02);
  assert.ok(camera.position.distanceTo(interruptedPosition) < 1e-10, 'el enfoque nunca debe cambiar la posición');
  assert.ok(camera.getWorldDirection(new Vector3()).dot(interruptedPosition.clone().normalize().negate()) > .999999);
  const resume = {...view,journey:{...view.journey,start:camera.position.toArray(),rotation:camera.quaternion.toArray()}};
  motion = beginJourney(camera, resume, origin);
  for (let i = 0; i < 700; i++) advanceJourney(camera, motion, resume, 50, .02);
  assert.ok(Math.abs(camera.position.length()-view.distance) < 1e-12);
});

test('El escenario solar conserva posición aparente y visibilidad al cambiar el origen durante una búsqueda', () => {
  const camera = new PerspectiveCamera(50,16/9);
  const earth = new Vector3(...SOLAR_BODIES.find(b=>b.name==='Tierra').position);
  camera.position.copy(earth).add(new Vector3(0,0,0.000001));
  camera.lookAt(earth); camera.updateMatrixWorld();
  const before = earth.clone().project(camera);
  const distance = solarDistance(camera.position,[0,0,0]);
  const origin = [1500,-2000,1300];
  const view = {target:origin,distance:1e-8,journey:{start:camera.position.toArray(),rotation:camera.quaternion.toArray()}};
  beginJourney(camera,view,origin); camera.updateMatrixWorld();
  const after = earth.clone().sub(new Vector3(...origin)).project(camera);
  assert.ok(Math.abs(after.x-before.x)<1e-5 && Math.abs(after.y-before.y)<1e-5);
  assert.ok(Math.abs(solarDistance(camera.position,origin)-distance)<1e-12);
  assert.ok(Math.abs(kuiperOpacity(distance)-kuiperOpacity(solarDistance(camera.position,origin)))<1e-8);
});

test('Selector y buscador comparten movimiento prolongado; solo difieren los controles de llegada', () => {
  const origin=[-0.474,-0.363,-1.157];
  const body={kind:'star',position:origin,radiusKm:PROXIMA_PHYSICS.radiusKm};
  const cameras=[new PerspectiveCamera(),new PerspectiveCamera()];
  const views=[false,true].map(arriveFree=>({...bodyView(body),journey:{start:[.001,0,.001],rotation:[0,0,0,1],arriveFree}}));
  const motions=views.map((view,i)=>beginJourney(cameras[i],view,origin));
  assert.equal(motions[0].duration,8);
  for(let frame=0;frame<Math.ceil(JOURNEY_SECONDS*60)+2;frame++) {
    for(let i=0;i<2;i++) advanceJourney(cameras[i],motions[i],views[i],50,1/60);
    assert.ok(cameras[0].position.distanceTo(cameras[1].position)<1e-14);
    assert.ok(1-Math.abs(cameras[0].quaternion.dot(cameras[1].quaternion))<1e-12);
  }
});

test('El mapa de púlsares conserva el encuadre de 25.000 años luz dentro del límite ampliado', () => {
  assert.equal(PULSAR_VIEW.distance, PULSAR_VIEW_DISTANCE_PC);
  assert.ok(PULSAR_VIEW.distance < MAX_VIEW_DISTANCE_PC);
  for (const aspect of [16/9, 4/3, 1, .6]) {
    const camera = new PerspectiveCamera(pulsarFieldOfView(aspect),aspect,BODY_CAMERA_NEAR_PC,SCENE_FAR_PC);
    camera.up.set(0,-Math.sin(23.43928*Math.PI/180),Math.cos(23.43928*Math.PI/180));
    camera.position.fromArray(PULSAR_VIEW.direction).multiplyScalar(PULSAR_VIEW.distance);
    camera.lookAt(0,0,0); camera.updateMatrixWorld();
    for (const pulsar of PULSARS) {
      const world = new Vector3(...pulsar.position);
      const depth = -world.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const p = world.project(camera);
      // El sombreador aplica profundidad logarítmica; la Z proyectada ordinaria redondea
      // a 1 con esta relación entre planos. Comprobar recorte en espacio de cámara.
      assert.ok(Math.abs(p.x)<=.861 && Math.abs(p.y)<=.651 && depth>camera.near && depth<camera.far,pulsar.id);
    }
  }
});

test('El límite de vuelo usa coordenadas globales y no teletransporta una cámara lejana anterior', () => {
  for (const origin of [[0,0,0],[2000,-300,1500]]) {
    const offset = new Vector3(...origin);
    const previous = new Vector3(MAX_VIEW_DISTANCE_PC-1,0,0).sub(offset);
    const next = new Vector3(MAX_VIEW_DISTANCE_PC+5,0,0).sub(offset);
    constrainFlight(next,previous,origin);
    assert.ok(Math.abs(next.clone().add(offset).length()-MAX_VIEW_DISTANCE_PC)<1e-9);
    const outside = new Vector3(MAX_VIEW_DISTANCE_PC+100,0,0).sub(offset);
    const inward = outside.clone().add(new Vector3(-10,0,0));
    const expected = inward.clone();
    constrainFlight(inward,outside,origin);
    assert.deepEqual(inward,expected);
  }
});

test('La transición al mapa sigue un arco continuo incluso desde la dirección contraria', () => {
  const camera = new PerspectiveCamera();
  camera.position.fromArray(PULSAR_VIEW.direction).multiplyScalar(-PULSAR_VIEW.distance);
  const view = {...PULSAR_VIEW,journey:{start:camera.position.toArray(),rotation:camera.quaternion.toArray(),duration:4}};
  const motion = beginJourney(camera,view,[0,0,0]);
  for (let i=0;i<220;i++) {
    const previous = camera.position.clone();
    advanceJourney(camera,motion,view,60,.02);
    assert.ok(camera.position.distanceTo(previous) < MAX_VIEW_DISTANCE_PC*.04);
    assert.ok(Math.abs(camera.position.length()-PULSAR_VIEW_DISTANCE_PC)<1e-8);
  }
  assert.ok(camera.position.clone().normalize().distanceTo(new Vector3(...PULSAR_VIEW.direction))<1e-10);
});
import { ETA_CARINAE, ETA_CARINAE_ID, CURATED_SEARCH_ROWS, addCuratedSearchRows } from '../src/scene/curatedStars.js';

test('La búsqueda une nombres comunes, Bayer, Flamsteed y alias a una misma estrella existente', () => {
  const rows=JSON.parse(readFileSync(new URL('../public/data/star-search.json',import.meta.url),'utf8'));
  const index=buildSearchIndex(rows);
  for(const query of ['Alnilam','HD37128','HIP 26311','HR 1903','ε Ori','Epsilon Orionis','46 Ori']) {
    assert.equal(searchStars(index,query)[0].id,427355,query);
  }
  assert.equal(searchStars(index,'Gliese 244A')[0].id,584955);
  assert.equal(searchStars(index,'WR140')[0].id,WR140_ID);
  assert.equal(searchStars(index,'altinam')[0].id,427355);
  assert.equal(searchStars(index,'').length,0);
  assert.equal(searchStars(index,'HD999999999999').length,0);
  assert.ok(searchStars(index,'HIP').length<=8);
  const ids=new Set(JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json',import.meta.url),'utf8')).map(s=>s.i));
  assert.ok(rows.every(([id])=>ids.has(id)));
});

test('El registro curado de Eta Carinae conserva coordenadas SIMBAD y alias técnicos', () => {
  const rows=JSON.parse(readFileSync(new URL('../public/data/star-search.json',import.meta.url),'utf8'));
  const index=buildSearchIndex(addCuratedSearchRows(rows));
  for(const query of ['Eta Carinae','Eta Car','η Car','HD 93308','HR 4210','Gaia DR3 5350358584482202880']) {
    assert.equal(searchStars(index,query)[0].id,ETA_CARINAE_ID,query);
  }
  assert.equal(CURATED_SEARCH_ROWS.length,1);
  assert.ok(Math.abs(ETA_CARINAE.d - 7500 / 3.26156) < 1e-10);
  assert.ok(Math.abs(Math.hypot(ETA_CARINAE.x,ETA_CARINAE.y,ETA_CARINAE.z)-ETA_CARINAE.d)<1e-9);
  assert.ok(ETA_CARINAE.x<0 && ETA_CARINAE.y>0 && ETA_CARINAE.z<0);
});

test('Kuiper es un disco reproducible de 30 a 50 UA en el marco orbital', () => {
  const points=buildKuiperPositions(1000);
  assert.deepEqual(points,buildKuiperPositions(1000));
  for(let i=0;i<points.length;i+=3) {
    const radius=Math.hypot(points[i],points[i+1],points[i+2])/AU_TO_PC;
    assert.ok(radius>=29.99999&&radius<=50.00001);
    const zEcliptic=-points[i+1]*Math.sin(23.43928*Math.PI/180)+points[i+2]*Math.cos(23.43928*Math.PI/180);
    assert.ok(Math.abs(zEcliptic)/(radius*AU_TO_PC)<=Math.sin(18*Math.PI/180)+1e-6);
  }
  assert.equal(kuiperOpacity(5*AU_TO_PC),0);
  assert.ok(kuiperOpacity(110*AU_TO_PC)>0);
  assert.equal(kuiperOpacity(800*AU_TO_PC),0);
});

test('Los viajes estelares parten y terminan sin discontinuidades ni sobrepasar el destino', () => {
  for(const [start,end] of [[2000,SUN_RADIUS_PC*6],[.0001,.01]]) {
    assert.ok(Math.abs(journeyDistance(start,end,0)/start-1)<1e-12);
    assert.ok(Math.abs(journeyDistance(start,end,1)/end-1)<1e-12);
    let previous=start;
    for(let i=1;i<=1000;i++) {
      const value=journeyDistance(start,end,i/1000);
      assert.ok(end<start?value<=previous+1e-15:value>=previous-1e-15);
      previous=value;
    }
    const first=Math.abs(journeyDistance(start,end,.001)-start);
    const middle=Math.abs(journeyDistance(start,end,.1)-journeyDistance(start,end,.099));
    assert.ok(first<middle);
  }
  const unknown=bodyView({kind:'star',position:[1,2,3]});
  assert.ok(Number.isFinite(unknown.distance)&&unknown.distance>unknown.minDistance);
});
import { radiusFromLuminosity, estimateStellarPhysics, temperatureColor, stellarStopDistance } from '../src/scene/stellarPhysics.js';

test('Los radios siguen Stefan–Boltzmann y rechazan datos ausentes', () => {
  assert.equal(radiusFromLuminosity(1, 5772), 1);
  assert.equal(radiusFromLuminosity(4, 5772), 2);
  assert.equal(radiusFromLuminosity(1, 11544), 0.25);
  assert.equal(radiusFromLuminosity(null, 5772), null);
  const solar = estimateStellarPhysics({ bv: 0.656, mv: 4.81, spectrum: 'G2 V' });
  assert.ok(Math.abs(solar.radiusSolar - 1) < 0.02);
  assert.equal(estimateStellarPhysics({ bv: null, mv: 2, spectrum: 'A0 V' }), null);
  assert.equal(estimateStellarPhysics({ bv: 1.4, mv: 12, spectrum: 'M5 V' }), null);
  assert.equal(estimateStellarPhysics({ bv: 0.1, mv: -5, spectrum: 'WC7' }), null);
  assert.equal(estimateStellarPhysics({ bv: 0.1, mv: 1, spectrum: 'A0 V + G2 V' }), null);
  const cool = temperatureColor(4000), hot = temperatureColor(15000);
  assert.ok(cool[0] > cool[2]);
  assert.ok(hot[2] > hot[0]);
});

test('La llegada estelar se detiene sobre la fotosfera física y permite retroceder', () => {
  for (const radiusSolar of [0.1, 1, 1000]) {
    const radiusPc = radiusSolar * SUN_RADIUS_PC;
    const stop = stellarStopDistance({ radiusPc });
    for (const fps of [20, 144]) {
      const target = new Vector3(1800, -2000, 1200);
      const camera = new PerspectiveCamera();
      camera.position.copy(target).add(new Vector3(0, 0, 1000 * radiusPc));
      camera.lookAt(target);
      for (let i = 0; i < fps * 18; i++) {
        const start = camera.position.clone();
        advanceFlight(camera, new Set(['KeyW']), approachSpeed(1000, start.distanceTo(target), stop), 1 / fps);
        stopBeforeTarget(camera, start, target, stop);
        assert.ok(camera.position.distanceTo(target) > radiusPc);
      }
      assert.ok(Math.abs(camera.position.distanceTo(target) - stop) < Math.max(radiusPc * 0.01, 1e-12));
      const before = camera.position.distanceTo(target);
      advanceFlight(camera, new Set(['KeyS']), radiusPc, 0.1);
      assert.ok(camera.position.distanceTo(target) > before);
    }
  }
});
import { WR140_ORBIT, binaryState, BINARY_STATE, dateMjd } from '../src/scene/binaryOrbit.js';
import { buildStellarAppearance, stellarMarkerSize, vividStellarColor } from '../src/scene/stellarAppearance.js';
import { HELIOSPHERE_RADIUS_PC, HELIOSPHERE_VIEW_DISTANCE_PC, heliosphereVisibility } from '../src/scene/heliosphereScale.js';
import { LIGHT_DAY_PC, LIGHT_DAY_RULER_LIMIT_PC, lightDayRulerOpacity } from '../src/scene/scale.js';
import { AU_TO_PC, ECLIPTIC_UP, LIGHT_YEAR_PC, MAX_VIEW_DISTANCE_PC, PLANETS, orbitalPosition, starExposure, oortOpacity, oortLabelOpacity, oortPointScale, starLabelOpacity, backgroundGain, flightSpeed, wheelSpeed, stellarVisualWeight } from '../src/scene/scale.js';

test('La visita a WR 140 usa el punto de catálogo sin duplicarlo ni cambiar coordenadas', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json', import.meta.url), 'utf8'));
  const original = catalogue.find(star => star.i === WR140_ID);
  const identified = identifyStellarTargets(catalogue);
  assert.equal(identified.length, catalogue.length);
  assert.equal(identified.filter(star => star.i === WR140_ID).length, 1);
  assert.deepEqual(identified.find(star => star.i === WR140_ID), { ...original, n: 'Wolf-Rayet 140' });
  assert.equal(original.n, null);
  const [target] = stellarTargets(identified);
  assert.deepEqual(target.position, [original.x, original.y, original.z]);
  assert.ok(Math.abs(Math.hypot(...target.position) - original.d) < 0.001);
  const view = bodyView(target);
  assert.deepEqual(view.target, target.position);
  assert.equal(view.distance, 80 * AU_TO_PC);
  assert.ok(view.minDistance > BODY_CAMERA_NEAR_PC && view.minDistance < view.distance);
  assert.ok(Math.hypot(...target.position) + view.distance < MAX_VIEW_DISTANCE_PC);
  assert.deepEqual(stellarTargets([]), []);
});

test('La órbita kepleriana de WR 140 conserva masas, período y extremos de separación', () => {
  const o = WR140_ORBIT;
  for (const phase of [0, 0.001, 0.1, 0.25, 0.5, 0.8, 0.99]) {
    const state = binaryState(o.periastronMjd + phase * o.periodDays);
    const next = binaryState(o.periastronMjd + (phase + 1) * o.periodDays);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(state.wr[i] * o.massWr + state.o[i] * o.massO) < 1e-15);
      assert.ok(Math.abs(state.wr[i] - next.wr[i]) < 1e-13);
    }
    assert.ok(Math.abs(new Vector3(...state.wr).distanceTo(new Vector3(...state.o)) / AU_TO_PC - state.separationAu) < 1e-10);
  }
  assert.ok(Math.abs(binaryState(o.periastronMjd).separationAu - o.semiMajorAu * (1 - o.eccentricity)) < 1e-10);
  assert.ok(Math.abs(binaryState(o.periastronMjd + o.periodDays / 2).separationAu - o.semiMajorAu * (1 + o.eccentricity)) < 1e-10);
  assert.equal(dateMjd('1970-01-01'), 40587);
});

test('La orientación de WR 140 concuerda con el ángulo y separación observados por CHARA el 01/07/2019', () => {
  // Thomas et al. tabla 3: HJD-2450000.5 = 8665.351; AP 152,458°, separación 13,017 mas.
  const s = binaryState(58665.351), o = WR140_ORBIT;
  const v = s.o.map((x, i) => (x - s.wr[i]) / AU_TO_PC);
  const ra = o.raHours * Math.PI / 12, dec = o.decDeg * Math.PI / 180;
  const east = -v[0] * Math.sin(ra) + v[1] * Math.cos(ra);
  const north = -v[0] * Math.sin(dec) * Math.cos(ra) - v[1] * Math.sin(dec) * Math.sin(ra) + v[2] * Math.cos(dec);
  const angle = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
  assert.ok(Math.abs(angle - 152.458) < 0.2);
  assert.ok(Math.abs(Math.hypot(east, north) / 1.518 - 13.017) < 0.15);
});

test('Las posiciones binarias locales Float32 conservan precisión inferior a una UA lejos del Sol', () => {
  const a = new Float32Array(BINARY_STATE.wr), b = new Float32Array(BINARY_STATE.o);
  const separation = Math.hypot(...a.map((x, i) => x - b[i])) / AU_TO_PC;
  assert.ok(Math.abs(separation - BINARY_STATE.separationAu) < 0.00001);
});

test('El vuelo se desplaza en ejes de cámara; variar la velocidad no mueve ni gira la cámara', () => {
  const camera = new PerspectiveCamera();
  const speed = 5 * AU_TO_PC;
  for (let i = 0; i < 60; i++) advanceFlight(camera, new Set(['KeyW']), speed, 1 / 60);
  assert.ok(Math.abs(camera.position.z + speed) < 1e-15);
  for (let i = 0; i < 60; i++) advanceFlight(camera, new Set(['KeyS']), speed, 1 / 60);
  assert.ok(camera.position.length() < 1e-15);
  camera.rotateY(Math.PI / 2);
  for (let i = 0; i < 60; i++) advanceFlight(camera, new Set(['KeyW']), speed, 1 / 60);
  assert.ok(Math.abs(camera.position.x + speed) < 1e-15);
  const position = camera.position.clone(), rotation = camera.quaternion.clone();
  for (let i = 0; i < 60; i++) advanceFlight(camera, new Set(), 2000, 1 / 60);
  assert.deepEqual(camera.position, position);
  assert.ok(camera.quaternion.angleTo(rotation) < 1e-7);
});

test('Cualquier estrella con nombre visible puede enfocarse sin límite de distancia al Sol', () => {
  assert.ok(canAimStar(new Vector3(5 * LIGHT_YEAR_PC, 0, 0), [0, 0, 0]));
  assert.ok(canAimStar(new Vector3(5.001 * LIGHT_YEAR_PC, 0, 0), [0, 0, 0]));
  assert.ok(canAimStar(new Vector3(), [2000, 0, 0]));
  assert.ok(canAimStar(new Vector3(-2000, 0, 0), [2000, 0, 0]));
});

test('La aproximación frena antes del destino incluso a máxima velocidad y permite retroceder', () => {
  for (const fps of [20, 60, 144]) {
    const camera = new PerspectiveCamera(), target = new Vector3(1800, -2000, 1200);
    camera.position.copy(target).add(new Vector3(0, 0, 0.01));
    camera.lookAt(target);
    for (let i = 0; i < fps * 20; i++) {
      const start = camera.position.clone();
      advanceFlight(camera, new Set(['KeyW']), approachSpeed(2000, start.distanceTo(target)), 1 / fps);
      stopBeforeTarget(camera, start, target);
      assert.ok(camera.position.distanceTo(target) >= STAR_STOP_PC - 1e-10);
    }
    assert.ok(Math.abs(camera.position.distanceTo(target) - STAR_STOP_PC) < 1e-8);
    const start = camera.position.clone();
    advanceFlight(camera, new Set(['KeyS']), approachSpeed(2000, start.distanceTo(target)), 1 / fps);
    stopBeforeTarget(camera, start, target);
    assert.ok(camera.position.distanceTo(target) > start.distanceTo(target));
  }
});

test('Las etiquetas cercanas tienen un cupo pequeño sin superposición y conservan selección o vecinos estables', () => {
  const candidates = Array.from({ length: 30 }, (_, id) => ({ id, distance: id + 1, x: id * 180, y: 0, width: 100 }));
  const initial = selectStarLabels(candidates, new Set(), null);
  assert.deepEqual([...initial], Array.from({ length: 12 }, (_, i) => i));
  const selected = selectStarLabels(candidates, initial, 29, 6);
  assert.equal(selected.size, 6);
  assert.ok(selected.has(29));
  const crowded = candidates.map(c => ({ ...c, x: 10, y: 10 }));
  assert.deepEqual([...selectStarLabels(crowded, new Set(), 29)], [29]);
  const close = [{ id: 1, distance: 10, x: 0, y: 0, width: 100 }, { id: 2, distance: 9.5, x: 0, y: 0, width: 100 }];
  assert.deepEqual([...selectStarLabels(close, new Set([1]), null)], [1]);
});

test('El enfoque estelar gira suavemente sin trasladarse y converge al mismo rumbo a distintas frecuencias', () => {
  const target = [4, 2, -3];
  for (const fps of [30, 60, 144]) {
    const camera = new PerspectiveCamera();
    camera.position.set(0.1, -0.4, 0.3);
    const start = camera.position.clone();
    const aim = createStarAim(camera, target, [0, 0, 0]);
    for (let i = 0; i <= STAR_AIM_SECONDS * fps; i++) {
      assert.ok(advanceStarAim(camera, aim, 1 / fps));
      assert.deepEqual(camera.position, start);
    }
    const expected = new Vector3(...target).sub(start).normalize();
    assert.ok(camera.getWorldDirection(new Vector3()).dot(expected) > 1 - 1e-12);
  }
  const camera = new PerspectiveCamera(), aim = createStarAim(camera, target, [0, 0, 0]);
  const steps = [], previous = camera.quaternion.clone();
  for (let i = 0; i < 20; i++) {
    advanceStarAim(camera, aim, STAR_AIM_SECONDS / 20);
    steps.push(previous.angleTo(camera.quaternion));
    previous.copy(camera.quaternion);
  }
  assert.ok(steps[0] < steps[9] / 20 && steps[19] < steps[9] / 20);
});

test('El rumbo fijo sigue la traslación con teclado y se libera al cruzar sin girar bruscamente', () => {
  const camera = new PerspectiveCamera();
  const target = [1, 0.5, -2], aim = createStarAim(camera, target, [0, 0, 0]);
  advanceStarAim(camera, aim, STAR_AIM_SECONDS);
  const before = camera.position.distanceTo(new Vector3(...target));
  for (let i = 0; i < 60; i++) {
    advanceFlight(camera, new Set(['KeyW']), 0.2, 1 / 60);
    advanceStarAim(camera, aim, 1 / 60);
  }
  assert.ok(Math.abs(camera.position.distanceTo(new Vector3(...target)) - (before - 0.2)) < 1e-12);
  advanceFlight(camera, new Set(['KeyD']), 0.2, 1 / 60);
  advanceStarAim(camera, aim, 1 / 60);
  assert.ok(camera.getWorldDirection(new Vector3()).dot(new Vector3(...target).sub(camera.position).normalize()) > 1 - 1e-12);
  const rotation = camera.quaternion.clone();
  camera.position.copy(new Vector3(...target).add(aim.previousOffset));
  assert.equal(advanceStarAim(camera, aim, 1 / 60), false);
  assert.deepEqual(camera.quaternion.toArray(), rotation.toArray());
  const opposite = new PerspectiveCamera();
  advanceStarAim(opposite, createStarAim(opposite, [0, 0, 1], [0, 0, 0]), STAR_AIM_SECONDS);
  assert.ok(opposite.getWorldDirection(new Vector3()).z > 0.999999);
});

test('La paleta conserva identidades cálidas y frías y deja neutros los colores desconocidos', () => {
  const warm = vividStellarColor([255, 189, 134]);
  const cool = vividStellarColor([202, 218, 255]);
  assert.ok(warm[0] > warm[1] && warm[1] > warm[2]);
  assert.ok(cool[2] > cool[1] && cool[1] > cool[0]);
  assert.ok(warm[0] - warm[2] > 0.65 && cool[2] - cool[0] > 0.35);
  for (const missing of [null, [], [NaN, 0, 255], [255, 255, 255]]) {
    assert.deepEqual(vividStellarColor(missing), [1, 1, 1]);
  }
  assert.deepEqual(vividStellarColor([0, 0, 0]), [0, 0, 0]);
});

test('El diámetro del marcador varía con magnitud absoluta sin confundirse con radio físico', () => {
  let previous = Infinity;
  for (let m = -12; m <= 20; m += 0.05) {
    const size = stellarMarkerSize(m);
    assert.ok(size > 0.45 && size < 2.25 && size < previous);
    previous = size;
  }
  assert.ok(stellarMarkerSize(-6) / stellarMarkerSize(15) > 4.5);
  assert.ok(Number.isFinite(stellarMarkerSize(null)));
  assert.ok(Number.isFinite(stellarMarkerSize(NaN)));
});

test('La apariencia del catálogo conserva el presupuesto nominal de área y luz durante su aparición', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json', import.meta.url), 'utf8'));
  for (const named of [true, false]) {
    const stars = catalogue.filter(star => Boolean(star.n) === named && star.n !== 'Sol' && star.n !== 'Sun');
    const before = JSON.stringify(stars[0]);
    const appearance = buildStellarAppearance(stars);
    const oldEnergy = appearance.luminosity.reduce((sum, value) => sum + value, 0);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      let energy = 0, area = 0;
      for (let i = 0; i < stars.length; i++) {
        const size = 1 - t + appearance.markerSize[i] * t;
        const light = appearance.luminosity[i] * (1 - t) + appearance.individualLuminosity[i] * t;
        energy += light * size ** 2;
        area += size ** 2;
        assert.ok(Number.isFinite(light) && light > 0);
      }
      assert.ok(area / stars.length <= 1.00001);
      assert.ok(energy / oldEnergy <= 1.00001 && energy / oldEnergy > 0.9);
      if (t === 1) assert.ok(Math.abs(energy / oldEnergy - 1) < 1e-6);
    }
    assert.equal(JSON.stringify(stars[0]), before);
    assert.equal(appearance.markerSize.length, stars.length);
  }
  assert.equal(buildStellarAppearance([]).markerSize.length, 0);
});

test('La visibilidad estelar permanece positiva y monótona en todo el recorrido', () => {
  let previous = 0;
  for (let i = 0; i <= 2000; i++) {
    const pc = 10 ** (-8 + i / 2000 * 12);
    const exposure = starExposure(pc);
    assert.ok(Number.isFinite(exposure) && exposure >= 0.13 && exposure <= 0.681);
    assert.ok(exposure >= previous);
    previous = exposure;
  }
});

test('No hay discontinuidad en el antiguo apagón de 120.000 UA', () => {
  for (const au of [110000, 120000, 122000, 200000]) {
    const before = starExposure((au - 1) * AU_TO_PC);
    const after = starExposure((au + 1) * AU_TO_PC);
    assert.ok(before > 0.13 && after > 0.13);
    assert.ok(Math.abs(after - before) < 0.0001);
  }
});

test('La aparición inicial se retrasa pero las estrellas aumentan su brillo hacia un año luz', () => {
  assert.equal(starExposure(0.01 * LIGHT_YEAR_PC), 0.13);
  assert.ok(starExposure(LIGHT_YEAR_PC) >= 0.4 && starExposure(LIGHT_YEAR_PC) < 0.55);
  assert.ok(starExposure(0.1) < starExposure(LIGHT_YEAR_PC));
  assert.equal(starExposure(5 * AU_TO_PC), 0.13);
});

test('El círculo inclinado de referencia conserva las distancias declaradas en parsecs', () => {
  assert.equal(PLANETS.length, 8);
  assert.equal(PLANETS.find(p => p.name === 'Tierra').au, 1);
  for (const planet of PLANETS) {
    for (const angle of [0, 0.5, Math.PI, Math.PI * 1.7]) {
      const actual = Math.hypot(...orbitalPosition(planet, angle));
      assert.ok(Math.abs(actual - planet.au * AU_TO_PC) < 1e-12);
    }
  }
});

test('El círculo inclinado conserva inclinación y nodo publicados en el marco ecuatorial', () => {
  const earth = PLANETS.find(p => p.name === 'Tierra');
  const ex = new Vector3(...orbitalPosition(earth, 0)).normalize();
  const ey = new Vector3(...orbitalPosition(earth, Math.PI / 2)).normalize();
  const earthNormal = ex.clone().cross(ey).normalize();
  for (const planet of PLANETS) {
    const node = new Vector3(...orbitalPosition(planet, 0)).normalize();
    const quarter = new Vector3(...orbitalPosition(planet, Math.PI / 2)).normalize();
    const normal = node.clone().cross(quarter).normalize();
    const actualInclination = Math.atan2(normal.clone().cross(earthNormal).length(), normal.dot(earthNormal)) * 180 / Math.PI;
    assert.ok(Math.abs(actualInclination - planet.inclinationDeg) < 1e-10);
    const actualNode = (Math.atan2(node.dot(ey), node.dot(ex)) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(actualNode - planet.ascendingNodeDeg) < 1e-10);
    assert.ok(Math.abs(node.dot(earthNormal)) < 1e-12);
    for (const angle of [0.3, 1, 2, 4, 6]) {
      const point = new Vector3(...orbitalPosition(planet, angle)).normalize();
      assert.ok(Math.abs(point.dot(normal)) < 1e-12);
    }
    if (planet !== earth) assert.ok(quarter.dot(earthNormal) > 0);
  }
});

test('Oort permanece tenue y desaparece sin afectar la visibilidad estelar', () => {
  for (const pc of [0, 0.01, 0.05, 0.194, 0.582, 1.05, 2, 5, 65]) {
    assert.ok(Number.isFinite(oortOpacity(pc)));
    assert.ok(oortOpacity(pc) >= 0 && oortOpacity(pc) <= 0.30);
  }
  assert.equal(oortOpacity(0.01), 0);
  assert.equal(oortOpacity(0.0999 * LIGHT_YEAR_PC), 0);
  assert.equal(oortOpacity(0.1 * LIGHT_YEAR_PC), 0);
  assert.ok(oortOpacity(0.1001 * LIGHT_YEAR_PC) > 0);
  assert.equal(oortOpacity(65), 0);
  assert.ok(starExposure(65) > starExposure(LIGHT_YEAR_PC));
});

test('Las vistas de 800 a 10.000 años luz conservan un límite moderado de brillo', () => {
  for (const ly of [800, 880, 1000, 10000]) {
    assert.ok(starExposure(ly * LIGHT_YEAR_PC) < 0.681);
    assert.ok(starExposure(ly * LIGHT_YEAR_PC) > 0.6);
  }
});

test('Oort desaparece entre 8,5 y 16 años luz y el alejamiento llega a doscientos mil', () => {
  assert.equal(oortOpacity(8.5 * LIGHT_YEAR_PC), 0.3);
  assert.ok(oortOpacity(11 * LIGHT_YEAR_PC) > 0);
  assert.ok(oortOpacity(11 * LIGHT_YEAR_PC) < oortOpacity(8.5 * LIGHT_YEAR_PC));
  assert.equal(oortOpacity(16 * LIGHT_YEAR_PC), 0);
  assert.ok(Math.abs(MAX_VIEW_DISTANCE_PC / LIGHT_YEAR_PC - 200000) < 1e-8);
});

test('El realce del fondo conserva la vista cercana y sigue la desaparición de Oort', () => {
  for (const pc of [0, 5 * AU_TO_PC, LIGHT_YEAR_PC, 1.05, 4]) assert.equal(backgroundGain(pc), 1);
  assert.ok(backgroundGain(8) > 1 && backgroundGain(8) < backgroundGain(12));
  assert.equal(backgroundGain(12), 2.1);
  assert.equal(backgroundGain(MAX_VIEW_DISTANCE_PC), 2.1);
});

test('La velocidad de vuelo es utilizable cerca del origen y abarca distancias estelares', () => {
  assert.ok(flightSpeed(0) > 0);
  assert.ok(flightSpeed(5 * AU_TO_PC) < AU_TO_PC * 3);
  assert.ok(flightSpeed(65) > flightSpeed(1));
  assert.ok(Number.isFinite(flightSpeed(MAX_VIEW_DISTANCE_PC)));
});

test('Oort ya brilla al aparecer su nombre y conserva el límite de brillo y la atenuación lejana', () => {
  assert.ok(oortLabelOpacity(0.066) > 0.05);
  assert.ok(oortOpacity(0.066) > 0.28);
  assert.equal(oortOpacity(0.025), 0);
  for (const pc of [0.18, 1, 4, 8, 12, 65]) {
    assert.equal(oortOpacity(pc), oortLabelOpacity(pc));
  }
});

test('Los puntos de Oort permanecen compactos al atravesar la envoltura', () => {
  const near = oortPointScale(2 * LIGHT_YEAR_PC);
  assert.ok(near >= 1 && near <= 1.35);
  assert.equal(oortPointScale(0.1 * LIGHT_YEAR_PC), near);
  assert.equal(oortPointScale(11 * LIGHT_YEAR_PC), 1);
  assert.equal(oortPointScale(20 * LIGHT_YEAR_PC), 1);
  assert.ok(Number.isFinite(oortPointScale(0)));
});

test('Los nombres estelares desaparecen a 700 años luz sin ocultar las estrellas', () => {
  assert.ok(starLabelOpacity(600 * LIGHT_YEAR_PC) > 0.8);
  assert.ok(starLabelOpacity(675 * LIGHT_YEAR_PC) > 0);
  assert.equal(starLabelOpacity(700 * LIGHT_YEAR_PC), 0);
  assert.equal(starLabelOpacity(10000 * LIGHT_YEAR_PC), 0);
  assert.ok(starExposure(700 * LIGHT_YEAR_PC) > 0);
});

test('El brillo individual distingue magnitudes sin valores extremos ilimitados', () => {
  assert.ok(stellarVisualWeight(-2) > stellarVisualWeight(1));
  assert.ok(stellarVisualWeight(1) > stellarVisualWeight(5));
  assert.ok(stellarVisualWeight(5) > stellarVisualWeight(12));
  for (const mag of [-100, 100, undefined, NaN]) {
    assert.ok(stellarVisualWeight(mag) >= 0.45 && stellarVisualWeight(mag) <= 1.5);
  }
});

test('La rueda tipo DESI acelera al subir, frena al bajar y normaliza los dispositivos', () => {
  const speed = 10;
  const faster = wheelSpeed(speed, { deltaY: -100 }, 800);
  assert.ok(faster > speed);
  assert.ok(wheelSpeed(speed, { deltaY: 100 }, 800) < speed);
  assert.ok(wheelSpeed(speed, { deltaY: -100, shiftKey: true }, 800) > faster);
  assert.ok(Math.abs(wheelSpeed(faster, { deltaY: 100 }, 800) - speed) < 1e-12);
  assert.equal(wheelSpeed(speed, { deltaY: 16 }, 800), wheelSpeed(speed, { deltaY: 1, deltaMode: 1 }, 800));
  assert.equal(wheelSpeed(speed, { deltaY: 80 }, 800), wheelSpeed(speed, { deltaY: 0.1, deltaMode: 2 }, 800));
  assert.equal(wheelSpeed(speed, { deltaY: 0 }, 800), speed);
  assert.equal(wheelSpeed(MAX_FLIGHT_SPEED_PC, { deltaY: -100 }, 800), MAX_FLIGHT_SPEED_PC);
  assert.equal(flightSpeed(1e8), MAX_FLIGHT_SPEED_PC);
  assert.equal(MAX_FLIGHT_SPEED_PC / LIGHT_YEAR_PC, 15000);
  assert.equal(wheelSpeed(1e-14, { deltaY: 100 }, 800), 1e-14);
});

test('Los radios físicos comparten escala orbital y reproducen el diámetro angular solar', () => {
  assert.equal(AU_KM, 149597870.7);
  assert.ok(Math.abs(AU_KM * KM_TO_PC / AU_TO_PC - 1) < 1e-12);
  const diameterArcsec = 2 * Math.asin(SUN_RADIUS_PC / AU_TO_PC) * 180 / Math.PI * 3600;
  // Ficha solar NASA: diámetro aparente aproximado de 1919 segundos de arco a 1 UA.
  assert.ok(Math.abs(diameterArcsec - 1919) < 2);
  const earth = SOLAR_BODIES.find(body => body.name === 'Tierra');
  assert.ok(SUN_RADIUS_PC / (earth.radiusKm * KM_TO_PC) > 109);
  assert.ok(SUN_RADIUS_PC / (earth.radiusKm * KM_TO_PC) < 110);
});

// Vectores heliocéntricos ICRF de JPL Horizons (API, centro @10, UA) para el 14/10/2026
// 00:00 TDB, consultados el 13/10/2026. Tierra es el cuerpo 399, no el baricentro.
const HORIZONS_2026_10_14 = {
  Mercurio: [2.499547920794146e-1, -2.963298485978150e-1, -1.842055350907613e-1],
  Venus: [7.025096111356521e-1, 1.779210099015513e-1, 3.561587057762663e-2],
  Tierra: [9.357183970242745e-1, 3.174894110161366e-1, 1.376224918151693e-1],
  Marte: [-4.761074975707997e-2, 1.429512358533657, 6.569682205471816e-1],
  Júpiter: [-3.564952275983285, 3.586377473994321, 1.623997005469994],
  Saturno: [9.241262951322801, 1.845119544304865, 3.641295896677802e-1],
  Urano: [8.884832199386326, 1.588313734695927e1, 6.830606774675267],
  Neptuno: [2.983531629900223e1, 1.588988781639941, -9.237031185847058e-2],
};

test('Los planetas están donde los sitúa JPL Horizons en la fecha pedida', () => {
  const date = new Date(Date.UTC(2026, 9, 14));
  for (const planet of PLANETS) {
    const expected = new Vector3(...HORIZONS_2026_10_14[planet.name]);
    const actual = new Vector3(...planetPosition(planet.name, date)).divideScalar(AU_TO_PC);
    // Los elementos aproximados de JPL difieren de la efeméride completa en minutos de arco.
    assert.ok(actual.angleTo(expected) * 180 / Math.PI < 0.1, planet.name);
    assert.ok(Math.abs(actual.length() - expected.length()) / expected.length() < 2e-3, planet.name);
  }
});

test('Las órbitas son elipses con el Sol en un foco y pasan por su planeta', () => {
  const date = new Date(Date.UTC(2026, 9, 14));
  for (const planet of PLANETS) {
    const { a, e, inclinationDeg, nodeDeg } = orbitalElements(planet.name, date);
    assert.ok(Math.abs(inclinationDeg - planet.inclinationDeg) < 0.01 && e > 0 && e < 0.21);
    const orbit = planetOrbit(planet.name, date, 720);
    const radii = [], points = [];
    for (let i = 0; i < orbit.length; i += 3) {
      points.push(new Vector3(orbit[i], orbit[i + 1], orbit[i + 2]).divideScalar(AU_TO_PC));
      radii.push(points.at(-1).length());
    }
    assert.ok(Math.abs(Math.min(...radii) - a * (1 - e)) < a * 1e-5);
    assert.ok(Math.abs(Math.max(...radii) - a * (1 + e)) < a * 1e-5);
    assert.ok(points[0].distanceTo(points.at(-1)) < a * 1e-6);
    // Plano: normal a i de la eclíptica y línea de nodos en Ω.
    const normal = points[0].clone().cross(points[180]).normalize();
    const pole = new Vector3(...ECLIPTIC_UP);
    assert.ok(Math.abs(normal.angleTo(pole) * 180 / Math.PI - Math.abs(inclinationDeg)) < 1e-3);
    if (Math.abs(inclinationDeg) > 0.1) {
      const node = pole.clone().cross(normal).normalize();
      const longitude = Math.atan2(node.dot(new Vector3(0, Math.cos(23.43928 * Math.PI / 180), Math.sin(23.43928 * Math.PI / 180))), node.x) * 180 / Math.PI;
      assert.ok(Math.abs(((longitude - nodeDeg) % 360 + 540) % 360 - 180) < 1e-3);
    }
    const body = new Vector3(...planetPosition(planet.name, date)).divideScalar(AU_TO_PC);
    // La Tierra se aparta del plano hasta unos cientos de km por su giro en torno al baricentro con la Luna.
    assert.ok(Math.abs(body.dot(normal)) < a * (planet.name === 'Tierra' ? 4e-5 : 1e-6));
    assert.ok(Math.min(...points.map(point => point.distanceTo(body))) < a * 0.01);
    // La Tierra pasa por el perihelio a comienzos de enero: en octubre se acerca al Sol.
    if (planet.name === 'Tierra') assert.ok(body.length() > 0.99 && body.length() < 1.0);
  }
  // Cuerpos, etiquetas y destinos usan la posición de la fecha en que se carga el módulo.
  for (const planet of PLANETS) assert.deepEqual(SOLAR_BODIES.find(b => b.name === planet.name).position, planetPosition(planet.name, EPHEMERIS_DATE));
  // Un período sidéreo después, la Tierra vuelve al mismo punto.
  const later = new Date(Date.UTC(2026, 9, 14) + 365.25636 * 86400000);
  assert.ok(new Vector3(...planetPosition('Tierra', later)).distanceTo(new Vector3(...planetPosition('Tierra', date))) < 1e-3 * AU_TO_PC);
});

test('Los cuerpos físicos pueden inspeccionarse sin recortar sus superficies', () => {
  assert.equal(SOLAR_BODIES.length, 10);
  for (const body of SOLAR_BODIES) {
    const view = bodyView(body);
    const radiusPc = body.radiusKm * KM_TO_PC;
    assert.ok(radiusPc > 0 && Number.isFinite(radiusPc));
    assert.deepEqual(view.target, body.position);
    assert.ok(view.distance > view.minDistance);
    assert.ok(view.minDistance - radiusPc > BODY_CAMERA_NEAR_PC * 100);
    const apparentDiameter = 2 * Math.asin(radiusPc / view.distance);
    assert.ok(apparentDiameter > 0.3 && apparentDiameter < 0.4);
  }
});

test('El búfer de profundidad separa superficies planetarias, órbitas y estrellas lejanas', () => {
  for (const body of SOLAR_BODIES) {
    const radius = body.radiusKm * KM_TO_PC;
    const surface = encodedDepth(5 * radius);
    const centre = encodedDepth(6 * radius);
    assert.ok(centre - surface > 1 / 2 ** 24);
    assert.ok(encodedDepth(1) > centre);
  }
  assert.ok(encodedDepth(BODY_CAMERA_NEAR_PC) > 0);
  assert.ok(Math.abs(encodedDepth(SCENE_FAR_PC) - 1) < 1e-8);
});

test('La regla de día luz tiene longitud física correcta y desaparece a 0,02 años luz', () => {
  assert.ok(Math.abs(LIGHT_DAY_PC / AU_TO_PC - 173.14463267424) < 1e-8);
  assert.ok(Math.abs(LIGHT_DAY_PC / LIGHT_YEAR_PC * 365.25 - 1) < 1e-5);
  assert.ok(lightDayRulerOpacity(0.01 * LIGHT_YEAR_PC, 210, 620) > 0.7);
  assert.ok(lightDayRulerOpacity(0.0195 * LIGHT_YEAR_PC, 110, 620) > 0);
  assert.equal(lightDayRulerOpacity(LIGHT_DAY_RULER_LIMIT_PC, 110, 620), 0);
  assert.equal(lightDayRulerOpacity(LIGHT_YEAR_PC, 210, 620), 0);
  assert.equal(lightDayRulerOpacity(5 * AU_TO_PC, 20000, 620), 0);
  assert.equal(lightDayRulerOpacity(0.01 * LIGHT_YEAR_PC, 80, 620), 0);
});

test('La heliosfera usa la escala aproximada de 120 UA y aparece cerca del cruce', () => {
  assert.equal(HELIOSPHERE_RADIUS_PC / AU_TO_PC, 120);
  assert.ok(Math.abs(HELIOSPHERE_RADIUS_PC / LIGHT_YEAR_PC - 0.0019) < 0.00001);
  for (const au of [0, 1, 5, 30, 80, 100, 100000]) {
    assert.equal(heliosphereVisibility(au * AU_TO_PC), 0);
  }
  assert.ok(heliosphereVisibility(HELIOSPHERE_RADIUS_PC) > 0.25);
  assert.equal(heliosphereVisibility(HELIOSPHERE_VIEW_DISTANCE_PC), 1);
  assert.equal(heliosphereVisibility(0.019 * LIGHT_YEAR_PC), 1);
  assert.equal(heliosphereVisibility(0.12 * LIGHT_YEAR_PC), 1);
  assert.ok(heliosphereVisibility(0.135 * LIGHT_YEAR_PC) > 0);
  assert.ok(heliosphereVisibility(0.145 * LIGHT_YEAR_PC) < heliosphereVisibility(0.135 * LIGHT_YEAR_PC));
  assert.equal(heliosphereVisibility(0.15 * LIGHT_YEAR_PC), 0);
  assert.equal(heliosphereVisibility(0.22 * LIGHT_YEAR_PC), 0);
  for (let au = 0; au <= 15000; au += 0.5) {
    const alpha = heliosphereVisibility(au * AU_TO_PC);
    assert.ok(Number.isFinite(alpha) && alpha >= 0 && alpha <= 1);
    assert.ok(Math.abs(alpha - heliosphereVisibility((au + 0.1) * AU_TO_PC)) < 0.003);
  }
});


test('La Luna conserva su radio medio y está donde la sitúa JPL Horizons', () => {
  const earth=SOLAR_BODIES.find(body=>body.name==='Tierra');
  assert.equal(MOON.radiusKm,1737.4);
  const separationKm = new Vector3(...MOON.position).distanceTo(new Vector3(...earth.position))/KM_TO_PC;
  assert.ok(Math.abs(separationKm-MOON.distanceKm)<1e-3);
  // Entre el perigeo y el apogeo extremos, en torno a la separación media.
  assert.ok(separationKm>356000 && separationKm<407000 && Math.abs(separationKm-MOON_DISTANCE_KM)<30000);
  // Vectores geocéntricos ICRF de JPL Horizons (301 desde 399, km), consultados el 14/10/2026.
  const horizons = [[Date.UTC(2026,9,14),[-2.044402710959230e5,-2.994152240832513e5,-1.684910031846481e5]],
    [Date.UTC(2026,9,22),[3.547970002534878e5,-1.493515980925226e5,-5.950979877149166e4]]];
  for (const [ms, expected] of horizons) {
    const actual = new Vector3(...moonOffset(new Date(ms))).divideScalar(KM_TO_PC), reference = new Vector3(...expected);
    assert.ok(actual.angleTo(reference)*180/Math.PI < 0.4);
    assert.ok(Math.abs(actual.length()-reference.length()) < 2000);
    // La Tierra y la Luna quedan a ambos lados de su baricentro, que sigue la elipse.
    const date = new Date(ms), earthAt = new Vector3(...planetPosition('Tierra', date)), moonAt = new Vector3(...moonPosition(date));
    const barycentre = earthAt.clone().multiplyScalar(81.30056).add(moonAt).divideScalar(82.30056);
    const orbit = planetOrbit('Tierra', date, 2048);
    let nearest = Infinity;
    for (let k = 0; k < orbit.length; k += 3) nearest = Math.min(nearest, barycentre.distanceTo(new Vector3(orbit[k], orbit[k+1], orbit[k+2])));
    assert.ok(nearest < 2e-3 * AU_TO_PC);
  }
});
test('Enfocar el Sol tras trasladar el origen a una estrella conserva la posición global', () => {
  const origin=[606,-112,31];
  const camera=new PerspectiveCamera();
  camera.position.set(.00002,.00003,-.00001);
  const world=camera.position.clone().add(new Vector3(...origin));
  camera.position.copy(world);
  const aim=createStarAim(camera,[0,0,0],[0,0,0]);
  for(let i=0;i<120;i++) advanceStarAim(camera,aim,1/60);
  assert.ok(camera.position.distanceTo(world)<1e-12);
  assert.ok(camera.getWorldDirection(new Vector3()).dot(world.clone().negate().normalize())>0.999999);
});


test('El mapa Voyager contiene los 14 púlsares identificados a distancias de catálogo', async () => {
  const {PULSARS}=await import('../src/scene/pulsarData.js');
  const expected='B1727-47 B1451-68 B1240-64 B0833-45 B0950+08 B0823+26 B0531+21 B0525+21 B0329+54 B2217+47 B2016+28 B1933+16 B1929+10 B1642-03'.split(' ');
  assert.deepEqual(PULSARS.map(p=>p.bname),expected);
  assert.equal(new Set(PULSARS.map(p=>p.id)).size,14);
  for(const p of PULSARS) {
    assert.ok(p.position.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...p.position)-p.distancePc)<1e-9);
    assert.ok(p.periodSeconds>0 && Number.isFinite(p.positionEpochMjd));
  }
  // La declinación austral de Vela debe permanecer debajo del plano ecuatorial.
  assert.ok(PULSARS.find(p=>p.bname==='B0833-45').position[2]<0);
});
test('Los rayos de púlsares unen el Sol real con cada extremo tras cambiar el origen', async () => {
  const {pulsarGeometry}=await import('../src/scene/pulsarGeometry.js');
  const {PULSARS}=await import('../src/scene/pulsarData.js');
  const origin=[606,-112,31],g=pulsarGeometry(origin);
  assert.equal(g.lines.length,14*6);
  assert.equal(g.points.length,15*3);
  for(let i=0;i<14;i++) for(let axis=0;axis<3;axis++) {
    assert.equal(g.lines[i*6+axis],-origin[axis]);
    assert.ok(Math.abs(g.lines[i*6+3+axis]+origin[axis]-PULSARS[i].position[axis])<0.0003);
  }
});


test('Los viajes mantienen avance sostenido y entran suavemente en una fase de frenado prolongada', () => {
  const a=JOURNEY_ACCELERATION, d=JOURNEY_DECELERATION, h=1e-5;
  const velocity=t=>(journeyProgress(t+h)-journeyProgress(t-h))/(2*h);
  assert.ok(d>a);
  assert.equal(journeyProgress(-1),0);
  assert.equal(journeyProgress(2),1);
  assert.ok(velocity(0)<1e-6 && velocity(1)<1e-6);
  assert.ok(velocity(a/2)<velocity(.4));
  assert.ok(Math.abs(velocity(.3)-velocity(.5))<1e-8, 'tramo central sostenido');
  assert.ok(velocity(.7)>velocity(.85) && velocity(.85)>velocity(.97));
  for(const join of [a,1-d]){
    assert.ok(Math.abs(velocity(join-h)-velocity(join+h))<1e-6, 'sin salto de velocidad entre fases');
  }
  for(const t of [.01,.1,.5,.9,.99]){
    const inward=journeyDistance(1e4,1e-8,t);
    const outward=journeyDistance(1e-8,1e4,t);
    assert.ok(inward>1e-8 && inward<1e4);
    assert.ok(outward>1e-8 && outward<1e4);
  }
});

test('La heliopausa pasa por los cruces de las Voyager y se orienta al viento interestelar', async () => {
  const shape = await import('../src/scene/heliosphereShape.js');
  const unit = v => { const length = Math.hypot(...v); return v.map(c => c / length); };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Cruces medidos: 121,6 UA (Voyager 1, 2012) y 119,0 UA (Voyager 2, 2018).
  for (const crossing of shape.VOYAGER_CROSSINGS) {
    const measured = Math.hypot(...crossing.position);
    assert.ok(Math.abs(measured - crossing.au) < 0.05);
    assert.ok(Math.abs(shape.heliopauseAu(unit(crossing.position)) - measured) < 1e-9);
  }
  // El anclaje apenas retoca el modelo.
  assert.ok(shape.HELIOSPHERE_FIT.every(gain => Math.abs(gain) < 0.12));
  // Nariz en Ofiuco/Escorpio: α ≈ 255°, δ ≈ −17,5° para λ 255,8°, β +5,16°.
  const [x, y, z] = shape.HELIOSPHERE_NOSE;
  assert.ok(Math.abs((Math.atan2(y, x) * 180 / Math.PI + 360) % 360 - 255.2) < 0.5);
  assert.ok(Math.abs(Math.asin(z) * 180 / Math.PI + 17.55) < 0.5);
  assert.ok(Math.abs(dot(shape.HELIOSPHERE_NOSE, shape.HELIOSPHERE_NORTH)) < 1e-12);
  // Contorno digitalizado: nariz corta, hueco entre lóbulos donde lo sitúa el artículo
  // (el medio interestelar entra a partir de ≈300–350 UA) y lóbulo sur más largo que el norte.
  const tail = shape.HELIOSPHERE_NOSE.map(c => -c);
  assert.ok(shape.HELIOSPHERE_NOSE_AU > 95 && shape.HELIOSPHERE_NOSE_AU < 125);
  assert.ok(shape.HELIOSPHERE_TAIL_AU > 300 && shape.HELIOSPHERE_TAIL_AU < 420);
  assert.ok(Math.abs(shape.heliopauseAu(tail) - shape.HELIOSPHERE_TAIL_AU) < 1e-9);
  assert.ok(shape.HELIOSPHERE_NORTH_LOBE_AU > 1.2 * shape.HELIOSPHERE_TAIL_AU);
  assert.ok(shape.HELIOSPHERE_SOUTH_LOBE_AU > shape.HELIOSPHERE_NORTH_LOBE_AU);
  // Superficie continua y con normal exterior en toda la esfera.
  for (let k = 0; k < 400; k++) {
    const d = unit([Math.sin(k * 1.7) + 0.01, Math.cos(k * 2.3), Math.sin(k * 0.9 + 1)]);
    const near = unit(d.map((c, i) => c + (i === k % 3 ? 1e-4 : 0)));
    assert.ok(Math.abs(shape.heliopauseAu(d) - shape.heliopauseAu(near)) < 1);
    assert.ok(dot(shape.heliopauseNormal(d), d) > 0);
  }
  assert.ok(Math.abs(Math.hypot(...shape.HELIOSPHERE_VIEW.direction) - 1) < 1e-12);
});
