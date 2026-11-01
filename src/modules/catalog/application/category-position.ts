/** Project one row during dragging without allocating a reordered list per row. */
export function projectedCategoryIndex(index: number, from: number, to: number) {
  if (from < 0 || to < 0) return index
  if (index === from) return to
  if (from < to && index > from && index <= to) return index - 1
  if (from > to && index >= to && index < from) return index + 1
  return index
}
