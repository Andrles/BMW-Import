// Numeric series first, then X, i, iX; unknown families follow alphabetically.
const collator = new Intl.Collator('ru', {numeric: true, sensitivity: 'base'});
function familyKey(family) {
 const f = String(family || '').trim();
 for (const [rank, pattern] of [[0, /^(\d+)\s+серия$/], [1, /^X(\d+)$/i], [2, /^i(\d+)$/i], [3, /^iX(\d*)$/i]]) {
  const match = f.match(pattern);
  if (match) return [rank, match[1] ? Number(match[1]) : 0, f];
 }
 return [4, 0, f];
}
export function sortCatalog(models) {
 return [...models].sort((a, b) => {
  const x = familyKey(a.family), y = familyKey(b.family);
  return x[0]-y[0] || x[1]-y[1] || collator.compare(x[2], y[2]) || collator.compare(a.name, b.name) || (a.year || 0)-(b.year || 0) || collator.compare(a.id, b.id);
 });
}
