import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GALACTIC_X, GALACTIC_Y, GALACTIC_Z, GALAXY_CENTER, GALAXY_IMAGE_WIDTH_PC, buildGalaxyParticles, galaxyOpacity, galaxyFacing, galaxyPlaneFade } from './galaxy.js';
import { smoothRange, solarDistance } from './scale.js';
import GalaxiaVolumen from './GalaxiaVolumen.jsx';
import { GALAXIA_F7, SIN_F7, TRAMOS_C } from '../f7/opciones.js';
import modeloB from '../f7/modeloB.json';
import { BULBO as BULBO_B } from './galaxiaModeloB.js';
import { CRUCE_C, camaraGalactica, pesoVolumenC } from './galaxiaModelo.js';

// F-07: con ?f7=a o ?f7=b la imagen plana y las partículas se reemplazan por el volumen (GalaxiaVolumen.jsx).
// Con ?f7=c se mantienen la imagen y las partículas por fuera, y dentro del disco se ve el volumen de B (nubes de gas y polvo):
// el cruce depende solo de la posición de la cámara (pesoVolumenC); nunca se ven a la vez los brazos de B y los de la imagen.
const VOLUMEN = GALAXIA_F7 === 'a' || GALAXIA_F7 === 'b';
const MIXTA = GALAXIA_F7 === 'c';
const VARIANTE_VOLUMEN = MIXTA ? 'b' : GALAXIA_F7;
const TRAMOS = Object.fromEntries(Object.entries(CRUCE_C).map(([k, v]) => [k, TRAMOS_C[k] ?? v]));
const UMBRAL_C = 0.02;

const vertex = `
  varying vec2 vUv;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    #include <logdepthbuf_vertex>
  }`;
const fragment = `
  uniform sampler2D map; uniform float opacity; uniform float face;
  varying vec2 vUv;
  #include <logdepthbuf_pars_fragment>
  void main(){
    vec3 c=texture2D(map,vUv).rgb;
    float edge=1.0-smoothstep(.42,.50,length(vUv-.5));
    edge*=smoothstep(.045,.075,length((vUv-vec2(.5,.945))*vec2(1.3,1.0)));
    // Conservar las bandas de polvo; suavizar el plano fotográfico al verlo de canto.
    gl_FragColor=vec4(c*.82,opacity*face*edge*.78);
    #include <logdepthbuf_fragment>
  }`;
const pointVertex = `
  attribute vec3 tint; attribute float extent;
  uniform float opacity; uniform float viewportHeight; uniform float topeNube;
  varying vec3 c; varying float alpha;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    float projected=extent*viewportHeight*projectionMatrix[1][1]/max(1.0,-mv.z);
    bool cloud=extent>100.0;
    gl_PointSize=clamp(projected,cloud?1.0:1.2,cloud?topeNube:3.8);
    c=tint;
    alpha=opacity*(cloud?.065:.32)*smoothstep(150.0,750.0,length(mv.xyz));
    gl_Position=projectionMatrix*mv;
    #include <logdepthbuf_vertex>
  }`;
const pointFragment = `
  varying vec3 c; varying float alpha;
  #include <logdepthbuf_pars_fragment>
  void main(){vec2 p=gl_PointCoord*2.0-1.0; float r=dot(p,p);
    gl_FragColor=vec4(c,alpha*exp(-r*4.5)*(1.0-smoothstep(.6,1.0,r)));
    #include <logdepthbuf_fragment>
  }`;

// Fracción de la atenuación de canto que se aplica (antes 1).
const EDGE_DIMMING=.55;

// dim atenúa el disco sin ocultar sus rótulos (modo de descubrimientos de exoplanetas).
export default function MilkyWay({ origin, onStatus, muted = false, dim = 1 }) {
  const [requested,setRequested]=useState(false);
  const [asset,setAsset]=useState(null);
  const group=useRef(), disc=useRef(), points=useRef(), sunLabel=useRef(), centerLabel=useRef();
  const lastVisible=useRef(false);
  const opacidadVolumen=useRef(0);
  const cruce=useRef({W:1,sinBrazos:0,fuerzaCerca:1});
  const rotation=useMemo(()=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...GALACTIC_X),new THREE.Vector3(...GALACTIC_Y),new THREE.Vector3(...GALACTIC_Z))),[]);
  useEffect(()=>{
    if(!requested) return;
    let active=true, texture;
    onStatus('loading');
    const image=new Image();
    image.onload=()=>{
      if(!active)return;
      try {
        const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
        const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0,256,256);
        const samples=buildGalaxyParticles(ctx.getImageData(0,0,256,256).data,256,256);
        texture=new THREE.Texture(image); texture.needsUpdate=true;
        texture.minFilter=THREE.LinearMipmapLinearFilter;
        setAsset({texture,samples}); onStatus('ready');
      }catch{onStatus('error');}
    };
    image.onerror=()=>{if(active)onStatus('error');};
    image.src='/textures/galaxy/gaia-milky-way-2025.jpg';
    return ()=>{active=false; texture?.dispose();};
  },[requested,onStatus]);
  const uniforms=useMemo(()=>({map:{value:asset?.texture},opacity:{value:0},face:{value:1}}),[asset]);
  const pointUniforms=useMemo(()=>({opacity:{value:0},viewportHeight:{value:1000},topeNube:{value:75}}),[]);
  useFrame(({camera,size,gl})=>{
    const distance=solarDistance(camera.position,origin);
    if(!requested && distance>400)setRequested(true);
    const alpha=galaxyOpacity(distance)*(muted?.22:1)*dim;
    const visible=alpha>.001;
    if(asset && lastVisible.current!==visible){lastVisible.current=visible;onStatus(visible?'visible':'ready');}
    let W=VOLUMEN?1:0;
    if(MIXTA){
      const c=pesoVolumenC(camaraGalactica(camera.position,origin),TRAMOS);
      W=c.W; cruce.current.W=c.W; cruce.current.sinBrazos=c.sinBrazos; cruce.current.fuerzaCerca=c.fuerzaCerca;
      if(typeof window!=='undefined')window.__cruceC={W:c.W,sinBrazos:c.sinBrazos,fuerzaCerca:c.fuerzaCerca,z:c.z,R:c.R};
    }
    // La imagen recibe 1 − W y las partículas (1 − W)²: dentro del plano su banda rosada cruzaría la franja oscura de B.
    const imagen=1-W, particulas=imagen*imagen;
    if(group.current)group.current.visible=visible && !VOLUMEN && !SIN_F7.has('galaxia') && (!MIXTA || alpha*imagen>.001);
    opacidadVolumen.current=SIN_F7.has('galaxia')||!(VOLUMEN||MIXTA)?0:alpha*W;
    if(disc.current)disc.current.visible=!MIXTA || alpha*imagen>.001;
    if(points.current)points.current.visible=!SIN_F7.has('particulas') && (!MIXTA || alpha*particulas>.002);
    if(disc.current){
      disc.current.uniforms.opacity.value=imagen*alpha*galaxyPlaneFade(camera.position,origin);
      // De canto se atenúa el disco: la atenuación se redujo un 45 % (pedido de Sergio, 31/10/2026).
      const face=1-EDGE_DIMMING*(1-galaxyFacing(camera.position,origin));
      disc.current.uniforms.face.value=face;
      // A ángulos rasantes las muestras se acumulan en menos píxeles. Comprimir
      // su exposición para evitar convertir el disco en una línea blanca.
      points.current.material.uniforms.opacity.value=particulas*alpha*(1-.78*EDGE_DIMMING*(1-galaxyFacing(camera.position,origin)));
      points.current.material.uniforms.viewportHeight.value=size.height*gl.getPixelRatio();
      // C: en el cruce las manchas difusas se achican (75 → 40 px) para no sumar su costo al del volumen.
      points.current.material.uniforms.topeNube.value=75-35*smoothRange(W,0,.5);
    }
    for(const label of [sunLabel.current,centerLabel.current])if(label){
      label.style.opacity=String(muted?0:alpha);
      label.style.visibility=visible&&!muted?'visible':'hidden';
    }
  });
  if(!asset)return null;
  const {samples}=asset;
  return <>
    {(VOLUMEN||MIXTA) && <GalaxiaVolumen variante={VARIANTE_VOLUMEN} origin={origin} opacidad={opacidadVolumen}
      escalaE={VARIANTE_VOLUMEN==='b'?modeloB.escalaE:1} barraGrados={VARIANTE_VOLUMEN==='b'?BULBO_B.angulo:undefined}
      {...(MIXTA && { cruce, umbral: UMBRAL_C })} />}
    <group ref={group} position={GALAXY_CENTER.map((v,i)=>v-origin[i])} quaternion={rotation}>
      <mesh rotation={[0,0,-Math.PI/2]} frustumCulled={false}>
        <planeGeometry args={[GALAXY_IMAGE_WIDTH_PC,GALAXY_IMAGE_WIDTH_PC]} />
        <shaderMaterial ref={disc} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}
          transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <points ref={points} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[samples.position,3]}/>
          <bufferAttribute attach="attributes-tint" args={[samples.color,3]}/>
          <bufferAttribute attach="attributes-extent" args={[samples.sizes,1]}/>
        </bufferGeometry>
        <shaderMaterial uniforms={pointUniforms} vertexShader={pointVertex} fragmentShader={pointFragment}
          transparent depthWrite={false} blending={THREE.AdditiveBlending}/>
      </points>
    </group>
    <Html position={origin.map(v=>-v)} zIndexRange={[5,0]} style={{pointerEvents:'none'}}>
      <div ref={sunLabel} className="galaxy-marker"><i/>Sol</div>
    </Html>
    <Html position={GALAXY_CENTER.map((v,i)=>v-origin[i])} zIndexRange={[4,0]} style={{pointerEvents:'none'}}>
      <div ref={centerLabel} className="galaxy-marker galaxy-center">Centro galáctico</div>
    </Html>
  </>;
}
