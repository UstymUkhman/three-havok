type PhysicsObject = PhysicsInstancedObject & { mesh: Mesh, static: boolean };
import type { SphereGeometry } from 'three/src/geometries/SphereGeometry';
import type { InstancedMesh } from 'three/src/objects/InstancedMesh';
type PhysicsInstancedObject = { offset: number, body: bigint[] };

import { Quaternion } from 'three/src/math/Quaternion';
import type { Mesh } from 'three/src/objects/Mesh';
import { Vector3 } from 'three/src/math/Vector3';
import HavokEngine from '@/sandbox/HavokEngine';
import { Euler } from 'three/src/math/Euler';
import { Clock } from 'three/src/core/Clock';

const VECTOR_ZERO = new Vector3(0.0, 0.0, 0.0);
const VECTOR_ONE = new Vector3(1.0, 1.0, 1.0);
const GRAVITY = new Vector3(0.0, -9.81, 0.0);
const EULER_ZERO = new Euler(0.0, 0.0, 0.0);
const EULER_ONE = new Euler(1.0, 1.0, 1.0);

export default class HavokPhysics
{
  private readonly instancedObjects: Map<InstancedMesh, PhysicsInstancedObject[]> = new Map();
  private world!: ReturnType<typeof this.engine.HP_World_Create>[1];
  private engine!: Awaited<ReturnType<typeof HavokEngine>>;

  private readonly objects: PhysicsObject[] = [];
  private instancedArray!: Float32Array;
  private readonly clock = new Clock();

  public async initialize () {
    this.engine = await HavokEngine();
    this.world = this.engine.HP_World_Create()[1];
    this.engine.HP_World_SetGravity(this.world, GRAVITY.toArray());
  }

  private createBoxBody (
    position: Vector3,
    rotation: Euler,
    scale: Vector3,
    type: string
  ): PhysicsInstancedObject {
    const body = this.engine.HP_Body_Create()[1];
    const qRotation = new Quaternion().setFromEuler(rotation);

    this.engine.HP_Body_SetShape(body, this.engine.HP_Shape_CreateBox(
      [0, 0, 0], [0, 0, 0, 1], [scale.x, scale.y, scale.z]
    )[1]);

    this.engine.HP_Body_SetQTransform(body, [
      [position.x, position.y, position.z],
      [qRotation.x, qRotation.y, qRotation.z, qRotation.w]
    ]);

    this.engine.HP_World_AddBody(this.world, body, false);
    const offset = this.engine.HP_Body_GetWorldTransformOffset(body)[1];
    this.engine.HP_Body_SetMotionType(body, this.engine.MotionType[type.toUpperCase()]);

    return { offset, body };
  }

  public createBox (
    mesh: Mesh,
    rotation = EULER_ONE,
    scale = VECTOR_ONE,
    type = 'static'
  ): void {
    this.objects.push({
      mesh,
      static: type === 'static',
      ...this.createBoxBody(
        mesh.position,
        new Euler(
          mesh.rotation.x * rotation.x,
          mesh.rotation.y * rotation.y,
          mesh.rotation.z * rotation.z
        ),
        new Vector3(
          mesh.scale.x * scale.x,
          mesh.scale.y * scale.y,
          mesh.scale.z * scale.z
        ),
        type
      )
    });
  }

  public createInstancedBox (
    mesh: InstancedMesh,
    position = VECTOR_ZERO,
    rotation = EULER_ZERO,
    scale = VECTOR_ONE,
    type = 'dynamic'
  ): void {
    const instancedObjects = this.instancedObjects.get(mesh) ?? [];
    instancedObjects.push(this.createBoxBody(position, rotation, scale, type));

    this.instancedArray = new Float32Array(mesh.count * 16);
    this.instancedObjects.set(mesh, instancedObjects);
  }

  public createSphere (mesh: Mesh): void {
    const body = this.engine.HP_Body_Create()[1];
    const qRotation = new Quaternion().setFromEuler(mesh.rotation);

    this.engine.HP_Body_SetShape(body, this.engine.HP_Shape_CreateSphere(
      [0, 0, 0], (mesh.geometry as SphereGeometry).parameters.radius
    )[1]);

    this.engine.HP_Body_SetQTransform(body, [
      [mesh.position.x, mesh.position.y, mesh.position.z],
      [qRotation.x, qRotation.y, qRotation.z, qRotation.w]
    ]);

    this.engine.HP_World_AddBody(this.world, body, false);
    const offset = this.engine.HP_Body_GetWorldTransformOffset(body)[1];
    this.engine.HP_Body_SetMotionType(body, this.engine.MotionType['DYNAMIC']);

    const massProperties = this.engine.HP_Body_GetMassProperties(body)[1];

    // massProperties[0]: Array(3) - Center of mass, relative to the body
    massProperties[1] = 1e3;    // - Actual body mass
    // massProperties[2]: Array(3) - Inertia
    // massProperties[3]: Array(4) - Inertia orientation

    this.engine.HP_Body_SetMassProperties(body, massProperties);
    this.objects.push({ mesh, offset, body, static: false });
  }

  public update (): void {
    const delta = this.clock.getDelta();
    this.engine.HP_World_Step(this.world, delta);

    const bodyBuffer = this.engine.HP_World_GetBodyBuffer(this.world)[1];

    for (let o = this.objects.length; o--; ) {
      const object = this.objects[o];

      const transformBuffer = new Float32Array(
        this.engine.HEAPU8.buffer,
        bodyBuffer + object.offset,
        16.0
      );

      for (let i = 0; i < 15; i++) if ((i & 3) !== 3)
        object.mesh.matrix.elements[i] = transformBuffer[i];

      // object.mesh.matrix.elements[15] = 1.0;

      if (object.static) continue;

      const transform = this.engine.HP_Body_GetQTransform(object.body)[1];

      object.mesh.quaternion.fromArray(transform[1]);
      object.mesh.position.fromArray(transform[0]);
    }

    this.instancedObjects.forEach((objects, mesh) => {
      // const { array } = mesh.instanceMatrix;
      this.instancedArray.set(mesh.instanceMatrix.array);

      for (let o = objects.length; o--; ) {
        const offset = 16.0 * o;
        const object = objects[o];

        const transformBuffer = new Float32Array(
          this.engine.HEAPU8.buffer,
          bodyBuffer + object.offset,
          16.0
        );

        for (let i = 0; i < 15; i++) if ((i & 3) !== 3)
          this.instancedArray[offset + i] = transformBuffer[i];

        mesh.instanceMatrix.copyArray(this.instancedArray);

        // for (let i = 0; i < 15; i++) if ((i & 3) !== 3)
        //   array[offset + i] = transformBuffer[i];

        // this.instancedArray[offset + 15] = 1.0;
        // array[offset + 15] = 1.0;
      }

      mesh.instanceMatrix.needsUpdate = true;
    });
  }
}
