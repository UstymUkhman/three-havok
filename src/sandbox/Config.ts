import {
  sRGBEncoding,
  LinearEncoding,
  type ToneMapping,
  ACESFilmicToneMapping
} from 'three/src/constants';

import { Color } from 'three/src/math/Color';
import { Euler } from 'three/src/math/Euler';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector2 } from 'three/src/math/Vector2';

type OutputEncoding =
  typeof sRGBEncoding |
  typeof LinearEncoding;

export namespace Config
{
  export const Scene = {
    toneMapping: ACESFilmicToneMapping as ToneMapping,
    outputEncoding: LinearEncoding as OutputEncoding,
    background: Color.NAMES.whitesmoke,
    toneMappingExposure: 1.5
  };

  export const Camera = {
    position: new Vector3(0.0, 35.0, 70.0),
    target: new Vector3(0.0, 6.0, 0.0),
    fov: 50.0,
    near: 0.1,
    far: 500.0
  };

  export const Lights = {
    ambient: {
      color: Color.NAMES.white,
      intensity: 0.25
    },

    directional: {
      position: new Vector3(0.0, 35.0, 70.0),
      rotation: new Euler(1.0, 0.0, 0.0),
      color: Color.NAMES.white,
      intensity: 1.0,

      shadow: {
        mapSize: new Vector2(1024.0, 1024.0),
        cast: true,

        camera: {
          bottom: -50.0,
          right: 100.0,
          left: -100.0,
          far: 200.0,
          near: 1.0,
          top: 60.0
        }
      },

      helper: {
        color: Color.NAMES.white,
        visible: DEBUG,
        size: 10.0
      }
    }
  };

  export const Ground = {
    color: Color.NAMES.white,
    size: 500.0,
    cell: 50.0
  };

  export const Fog = {
    color: Color.NAMES.whitesmoke,
    visible: true,
    near: 100.0,
    far: 250.0
  };
}
