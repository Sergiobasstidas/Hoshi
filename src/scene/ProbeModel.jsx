import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { LoadingManager, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KM_TO_PC } from './scale';

// Modelos (procedencia en el archivo de créditos del proyecto):
// «Voyager Probe (B)» para las dos Voyager y «Pioneer 10» para las dos Pioneer, gemelas.
// Comprimidos con meshopt (docs/DOCUMENTACION.md). Se piden solo al acercarse (ProbeModels.jsx).
// `boresight`: eje de la antena principal en el modelo, hacia donde se abre el plato.
// `dishModel`: diámetro del plato en unidades del modelo; `dishM`: diámetro real en metros.
const PROBE_MODELS = {
  voyager: { url: '/models/voyager.glb', boresight: [0, 1, 0], dishModel: 3.838, dishM: 3.66 },
  pioneer: { url: '/models/pioneer.glb', boresight: [0, 0, -1], dishModel: 2.874, dishM: 2.74 },
};
const modelFor = code => code === -31 || code === -32 ? PROBE_MODELS.voyager : PROBE_MODELS.pioneer;

// Gestor propio: el modelo no cuenta en el progreso de la carga inicial (SceneReady en App.jsx).
const manager = new LoadingManager();
const configure = loader => { loader.manager = manager; loader.setMeshoptDecoder(MeshoptDecoder); };

export default function ProbeModel({ probe }) {
  const model = modelFor(probe.code);
  const gltf = useLoader(GLTFLoader, model.url, configure);
  const scene = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse(object => {
      if (!object.isMesh) return;
      object.raycast = () => {};
      // Sin mapa de entorno, los materiales metálicos de glTF se ven negros: se dejan como
      // superficies mates que reciben la luz del Sol y la ambiental de la escena.
      object.material = object.material.clone();
      object.material.metalness = Math.min(object.material.metalness ?? 0, 0.15);
      object.material.roughness = Math.max(object.material.roughness ?? 1, 0.55);
      object.material.envMap = null;
      object.material.toneMapped = false;
    });
    return copy;
  }, [gltf]);
  // La antena principal apunta a la Tierra, como vuelan las sondas.
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(...model.boresight), new Vector3(...probe.towardEarth)), [model, probe]);
  const scale = model.dishM / model.dishModel / 1000 * KM_TO_PC;
  // Posición, giro y escala van en un grupo: aplicados directamente al modelo cargado, R3F intentaba
  // reemplazar su `quaternion` (de solo lectura) y la escena se caía al llegar a la sonda.
  return <group position={probe.position} quaternion={quaternion} scale={scale}><primitive object={scene} /></group>;
}
