import type { OrgDisplayDefaults, TeamDisplayOverrides } from '@pkg/types';

export function deepMergeDisplaySettings(
  orgDefaults: OrgDisplayDefaults,
  teamOverrides?: TeamDisplayOverrides
): OrgDisplayDefaults {
  if (!teamOverrides) return orgDefaults;

  const result: OrgDisplayDefaults = {
    common: { ...orgDefaults.common, ...(teamOverrides.common || {}) }
  };

  const sports = ['football', 'basket', 'volleyball', 'handball', 'rugby'] as const;
  sports.forEach((sport) => {
    if (orgDefaults[sport] || teamOverrides[sport]) {
      result[sport] = {
        ...(orgDefaults[sport] || {}),
        ...(teamOverrides[sport] || {})
      } as any;
    }
  });

  return result;
}
