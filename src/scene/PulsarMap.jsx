import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { PULSARS } from './pulsarData';
import { pulsarGeometry } from './pulsarGeometry';


export default function PulsarMap({ origin }) {
  const data=useMemo(()=>pulsarGeometry(origin),[origin]);
  const mat=useRef();
  const uniforms=useMemo(()=>({pixelRatio:{value:1}}),[]);
  useFrame(({gl})=>{mat.current.uniforms.pixelRatio.value=gl.getPixelRatio();});
  return <group>
    <lineSegments frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.lines,3]} /></bufferGeometry>
      <lineBasicMaterial color="#45d7e4" transparent opacity={0.58} depthWrite={false} />
    </lineSegments>
    <lineSegments frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.dashes,3]} /></bufferGeometry>
      <lineBasicMaterial color="#a8f8ff" transparent opacity={0.78} depthWrite={false} />
    </lineSegments>
    <points frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.points,3]} /></bufferGeometry>
      <shaderMaterial ref={mat} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending}
        vertexShader={`uniform float pixelRatio;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mvPosition;gl_PointSize=24.0*pixelRatio;
          #include <logdepthbuf_vertex>
          }`}
        fragmentShader={`
          #include <logdepthbuf_pars_fragment>
          void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=dot(p,p);
          float a=exp(-r*70.0)+0.28*exp(-r*11.0);
          gl_FragColor=vec4(mix(vec3(0.2,0.82,0.94),vec3(1.0),exp(-r*80.0)),a*(1.0-smoothstep(0.6,1.0,r)));
          #include <logdepthbuf_fragment>
          }`} />
    </points>
    {PULSARS.map(p=><Html key={p.id} position={p.position.map((v,i)=>v-origin[i])} zIndexRange={[5,1]} style={{pointerEvents:'auto'}}>
      <button className="pulsar-label" aria-label={p.id} title={`${p.id} · distancia estimada ${(p.distancePc*3.26156).toFixed(0)} años luz`}><span>{p.bname}</span></button>
    </Html>)}
  </group>;
}
