import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GALACTIC_X, GALACTIC_Y, GALACTIC_Z, GALAXY_CENTER, GALAXY_IMAGE_WIDTH_PC, buildGalaxyParticles, galaxyOpacity } from './galaxy.js';
import { solarDistance } from './scale.js';

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
    // Preserve dust lanes; soften the photographic plane near edge-on.
    gl_FragColor=vec4(c*.82,opacity*face*edge*.78);
    #include <logdepthbuf_fragment>
  }`;
const pointVertex = `
  attribute vec3 tint; attribute float extent;
  uniform float opacity; uniform float viewportHeight;
  varying vec3 c; varying float alpha;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    vec4 mv=modelViewMatrix*vec4(position,1.0);
    float projected=extent*viewportHeight*projectionMatrix[1][1]/max(1.0,-mv.z);
    bool cloud=extent>100.0;
    gl_PointSize=clamp(projected,cloud?1.0:1.2,cloud?75.0:3.8);
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

export default function MilkyWay({ origin, onStatus, muted = false }) {
  const [requested,setRequested]=useState(false);
  const [asset,setAsset]=useState(null);
  const group=useRef(), disc=useRef(), points=useRef(), sunLabel=useRef(), centerLabel=useRef();
  const lastVisible=useRef(false);
  const rotation=useMemo(()=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...GALACTIC_X),new THREE.Vector3(...GALACTIC_Y),new THREE.Vector3(...GALACTIC_Z))),[]);
  const normal=useMemo(()=>new THREE.Vector3(...GALACTIC_Z),[]);
  const direction=useMemo(()=>new THREE.Vector3(),[]);
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
  const pointUniforms=useMemo(()=>({opacity:{value:0},viewportHeight:{value:1000}}),[]);
  useFrame(({camera,size,gl})=>{
    const distance=solarDistance(camera.position,origin);
    if(!requested && distance>400)setRequested(true);
    const alpha=galaxyOpacity(distance)*(muted?.22:1);
    const visible=alpha>.001;
    if(asset && lastVisible.current!==visible){lastVisible.current=visible;onStatus(visible?'visible':'ready');}
    if(group.current)group.current.visible=visible;
    if(disc.current){
      camera.getWorldDirection(direction);
      disc.current.uniforms.opacity.value=alpha;
      const face=THREE.MathUtils.smoothstep(Math.abs(direction.dot(normal)),.03,.3);
      disc.current.uniforms.face.value=face;
      // At grazing angles the same samples stack into fewer pixels. Compress
      // their exposure instead of turning the disc into a white line.
      points.current.uniforms.opacity.value=alpha*(.22+.78*face);
      points.current.uniforms.viewportHeight.value=size.height*gl.getPixelRatio();
    }
    for(const label of [sunLabel.current,centerLabel.current])if(label){
      label.style.opacity=String(muted?0:alpha);
      label.style.visibility=visible&&!muted?'visible':'hidden';
    }
  });
  if(!asset)return null;
  const {samples}=asset;
  return <>
    <group ref={group} position={GALAXY_CENTER.map((v,i)=>v-origin[i])} quaternion={rotation}>
      <mesh rotation={[0,0,-Math.PI/2]} frustumCulled={false}>
        <planeGeometry args={[GALAXY_IMAGE_WIDTH_PC,GALAXY_IMAGE_WIDTH_PC]} />
        <shaderMaterial ref={disc} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}
          transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[samples.position,3]}/>
          <bufferAttribute attach="attributes-tint" args={[samples.color,3]}/>
          <bufferAttribute attach="attributes-extent" args={[samples.sizes,1]}/>
        </bufferGeometry>
        <shaderMaterial ref={points} uniforms={pointUniforms} vertexShader={pointVertex} fragmentShader={pointFragment}
          transparent depthWrite={false} blending={THREE.AdditiveBlending}/>
      </points>
    </group>
    <Html position={origin.map(v=>-v)} zIndexRange={[5,0]} style={{pointerEvents:'none'}}>
      <div ref={sunLabel} className="galaxy-marker"><i/>Sol · Estamos aquí</div>
    </Html>
    <Html position={GALAXY_CENTER.map((v,i)=>v-origin[i])} zIndexRange={[4,0]} style={{pointerEvents:'none'}}>
      <div ref={centerLabel} className="galaxy-marker galaxy-center">Centro galáctico</div>
    </Html>
  </>;
}
