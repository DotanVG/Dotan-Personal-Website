/** Desktop column count for the featured-projects grid. */
export function featuredDesktopColumns(count: number): 2 | 3 {
  if (count > 0 && count % 3 !== 0 && count % 2 === 0) return 2;
  return 3;
}
