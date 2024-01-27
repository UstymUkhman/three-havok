type PhysicsObject = PhysicsInstancedObject & { mesh: Mesh, dynamic: boolean };
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

  private updateBodyMaterial (
    body: bigint[],
    restitution: number,
    staticFriction?: number,
    dynamicFriction = staticFriction
  ): this {
    const shape = this.engine.HP_Body_GetShape(body)[1];
    const material = this.engine.HP_Shape_GetMaterial(shape)[1];

    if (staticFriction) material[0] = staticFriction;
    if (dynamicFriction) material[1] = dynamicFriction;

    material[2] = restitution;

    // material[3]: keyof typeof this.engine.MaterialCombine - Friction combine
    // material[4]: keyof typeof this.engine.MaterialCombine - Restitution combine

    this.engine.HP_Shape_SetMaterial(shape, material);

    return this;
  }

  private updateBodyMass (
    body: bigint[],
    mass: number
  ): this {
    const massProperties = this.engine.HP_Body_GetMassProperties(body)[1];

    // massProperties[0]: Array(3) - Center of mass, relative to the body
    massProperties[1] = mass;   // - Actual body mass
    // massProperties[2]: Array(3) - Inertia
    // massProperties[3]: Array(4) - Inertia orientation

    this.engine.HP_Body_SetMassProperties(body, massProperties);

    return this;
  }

  public createBox (
    mesh: Mesh,
    rotation = EULER_ONE,
    scale = VECTOR_ONE,
    type = 'static'
  ): void {
    const dynamic = type !== 'static';

    const boxBody = this.createBoxBody(
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
    );

    this
      .updateBodyMass(boxBody.body, 10)
      .updateBodyMaterial(boxBody.body, 0.75, 1);

    this.objects.push({ mesh, dynamic, ...boxBody });
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
    const body: bigint[] = this.engine.HP_Body_Create()[1];
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

    this.updateBodyMaterial(body, 0.75).updateBodyMass(body, 1e3);
    this.objects.push({ mesh, offset, body, dynamic: true });
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

      if (!object.dynamic) continue;

      const transform = this.engine.HP_Body_GetQTransform(object.body)[1];

      object.mesh.quaternion.fromArray(transform[1]);
      object.mesh.position.fromArray(transform[0]);
    }

    this.instancedObjects.forEach((objects, mesh) => {
      this.instancedArray.set(mesh.instanceMatrix.array);

      for (let o = objects.length; o--; ) {
        const object = objects[o], offset = o * 16.0;

        const transformBuffer = new Float32Array(
          this.engine.HEAPU8.buffer,
          bodyBuffer + object.offset,
          16.0
        );

        for (let i = 0; i < 15; i++) if ((i & 3) !== 3)
          this.instancedArray[offset + i] = transformBuffer[i];

        mesh.instanceMatrix.copyArray(this.instancedArray);
      }

      mesh.instanceMatrix.needsUpdate = true;
    });
  }
}
