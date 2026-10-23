/** Up to two upper-case initials for an avatar, e.g. "Asha Rao" → "AR". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
