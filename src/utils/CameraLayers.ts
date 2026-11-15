import Phaser from 'phaser';

export const UI_CAMERA_NAME = 'ui-camera';

/**
 * Phaser applies camera zoom to every object, including ones with a zero
 * scroll factor. A zoomed world camera therefore drags and shrinks fixed HUD
 * elements. Splitting the scene into two cameras keeps the world zoom while
 * the interface stays pixel-perfect: the main camera draws the world and the
 * UI camera (zoom 1, scroll 0) draws the interface.
 */
export function createUiCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const camera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, UI_CAMERA_NAME);
  camera.setScroll(0, 0);
  camera.setZoom(1);
  return camera;
}

/** Marks scene objects as interface: only the UI camera will draw them. */
export function registerUi(
  scene: Phaser.Scene,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  if (objects.length === 0) return;
  scene.cameras.main.ignore(objects);
}

/** Marks scene objects as world content: only the world camera draws them. */
export function registerWorld(
  scene: Phaser.Scene,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  if (objects.length === 0) return;
  scene.cameras.getCamera(UI_CAMERA_NAME)?.ignore(objects);
}
