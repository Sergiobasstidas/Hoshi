import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { buildKuiperPositions, kuiperOpacity } from './kuiper';
import { solarDistance } from './scale';
export default function KuiperBelt({ origin }) {
  const points=useRef(), material=useRef();
  const positions=useMemo(()=>buildKuiperPositions(),[]);
  useFrame(({camera,gl})=>{
    const opacity=kuiperOpacity(solarDistance(camera.position, origin));
    points.current.visible=opacity>.001;
    material.current.uniforms.opacity.value=opacity;
    material.current.uniforms.pixelRatio.value=gl.getPixelRatio();
  });
  return <points ref={points}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]} /></bufferGeometry>
    <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false}
      uniforms={{opacity:{value:0},pixelRatio:{value:1}}}
      vertexShader={`uniform float pixelRatio;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=1.3*pixelRatio;
        #include <logdepthbuf_vertex>
        }`}
      fragmentShader={`uniform float opacity;
        #include <logdepthbuf_pars_fragment>
        void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.55,.67,.73,opacity*(1.-smoothstep(.2,1.,r)));
        #include <logdepthbuf_fragment>
        }`} />
  </points>;
}
