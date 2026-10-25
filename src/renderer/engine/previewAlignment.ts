export interface AlignmentPoint { x: number; y: number }
export interface AlignmentGuide { axis: 'x' | 'y'; position: number; canvas: boolean }

/** Match element anchors in screen pixels so snapping feels the same at every zoom. */
export function alignPreview(points: AlignmentPoint[], targets: AlignmentPoint[], delta: AlignmentPoint, size: { width: number; height: number }, disabled = false) {
  const result = { ...delta, guides: [] as AlignmentGuide[] };
  if (disabled) return result;
  for (const axis of ['x', 'y'] as const) {
    const threshold = 7 / (axis === 'x' ? size.width : size.height);
    let nearest = threshold, correction = 0, guide: AlignmentGuide | undefined;
    for (const point of points) for (const target of [{ position: .5, canvas: true }, ...targets.map(target => ({ position: target[axis], canvas: false }))]) {
      const distance = target.position - point[axis] - delta[axis];
      if (Math.abs(distance) < nearest) {
        nearest = Math.abs(distance); correction = distance; guide = { axis, ...target };
      }
    }
    result[axis] += correction;
    if (guide) result.guides.push(guide);
  }
  return result;
}
