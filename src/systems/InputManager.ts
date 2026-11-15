import { Scene } from 'phaser';
import { GameSettingsManager } from '@core/GameConfig';

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
}

export interface VirtualJoystick {
  active: boolean;
  x: number;
  y: number;
  forceX: number;
  forceY: number;
}

export abstract class InputSource {
  abstract getInputState(): InputState;
  abstract update(): void;
  abstract destroy(): void;
}

export class KeyboardInputSource extends InputSource {
  private scene: Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private movementKeys:{up?:Phaser.Input.Keyboard.Key;down?:Phaser.Input.Keyboard.Key;left?:Phaser.Input.Keyboard.Key;right?:Phaser.Input.Keyboard.Key}={};
  private actionKey?: Phaser.Input.Keyboard.Key;

  constructor(scene: Scene) {
    super();
    this.scene = scene;
    this.setupKeys();
  }

  private setupKeys(): void {
    if (!this.scene.input.keyboard) {
      return;
    }
    
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.refreshKeyBindings();
    
    this.actionKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  refreshKeyBindings():void{
    const keyboard=this.scene.input.keyboard;if(!keyboard)return;
    const binding=GameSettingsManager.getInstance().getSettings().keyBindings;
    const code=(name:string)=>{const value=(Phaser.Input.Keyboard.KeyCodes as unknown as Record<string,number>)[name.toUpperCase()];return value??Phaser.Input.Keyboard.KeyCodes.W;};
    this.movementKeys={up:keyboard.addKey(code(binding.up)),down:keyboard.addKey(code(binding.down)),left:keyboard.addKey(code(binding.left)),right:keyboard.addKey(code(binding.right))};
  }

  getInputState(): InputState {
    const state: InputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
    };

    if (this.cursors) {
      state.up = state.up || this.cursors.up.isDown;
      state.down = state.down || this.cursors.down.isDown;
      state.left = state.left || this.cursors.left.isDown;
      state.right = state.right || this.cursors.right.isDown;
    }

    if (this.movementKeys.up) state.up = state.up || this.movementKeys.up.isDown;
    if (this.movementKeys.down) state.down = state.down || this.movementKeys.down.isDown;
    if (this.movementKeys.left) state.left = state.left || this.movementKeys.left.isDown;
    if (this.movementKeys.right) state.right = state.right || this.movementKeys.right.isDown;

    if (this.actionKey) {
      state.action = this.actionKey.isDown;
    }

    return state;
  }

  update(): void {
    // No per-frame updates needed for keyboard
  }

  destroy(): void {
    // Cleanup if needed
  }
}

export class TouchInputSource extends InputSource {
  private joystick: VirtualJoystick = {
    active: false,
    x: 0,
    y: 0,
    forceX: 0,
    forceY: 0,
  };

  constructor(_scene: Scene) {
    super();
    this.setupTouch();
  }

  private setupTouch(): void {
    // Touch input setup for future virtual joystick implementation
    // This is a placeholder structure for extensibility
  }

  getInputState(): InputState {
    const state: InputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
    };

    if (this.joystick.active) {
      // Dead zone
      if (this.joystick.forceY < -0.3) state.up = true;
      if (this.joystick.forceY > 0.3) state.down = true;
      if (this.joystick.forceX < -0.3) state.left = true;
      if (this.joystick.forceX > 0.3) state.right = true;
    }

    return state;
  }

  update(): void {
    // Update virtual joystick state
  }

  destroy(): void {
    // Cleanup touch listeners
  }

  public getJoystick(): VirtualJoystick {
    return { ...this.joystick };
  }

  public setJoystick(x: number, y: number, forceX: number, forceY: number): void {
    this.joystick = {
      active: true,
      x,
      y,
      forceX,
      forceY,
    };
  }

  public deactivateJoystick(): void {
    this.joystick.active = false;
  }
}

export class InputManager {
  private scene: Scene;
  private sources: InputSource[] = [];
  private keyboardSource?: KeyboardInputSource;
  private touchSource?: TouchInputSource;
  private analogX = 0;
  private analogY = 0;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public initialize(): void {
    // Always add keyboard for desktop
    this.keyboardSource = new KeyboardInputSource(this.scene);
    this.sources.push(this.keyboardSource);

    // Add touch source for mobile support
    this.touchSource = new TouchInputSource(this.scene);
    this.sources.push(this.touchSource);
  }

  /**
   * Normalized screen-space movement input (x right, y down).
   * Digital keys and analog sticks are merged into one vector of length <= 1.
   */
  public getMoveVector(): { x: number; y: number } {
    const state = this.getInputState();
    let x = (state.right ? 1 : 0) - (state.left ? 1 : 0);
    let y = (state.down ? 1 : 0) - (state.up ? 1 : 0);

    x += this.analogX;
    y += this.analogY;

    const length = Math.sqrt(x * x + y * y);
    if (length > 1) {
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  /** Set by the virtual joystick; values are expected in the range -1..1. */
  public setAnalogVector(x: number, y: number): void {
    this.analogX = x;
    this.analogY = y;
  }

  public clearAnalogVector(): void {
    this.analogX = 0;
    this.analogY = 0;
  }

  public setMovementBinding(direction:'up'|'down'|'left'|'right',key:string):void{GameSettingsManager.getInstance().setKeyBinding(direction,key);this.keyboardSource?.refreshKeyBindings();}

  public getInputState(): InputState {
    const combinedState: InputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      action: false,
    };

    for (const source of this.sources) {
      const state = source.getInputState();
      combinedState.up = combinedState.up || state.up;
      combinedState.down = combinedState.down || state.down;
      combinedState.left = combinedState.left || state.left;
      combinedState.right = combinedState.right || state.right;
      combinedState.action = combinedState.action || state.action;
    }

    return combinedState;
  }

  public update(): void {
    for (const source of this.sources) {
      source.update();
    }
  }

  public getTouchSource(): TouchInputSource | undefined {
    return this.touchSource;
  }

  public destroy(): void {
    for (const source of this.sources) {
      source.destroy();
    }
    this.sources = [];
  }
}
