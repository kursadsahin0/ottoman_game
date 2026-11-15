/**
 * Shared render-depth bands. Keeping world depths low and compact means UI
 * painted with screen-space depth always stays above the scene, while
 * isometric diagonals still sort back-to-front.
 */
export const DEPTH = {
  ground: -10_000,
  glint: -9_980,
  worldBase: 100,
  selection: 180,
  vignette: 240,
  prompt: 250,
  controls: 300,
  hud: 400,
  modal: 500,
  feedback: 510,
} as const;

/**
 * Depth follows projected screen Y: in a 2:1 isometric grid, both grid axes
 * move a cell down-screen. The small X tie-break orders cells on the same
 * isometric diagonal without letting it override a full row step.
 */
export function worldDepth(gridX: number, gridY: number, bias = 0): number {
  return DEPTH.worldBase + (gridX + gridY) * 4 + gridX * 0.1 + bias;
}
