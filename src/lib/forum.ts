export function createForumThreadPreview(content: string, maxLength = 180) {
  const compact = content
    .replace(/\s+/g, ' ')
    .trim();

  if (compact.length <= maxLength) return compact;

  const sliced = compact.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(' ');
  const safeSlice = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;

  return `${safeSlice.replace(/[.,;:!?-]+$/, '')}…`;
}
