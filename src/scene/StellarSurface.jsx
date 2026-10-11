import { Suspense, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { STELLAR_TEXTURE, temperatureColor } from './stellarPhysics';

const vertexShader = `
  varying vec2 surfaceUv;
  varying vec3 eyeNormal;
  varying vec3 eyeDirection;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    surfaceUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    eyeNormal = normalize(normalMatrix * normal);
    eyeDirection = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;
const fragmentShader = `
  uniform sampler2D surfaceMap;
  uniform vec3 temperatureTint;
  varying vec2 surfaceUv;
  varying vec3 eyeNormal;
  varying vec3 eyeDirection;
  #include <logdepthbuf_pars_fragment>
  void main() {
    // Use solar structure only, not the map's orange display palette.
    vec3 texel = texture2D(surfaceMap, surfaceUv).rgb;
    float structure = dot(texel, vec3(0.2126, 0.7152, 0.0722));
    float mu = max(0.0, dot(normalize(eyeNormal), normalize(eyeDirection)));
    float limb = 0.45 + 0.55 * sqrt(mu);
    float intensity = (0.28 + 0.72 * sqrt(structure)) * limb;
    gl_FragColor = vec4(temperatureTint * intensity, 1.0);
    #include <logdepthbuf_fragment>
    #include <colorspace_fragment>
  }
`;

function SurfaceMaterial({ temperatureK }) {
  const gl = useThree(state => state.gl);
  const configure = useCallback(texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [gl]);
  const map = useTexture(STELLAR_TEXTURE, configure);
  const uniforms = useMemo(() => {
    const [r, g, b] = temperatureColor(temperatureK);
    return { surfaceMap: { value: map }, temperatureTint: { value: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace) } };
  }, [map, temperatureK]);
  return <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} toneMapped={false} />;
}

// Unit mesh translated in CPU double precision; radius is never pixel-enlarged.
export default function StellarSurface({ position, radiusPc, temperatureK }) {
  return <mesh position={position} scale={radiusPc} rotation={[Math.PI / 2, 0, 0]}>
    <sphereGeometry args={[1, 128, 96]} />
    <Suspense fallback={<meshBasicMaterial color="white" />}>
      <SurfaceMaterial temperatureK={temperatureK} />
    </Suspense>
  </mesh>;
}
