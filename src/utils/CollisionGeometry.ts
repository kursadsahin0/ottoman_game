/** Tests a character's ground point against a house's isometric foundation.
 * House art is anchored at its front corner; the footprint extends screen-up. */
export function isInsideHouseFootprint(localScreenX: number, localScreenY: number): boolean {
  const vertices: Array<[number, number]> = [[-64, -32], [64, -32], [0, 0]];
  let hasNegative = false;
  let hasPositive = false;
  for (let i = 0; i < vertices.length; i++) {
    const [ax, ay] = vertices[i]!;
    const [bx, by] = vertices[(i + 1) % vertices.length]!;
    const cross = (bx - ax) * (localScreenY - ay) - (by - ay) * (localScreenX - ax);
    if (cross < -0.01) hasNegative = true;
    if (cross > 0.01) hasPositive = true;
  }
  return !(hasNegative && hasPositive);
}
