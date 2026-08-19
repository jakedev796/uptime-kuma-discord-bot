export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

// Parses "2.3.2", "v2.3.2", "2.0.0-beta.1" etc. into its numeric core (pre-release
// suffix is ignored). Returns null if it can't be parsed.
export function parseVersion(input: string | null | undefined): SemVer | null {
  if (!input) {
    return null;
  }
  const match = String(input).trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: match[3] ? parseInt(match[3], 10) : 0,
  };
}

export function compareVersions(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

// true if version >= minimum (unparseable input returns false)
export function isAtLeast(version: string | null | undefined, minimum: string): boolean {
  const v = parseVersion(version);
  const min = parseVersion(minimum);
  if (!v || !min) {
    return false;
  }
  return compareVersions(v, min) >= 0;
}
