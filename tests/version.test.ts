import { parseVersion, compareVersions, isAtLeast } from '../src/utils/version';

describe('version utils', () => {
  test('parseVersion handles plain, v-prefixed, and pre-release strings', () => {
    expect(parseVersion('2.3.2')).toEqual({ major: 2, minor: 3, patch: 2 });
    expect(parseVersion('v1.21.0')).toEqual({ major: 1, minor: 21, patch: 0 });
    expect(parseVersion('2.0.0-beta.1')).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(parseVersion('2.1')).toEqual({ major: 2, minor: 1, patch: 0 });
  });

  test('parseVersion returns null for unparseable input', () => {
    expect(parseVersion('')).toBeNull();
    expect(parseVersion(null)).toBeNull();
    expect(parseVersion(undefined)).toBeNull();
    expect(parseVersion('not-a-version')).toBeNull();
  });

  test('compareVersions orders by major, minor, then patch', () => {
    expect(compareVersions(parseVersion('2.1.0')!, parseVersion('2.0.9')!)).toBeGreaterThan(0);
    expect(compareVersions(parseVersion('1.21.0')!, parseVersion('1.21.0')!)).toBe(0);
    expect(compareVersions(parseVersion('1.20.5')!, parseVersion('1.21.0')!)).toBeLessThan(0);
  });

  test('isAtLeast', () => {
    expect(isAtLeast('1.21.0', '1.21.0')).toBe(true);
    expect(isAtLeast('1.20.9', '1.21.0')).toBe(false);
    expect(isAtLeast('2.3.2', '2.1.0')).toBe(true);
    expect(isAtLeast('2.0.0', '2.1.0')).toBe(false);
    expect(isAtLeast(null, '1.21.0')).toBe(false);
  });
});
