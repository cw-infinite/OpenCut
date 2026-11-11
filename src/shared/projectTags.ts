export function normalizeProjectTags(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 20 || input.some(tag => typeof tag !== 'string')) throw new Error('Use up to 20 text tags.');
  const tags = new Map<string, string>();
  for (const value of input as string[]) {
    const tag = value.trim().replace(/\s+/g, ' ');
    if (tag.length > 40 || tag.includes(',')) throw new Error('Tags must be at most 40 characters and cannot contain commas.');
    if (tag) tags.set(tag.toLowerCase(), tag);
  }
  return [...tags.values()];
}
