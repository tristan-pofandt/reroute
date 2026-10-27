// `three` is aliased to this file (vite.config.js). @react-three/fiber does `import * as THREE from "three"` and registers the whole
// namespace as JSX elements, which defeats tree-shaking and ships every class in three (~1 MB). This re-exports only what the shell
// and fiber itself need. A screen that needs another three class adds it here, e.g. `export { TubeGeometry } from "three/src/Three.js";`.
export * from "three/src/constants.js";
import * as MathUtils from "three/src/math/MathUtils.js";
export { MathUtils };
export {
  WebGLRenderer, Scene, Camera, PerspectiveCamera, OrthographicCamera, Object3D, Group, Mesh, Points, Line, LineSegments, Layers, Raycaster, Clock,
  Vector2, Vector3, Vector4, Matrix3, Matrix4, Quaternion, Euler, Color, Box3, Sphere,
  BufferGeometry, BufferAttribute, Float32BufferAttribute, PlaneGeometry, BoxGeometry, SphereGeometry, CircleGeometry, RingGeometry, TorusGeometry,
  IcosahedronGeometry, OctahedronGeometry, CylinderGeometry, ConeGeometry,
  ShaderMaterial, MeshBasicMaterial, MeshStandardMaterial, LineBasicMaterial, PointsMaterial,
  AmbientLight, DirectionalLight, PointLight, Texture, CanvasTexture, TextureLoader,
} from "three/src/Three.js";
