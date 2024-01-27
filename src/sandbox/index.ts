import type { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';
import { DirectionalLightHelper } from 'three/src/helpers/DirectionalLightHelper';
import type { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial';
import type { MeshToonMaterial } from 'three/src/materials/MeshToonMaterial';
import { MeshPhongMaterial } from 'three/src/materials/MeshPhongMaterial';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';
import { SphereGeometry } from 'three/src/geometries/SphereGeometry';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { InstancedMesh } from 'three/src/objects/InstancedMesh';
import { BoxGeometry } from 'three/src/geometries/BoxGeometry';

import type { Material } from 'three/src/materials/Material';
import { AmbientLight } from 'three/src/lights/AmbientLight';
import Stats from 'three/examples/jsm/libs/stats.module';
import type { Object3D } from 'three/src/core/Object3D';
import { PCFSoftShadowMap } from 'three/src/constants';
import GroundMaterial from '@/sandbox/GroundMaterial';

import HavokPhysics from '@/sandbox/HavokPhysics';
import { Vector3 } from 'three/src/math/Vector3';
import { FrontSide } from 'three/src/constants';
import { Scene } from 'three/src/scenes/Scene';
import { Mesh } from 'three/src/objects/Mesh';
import { Color } from 'three/src/math/Color';
import { Euler } from 'three/src/math/Euler';

import { Fog } from 'three/src/scenes/Fog';
import { Config } from '@/sandbox/Config';
import Viewport from '@/utils/Viewport';
import { random } from '@/utils/Color';
import { PI } from '@/utils/Number';
import RAF from '@/utils/RAF';

export default class Sandbox
{
  private readonly update = this.render.bind(this);

  private helper!: DirectionalLightHelper;
  private directional!: DirectionalLight;
  private orbitControls!: OrbitControls;
  private readonly scene = new Scene();

  private camera!: PerspectiveCamera;
  private renderer!: WebGLRenderer;
  private ambient!: AmbientLight;
  private physics!: HavokPhysics;

  private ground!: Mesh;
  private stats?: Stats;

  public constructor () {
    this.createScene();
    this.createCamera();
    this.createLights();
    this.createGround();
    this.createPhysics();

    this.createRenderer();
    this.createControls();
    this.createStats();
  }

  private createScene (): void {
    const { background } = Config.Scene;
    this.scene.background = new Color();
    this.background = background;
    this.updateFog(Config.Fog);
  }

  private createCamera (): void {
    const { fov, near, far, position } = Config.Camera;
    this.camera = new PerspectiveCamera(fov, Viewport.size.ratio, near, far);
    this.camera.position.copy(position);
  }

  private createLights (): void {
    const { ambient, directional } = Config.Lights;

    this.ambient = new AmbientLight(ambient.color, ambient.intensity);
    this.directional = new DirectionalLight(directional.color, directional.intensity);
    this.helper = new DirectionalLightHelper(this.directional, directional.helper.size, directional.helper.color);

    this.updateDirectional(directional);
    this.scene.add(this.directional);
    this.scene.add(this.ambient);
    this.scene.add(this.helper);
  }

  private createGround (): void {
    const { color, size } = Config.Ground;

    this.ground = new Mesh(
      new PlaneGeometry(size, size),
      new GroundMaterial({ side: FrontSide, color })
    );

    this.ground.receiveShadow = true;
    this.ground.rotateX(-PI.d2);
    this.scene.add(this.ground);
  }

  private createPhysics (): void {
    this.physics = new HavokPhysics();

    this.physics.initialize().then(() => {
      const { size } = Config.Ground;

      this.physics.createBox(
        this.ground,
        new Euler(),
        new Vector3(size, 0.1, size)
      );

      this.createBoxes();

      const sphere = new Mesh(
        new SphereGeometry(4),
        new MeshPhongMaterial({
          color: random()
        })
      );

      sphere.position.y = 50;
      this.physics.createSphere(sphere);

      sphere.receiveShadow = true;
      sphere.castShadow = true;
      this.scene.add(sphere);

      RAF.add(this.update);
      RAF.pause = false;
    });
  }

  private createBoxes (): void {
    const
      size = 2,
      width = 6,
      depth = 6,
      height = 10,
      halfSize = size * 0.5,
      halfWidth = halfSize * width - halfSize,
      halfDepth = halfSize * depth - halfSize,

      boxes = new InstancedMesh(
        new BoxGeometry(size, size, size),
        new MeshPhongMaterial({
          color: new Color(),
          side: FrontSide
        }),
        height * depth * width
      );

    for (let b = 0, h = 0; h < height; h++)
      for (let d = 0; d < depth; d++)
        for (let w = 0; w < width; w++, b++) {
          boxes.setColorAt(b, new Color(random()));

          this.physics.createInstancedBox(
            boxes,
            new Vector3(
              w * size - halfWidth,
              h * size + halfSize,
              d * size - halfDepth
            ),
            undefined,
            new Vector3(size, size, size)
          );
        }

    boxes.receiveShadow = true;
    boxes.castShadow = true;
    this.scene.add(boxes);
  }

  private createRenderer (): void {
    const { toneMappingExposure, outputEncoding, background, toneMapping } = Config.Scene;
    this.renderer = new WebGLRenderer({ powerPreference: 'high-performance', antialias: true });

    this.renderer.setSize(Viewport.size.width, Viewport.size.height);
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.toneMappingExposure = toneMappingExposure;

    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.outputEncoding = outputEncoding;
    this.renderer.setPixelRatio(devicePixelRatio);

    this.renderer.setClearColor(background, 1.0);
    this.renderer.toneMapping = toneMapping;
    this.renderer.shadowMap.enabled = true;
  }

  private createControls (): void {
    this.orbitControls = new OrbitControls(this.camera, this.canvas);
    this.orbitControls.target.copy(Config.Camera.target);
    Viewport.addResizeCallback(this.resize.bind(this));

    this.orbitControls.autoRotateSpeed = -5;
    this.orbitControls.autoRotate = true;
    this.orbitControls.enabled = false;

    this.orbitControls.update();
  }

  private createStats (): void {
    if (document.body.lastElementChild?.id !== 'stats') {
      this.stats = new Stats();
      this.stats.showPanel(0);
      this.stats.dom.id = 'stats';
      this.stats.dom.style.right = '0';
      this.stats.dom.style.left = 'auto';
      document.body.appendChild(this.stats.dom);
    }
  }

  private resize (width: number, height: number, ratio: number): void {
    this.camera.aspect = ratio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private render (): void {
    this.stats?.begin();

    this.physics.update();
    this.orbitControls.update();
    this.renderer.render(this.scene, this.camera);

    this.stats?.end();
  }

  public dispose (): void {
    this.disposeNode(this.scene);
    this.orbitControls.dispose();
    this.stats?.dom.remove();

    RAF.remove(this.update);
    this.renderer.dispose();
    this.canvas.remove();
    this.scene.clear();
  }

  private disposeNode(node: Object3D): void {
    node.traverse((child?: Object3D) => {
      if (child instanceof Mesh) {
        const mesh = child as Mesh;
        mesh.geometry?.dispose();

        !mesh.material
          ? (child = undefined)
          : !Array.isArray(mesh.material)
          ? this.disposeMaterial(mesh.material)
          : mesh.material.forEach(this.disposeMaterial);
      }

      child = undefined;
    });
  }

  private disposeMaterial(material: Material): void {
    (material as MeshStandardMaterial).displacementMap?.dispose();
    (material as MeshStandardMaterial).metalnessMap?.dispose();
    (material as MeshStandardMaterial).roughnessMap?.dispose();

    (material as MeshStandardMaterial).emissiveMap?.dispose();
    (material as MeshStandardMaterial).normalMap?.dispose();
    (material as MeshStandardMaterial).alphaMap?.dispose();

    (material as MeshStandardMaterial).lightMap?.dispose();
    (material as MeshBasicMaterial).specularMap?.dispose();
    (material as MeshToonMaterial).gradientMap?.dispose();

    (material as MeshStandardMaterial).bumpMap?.dispose();
    (material as MeshStandardMaterial).envMap?.dispose();
    (material as MeshStandardMaterial).aoMap?.dispose();
    (material as MeshStandardMaterial).map?.dispose();

    material.dispose();
  }

  public get canvas (): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public set background (color: number) {
    (this.scene.background as Color).set(color);
    this.renderer?.setClearColor(color, 1.0);
  }

  public updateDirectional (directional: typeof Config.Lights.directional): void {
    const { bottom, right, left, top, near, far } = directional.shadow.camera;
    const { color, intensity, position, rotation, shadow } = directional;

    this.directional.shadow.mapSize.copy(shadow.mapSize);
    this.helper.visible = directional.helper.visible;

    this.directional.shadow.camera.bottom = bottom;
    this.directional.shadow.camera.right = right;
    this.directional.shadow.camera.left = left;
    this.directional.shadow.camera.top = top;

    this.directional.shadow.camera.near = near;
    this.directional.castShadow = shadow.cast;
    this.directional.shadow.camera.far = far;

    this.directional.position.copy(position);
    this.directional.rotation.copy(rotation);
    this.directional.intensity = intensity;
    this.directional.color.set(color);
  }

  public updateFog (fog: typeof Config.Fog): void {
    const { visible, color, near, far } = fog;
    this.scene.fog = visible ? new Fog(color, near, far) : null;

    if (this.scene.fog) {
      (this.scene.fog as Fog).near = near;
      (this.scene.fog as Fog).far = far;
      this.scene.fog.color.set(color);
    }
  }
}
