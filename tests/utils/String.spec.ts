import { describe, test, expect } from 'vitest';
import { capitalize, camelCase } from '@/utils/String';

describe('String', () => {
  test('capitalize', () => {
    const name = 'three havok';
    const capitalized = 'Three havok';
    expect(capitalize(name)).toStrictEqual(capitalized);
  });

  test('camelCase', () => {
    const name = 'Three Havok';
    const camelCased = 'threeHavok';
    expect(camelCase(name)).toStrictEqual(camelCased);
  });
});
