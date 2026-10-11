import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, PerspectiveCamera } from 'three';
import { AU_KM, KM_TO_PC, BODY_CAMERA_NEAR_PC, SCENE_FAR_PC, SUN_RADIUS_PC, solarDistance, MAX_FLIGHT_SPEED_PC } from '../src/scene/scale.js';
import { SOLAR_BODIES, MOON, MOON_DISTANCE_KM, bodyView } from '../src/scene/solarBodies.js';
import { encodedDepth } from '../src/scene/depthPrecision.js';
import { readFileSync } from 'node:fs';
import { WR140_ID, identifyStellarTargets, stellarTargets } from '../src/scene/stellarTargets.js';
import { advanceFlight } from '../src/scene/flightMotion.js';
import { canAimStar, createStarAim, advanceStarAim, STAR_AIM_SECONDS, STAR_STOP_PC, approachSpeed, stopBeforeTarget } from '../src/scene/starHeading.js';
import { selectStarLabels } from '../src/scene/starLabelSelection.js';
import { buildSearchIndex, searchStars } from '../src/scene/starSearch.js';
import { buildKuiperPositions, kuiperOpacity } from '../src/scene/kuiper.js';
import { journeyDistance } from '../src/scene/starJourney.js';
import { beginJourney, advanceJourney, constrainFlight, PULSAR_VIEW, PULSAR_VIEW_DISTANCE_PC, pulsarFieldOfView } from '../src/scene/navigation.js';
import { PULSARS } from '../src/scene/pulsarData.js';
import { PROXIMA_CATALOGUE_ID, PROXIMA_PHYSICS } from '../src/scene/publishedStellarPhysics.js';
import { HELIOSPHERE_BRIGHTNESS, probeVisibility } from '../src/scene/heliosphereScale.js';

test('Proxima has published physical dimensions and allows sub-AU arrival and approach', () => {
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

test('Kuiper dims by 20 percent through heliosphere reveal while Voyager keeps its old fade', () => {
  assert.equal(kuiperOpacity(80*AU_TO_PC),.45);
  assert.equal(kuiperOpacity(155*AU_TO_PC),.45*.8);
  assert.ok(kuiperOpacity(120*AU_TO_PC)<.45);
  assert.equal(HELIOSPHERE_BRIGHTNESS,.7*.85);
  assert.equal(probeVisibility(.02*LIGHT_YEAR_PC),0);
  assert.equal(heliosphereVisibility(.02*LIGHT_YEAR_PC),1);
});

test('journey rebase preserves world pose, arrives at the star, and can be interrupted to aim at Sun', () => {
  const camera = new PerspectiveCamera(50, 16 / 9);
  camera.position.set(1, 2, 3);
  const origin = [2000, -300, 1500];
  const view = { target: origin, distance: 0.000001,
    journey: { start: camera.position.toArray(), rotation: camera.quaternion.toArray(), arriveFree: true } };
  let motion = beginJourney(camera, view, origin);
  assert.ok(camera.position.clone().add(new Vector3(...origin)).distanceTo(new Vector3(1, 2, 3)) < 1e-10);
  assert.equal(motion.duration, 6.75);
  for (let i = 0; i < 100; i++) advanceJourney(camera, motion, view, 50, 0.02);
  const interruptedPosition = camera.position.clone().add(new Vector3(...origin));
  const sunView = { target: [0,0,0], journey: {start:interruptedPosition.toArray(),rotation:camera.quaternion.toArray(),headingOnly:true} };
  motion = beginJourney(camera, sunView, [0,0,0]);
  for (let i = 0; i < 100; i++) advanceJourney(camera, motion, sunView, 50, 0.02);
  assert.ok(camera.position.distanceTo(interruptedPosition) < 1e-10, 'aim must never change position');
  assert.ok(camera.getWorldDirection(new Vector3()).dot(interruptedPosition.clone().normalize().negate()) > .999999);
  const resume = {...view,journey:{...view.journey,start:camera.position.toArray(),rotation:camera.quaternion.toArray()}};
  motion = beginJourney(camera, resume, origin);
  for (let i = 0; i < 700; i++) advanceJourney(camera, motion, resume, 50, .02);
  assert.ok(Math.abs(camera.position.length()-view.distance) < 1e-12);
});

test('solar scenery keeps its apparent position and visibility when rebasing for a search journey', () => {
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

test('selector and search use identical extended motion, differing only in arrival controls', () => {
  const origin=[-0.474,-0.363,-1.157];
  const body={kind:'star',position:origin,radiusKm:PROXIMA_PHYSICS.radiusKm};
  const cameras=[new PerspectiveCamera(),new PerspectiveCamera()];
  const views=[false,true].map(arriveFree=>({...bodyView(body),journey:{start:[.001,0,.001],rotation:[0,0,0,1],arriveFree}}));
  const motions=views.map((view,i)=>beginJourney(cameras[i],view,origin));
  assert.equal(motions[0].duration,6.75);
  for(let frame=0;frame<301;frame++) {
    for(let i=0;i<2;i++) advanceJourney(cameras[i],motions[i],views[i],50,1/60);
    assert.ok(cameras[0].position.distanceTo(cameras[1].position)<1e-14);
    assert.ok(1-Math.abs(cameras[0].quaternion.dot(cameras[1].quaternion))<1e-12);
  }
});

test('pulsar map preserves its 25000 light-year framing within the expanded flight boundary', () => {
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
      // Logarithmic depth is applied by the shader; ordinary projected Z rounds
      // to 1 at this enormous near/far ratio. Test view-space clipping instead.
      assert.ok(Math.abs(p.x)<=.861 && Math.abs(p.y)<=.651 && depth>camera.near && depth<camera.far,pulsar.id);
    }
  }
});

test('free-flight boundary works in world coordinates after rebasing and never teleports an old distant camera', () => {
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

test('map transition follows a continuous arc even from the opposite direction', () => {
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

test('search joins common, Bayer, Flamsteed and catalogue aliases to the same existing star', () => {
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

test('curated Eta Carinae record keeps SIMBAD coordinates and technical aliases', () => {
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

test('Kuiper is a repeatable disc at 30–50 AU in the orbital reference frame', () => {
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

test('stellar journeys start and finish continuously without overshooting', () => {
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

test('stellar radii obey Stefan–Boltzmann scaling and reject missing data', () => {
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

test('stellar arrival stops above physical photosphere and permits retreat', () => {
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
import { AU_TO_PC, LIGHT_YEAR_PC, MAX_VIEW_DISTANCE_PC, PLANETS, orbitalPosition, starExposure, oortOpacity, oortLabelOpacity, oortPointScale, starLabelOpacity, backgroundGain, flightSpeed, wheelSpeed, stellarVisualWeight } from '../src/scene/scale.js';

test('WR 140 visits the existing catalogue point without duplication or changing coordinates', () => {
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

test('WR 140 Keplerian orbit preserves mass balance, period and physical separation extrema', () => {
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

test('WR 140 orientation agrees with CHARA 2019-07-01 observed position angle and separation', () => {
  // Thomas et al. Table 3: HJD-2450000.5 = 8665.351; PA 152.458°, separation 13.017 mas.
  const s = binaryState(58665.351), o = WR140_ORBIT;
  const v = s.o.map((x, i) => (x - s.wr[i]) / AU_TO_PC);
  const ra = o.raHours * Math.PI / 12, dec = o.decDeg * Math.PI / 180;
  const east = -v[0] * Math.sin(ra) + v[1] * Math.cos(ra);
  const north = -v[0] * Math.sin(dec) * Math.cos(ra) - v[1] * Math.sin(dec) * Math.sin(ra) + v[2] * Math.cos(dec);
  const angle = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
  assert.ok(Math.abs(angle - 152.458) < 0.2);
  assert.ok(Math.abs(Math.hypot(east, north) / 1.518 - 13.017) < 0.15);
});

test('local Float32 binary positions retain sub-AU separation accuracy far from the Sun', () => {
  const a = new Float32Array(BINARY_STATE.wr), b = new Float32Array(BINARY_STATE.o);
  const separation = Math.hypot(...a.map((x, i) => x - b[i])) / AU_TO_PC;
  assert.ok(Math.abs(separation - BINARY_STATE.separationAu) < 0.00001);
});

test('flight translates in camera axes; speed alone cannot move or rotate camera', () => {
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

test('any visible named star can be aimed at regardless of distance to the Sun', () => {
  assert.ok(canAimStar(new Vector3(5 * LIGHT_YEAR_PC, 0, 0), [0, 0, 0]));
  assert.ok(canAimStar(new Vector3(5.001 * LIGHT_YEAR_PC, 0, 0), [0, 0, 0]));
  assert.ok(canAimStar(new Vector3(), [2000, 0, 0]));
  assert.ok(canAimStar(new Vector3(-2000, 0, 0), [2000, 0, 0]));
});

test('approach brakes and stops before the target, even at maximum speed, then allows retreat', () => {
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

test('nearest labels have a small non-overlapping budget and preserve a selected or stable neighbour', () => {
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

test('star aiming eases the view without translating and ends on the same heading at different frame rates', () => {
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

test('a locked heading follows keyboard translation and releases on crossing without a flip', () => {
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

test('stellar palette retains warm/cool identities and leaves unknown/neutral colors neutral', () => {
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

test('marker diameter varies continuously with absolute magnitude without confusing it with radius', () => {
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

test('catalogue appearance preserves nominal area and light budgets through the reveal', () => {
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

test('stellar visibility remains positive and monotonic over the full navigation range', () => {
  let previous = 0;
  for (let i = 0; i <= 2000; i++) {
    const pc = 10 ** (-8 + i / 2000 * 12);
    const exposure = starExposure(pc);
    assert.ok(Number.isFinite(exposure) && exposure >= 0.13 && exposure <= 0.681);
    assert.ok(exposure >= previous);
    previous = exposure;
  }
});

test('no discontinuity at the former 120,000 AU blackout', () => {
  for (const au of [110000, 120000, 122000, 200000]) {
    const before = starExposure((au - 1) * AU_TO_PC);
    const after = starExposure((au + 1) * AU_TO_PC);
    assert.ok(before > 0.13 && after > 0.13);
    assert.ok(Math.abs(after - before) < 0.0001);
  }
});

test('early reveal is delayed but stars still brighten by one light year', () => {
  assert.equal(starExposure(0.01 * LIGHT_YEAR_PC), 0.13);
  assert.ok(starExposure(LIGHT_YEAR_PC) >= 0.4 && starExposure(LIGHT_YEAR_PC) < 0.55);
  assert.ok(starExposure(0.1) < starExposure(LIGHT_YEAR_PC));
  assert.equal(starExposure(5 * AU_TO_PC), 0.13);
});

test('all eight schematic orbits preserve their stated distances in parsecs', () => {
  assert.equal(PLANETS.length, 8);
  assert.equal(PLANETS.find(p => p.name === 'Tierra').au, 1);
  for (const planet of PLANETS) {
    for (const angle of [0, 0.5, Math.PI, Math.PI * 1.7]) {
      const actual = Math.hypot(...orbitalPosition(planet, angle));
      assert.ok(Math.abs(actual - planet.au * AU_TO_PC) < 1e-12);
    }
  }
});

test('orbital planes have their published inclination and ascending node in the equatorial frame', () => {
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
    const body = SOLAR_BODIES.find(b => b.name === planet.name);
    assert.deepEqual(body.position, orbitalPosition(planet, planet.angle));
    if (planet !== earth) assert.ok(quarter.dot(earthNormal) > 0);
  }
});

test('Oort stays subtle and fades without affecting stellar visibility', () => {
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

test('distant views from 800 to 10,000 light years retain a restrained brightness cap', () => {
  for (const ly of [800, 880, 1000, 10000]) {
    assert.ok(starExposure(ly * LIGHT_YEAR_PC) < 0.681);
    assert.ok(starExposure(ly * LIGHT_YEAR_PC) > 0.6);
  }
});

test('Oort fades from 8.5 to 16 light years and zoom reaches two hundred thousand', () => {
  assert.equal(oortOpacity(8.5 * LIGHT_YEAR_PC), 0.3);
  assert.ok(oortOpacity(11 * LIGHT_YEAR_PC) > 0);
  assert.ok(oortOpacity(11 * LIGHT_YEAR_PC) < oortOpacity(8.5 * LIGHT_YEAR_PC));
  assert.equal(oortOpacity(16 * LIGHT_YEAR_PC), 0);
  assert.ok(Math.abs(MAX_VIEW_DISTANCE_PC / LIGHT_YEAR_PC - 200000) < 1e-8);
});

test('background enhancement leaves the near view unchanged and follows the Oort fade', () => {
  for (const pc of [0, 5 * AU_TO_PC, LIGHT_YEAR_PC, 1.05, 4]) assert.equal(backgroundGain(pc), 1);
  assert.ok(backgroundGain(8) > 1 && backgroundGain(8) < backgroundGain(12));
  assert.equal(backgroundGain(12), 2.1);
  assert.equal(backgroundGain(MAX_VIEW_DISTANCE_PC), 2.1);
});

test('flight speed remains usable near the origin and scales across stellar distances', () => {
  assert.ok(flightSpeed(0) > 0);
  assert.ok(flightSpeed(5 * AU_TO_PC) < AU_TO_PC * 3);
  assert.ok(flightSpeed(65) > flightSpeed(1));
  assert.ok(Number.isFinite(flightSpeed(MAX_VIEW_DISTANCE_PC)));
});

test('Oort is already bright when its note appears, retaining the distant ceiling and fade', () => {
  assert.ok(oortLabelOpacity(0.066) > 0.05);
  assert.ok(oortOpacity(0.066) > 0.28);
  assert.equal(oortOpacity(0.025), 0);
  for (const pc of [0.18, 1, 4, 8, 12, 65]) {
    assert.equal(oortOpacity(pc), oortLabelOpacity(pc));
  }
});

test('Oort points remain compact through the shell crossing', () => {
  const near = oortPointScale(2 * LIGHT_YEAR_PC);
  assert.ok(near >= 1 && near <= 1.35);
  assert.equal(oortPointScale(0.1 * LIGHT_YEAR_PC), near);
  assert.equal(oortPointScale(11 * LIGHT_YEAR_PC), 1);
  assert.equal(oortPointScale(20 * LIGHT_YEAR_PC), 1);
  assert.ok(Number.isFinite(oortPointScale(0)));
});

test('stellar names fade by 700 light years without removing the stars', () => {
  assert.ok(starLabelOpacity(600 * LIGHT_YEAR_PC) > 0.8);
  assert.ok(starLabelOpacity(675 * LIGHT_YEAR_PC) > 0);
  assert.equal(starLabelOpacity(700 * LIGHT_YEAR_PC), 0);
  assert.equal(starLabelOpacity(10000 * LIGHT_YEAR_PC), 0);
  assert.ok(starExposure(700 * LIGHT_YEAR_PC) > 0);
});

test('individual brightness distinguishes magnitudes without unbounded outliers', () => {
  assert.ok(stellarVisualWeight(-2) > stellarVisualWeight(1));
  assert.ok(stellarVisualWeight(1) > stellarVisualWeight(5));
  assert.ok(stellarVisualWeight(5) > stellarVisualWeight(12));
  for (const mag of [-100, 100, undefined, NaN]) {
    assert.ok(stellarVisualWeight(mag) >= 0.45 && stellarVisualWeight(mag) <= 1.5);
  }
});

test('DESI wheel response accelerates upward, slows downward and normalizes input devices', () => {
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

test('physical radii share the orbital distance scale and reproduce the solar angular diameter', () => {
  assert.equal(AU_KM, 149597870.7);
  assert.ok(Math.abs(AU_KM * KM_TO_PC / AU_TO_PC - 1) < 1e-12);
  const diameterArcsec = 2 * Math.asin(SUN_RADIUS_PC / AU_TO_PC) * 180 / Math.PI * 3600;
  // NASA solar fact sheet: apparent diameter approximately 1919 arcseconds at 1 AU.
  assert.ok(Math.abs(diameterArcsec - 1919) < 2);
  const earth = SOLAR_BODIES.find(body => body.name === 'Tierra');
  assert.ok(SUN_RADIUS_PC / (earth.radiusKm * KM_TO_PC) > 109);
  assert.ok(SUN_RADIUS_PC / (earth.radiusKm * KM_TO_PC) < 110);
});

test('all physical bodies can be inspected without clipping their surface', () => {
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

test('depth buffer separates planetary surfaces from their orbits and distant stars', () => {
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

test('light-day ruler has its physical length and fades out at 0.02 light years', () => {
  assert.ok(Math.abs(LIGHT_DAY_PC / AU_TO_PC - 173.14463267424) < 1e-8);
  assert.ok(Math.abs(LIGHT_DAY_PC / LIGHT_YEAR_PC * 365.25 - 1) < 1e-5);
  assert.ok(lightDayRulerOpacity(0.01 * LIGHT_YEAR_PC, 210, 620) > 0.7);
  assert.ok(lightDayRulerOpacity(0.0195 * LIGHT_YEAR_PC, 110, 620) > 0);
  assert.equal(lightDayRulerOpacity(LIGHT_DAY_RULER_LIMIT_PC, 110, 620), 0);
  assert.equal(lightDayRulerOpacity(LIGHT_YEAR_PC, 210, 620), 0);
  assert.equal(lightDayRulerOpacity(5 * AU_TO_PC, 20000, 620), 0);
  assert.equal(lightDayRulerOpacity(0.01 * LIGHT_YEAR_PC, 80, 620), 0);
});

test('heliosphere uses the approximate 120 AU scale and reveals only near the crossing', () => {
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


test('Moon keeps its measured mean radius and mean Earth-centre distance', () => {
  const earth=SOLAR_BODIES.find(body=>body.name==='Tierra');
  assert.equal(MOON.radiusKm,1737.4);
  assert.ok(Math.abs(new Vector3(...MOON.position).distanceTo(new Vector3(...earth.position))/KM_TO_PC-MOON_DISTANCE_KM)<1e-6);
});
test('aiming at Sun after a distant local-origin rebase preserves world position', () => {
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


test('Voyager map has the 14 identified pulsars at catalogue distances', async () => {
  const {PULSARS}=await import('../src/scene/pulsarData.js');
  const expected='B1727-47 B1451-68 B1240-64 B0833-45 B0950+08 B0823+26 B0531+21 B0525+21 B0329+54 B2217+47 B2016+28 B1933+16 B1929+10 B1642-03'.split(' ');
  assert.deepEqual(PULSARS.map(p=>p.bname),expected);
  assert.equal(new Set(PULSARS.map(p=>p.id)).size,14);
  for(const p of PULSARS) {
    assert.ok(p.position.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...p.position)-p.distancePc)<1e-9);
    assert.ok(p.periodSeconds>0 && Number.isFinite(p.positionEpochMjd));
  }
  // Vela's southern declination must remain below the equatorial plane.
  assert.ok(PULSARS.find(p=>p.bname==='B0833-45').position[2]<0);
});
test('pulsar rays join the actual Sun to every endpoint after rebasing', async () => {
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
