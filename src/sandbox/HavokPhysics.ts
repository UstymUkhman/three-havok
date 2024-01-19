// import type { Mesh } from 'three/src/objects/Mesh';
// import { Vector3 } from 'three/src/math/Vector3';
import HavokEngine from '@/sandbox/HavokEngine';
import { Clock } from 'three/src/core/Clock';

const GRAVITY = [0.0, -9.81, 0.0];
// const VECTOR_ONE = new Vector3(1.0, 1.0, 1.0);

export default class HavokPhysics
{
  private world!: ReturnType<typeof this.engine.HP_World_Create>[1];
  private engine!: Awaited<ReturnType<typeof HavokEngine>>;
  private readonly clock = new Clock();

  public async initialize () {
    this.engine = await HavokEngine();
    this.world = this.engine.HP_World_Create()[1];
    this.engine.HP_World_SetGravity(this.world, GRAVITY);
  }

  /* public createBox (
    mesh: Mesh,
    type: string,
    rotation = VECTOR_ONE,
    scale = VECTOR_ONE
  ): void { } */

  public update (): void {
    const delta = this.clock.getDelta();
    this.engine.HP_World_Step(this.world, delta);
  }
}
