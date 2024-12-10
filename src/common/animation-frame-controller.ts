import { ReactiveController, ReactiveControllerHost } from '@lit/reactive-element';

export interface AnimationFrameControllerHost extends ReactiveControllerHost {
  tick(): void;
  render(): void;
}

export class AnimationFrameController implements ReactiveController {
  #host;
  #rAFId = -1;
  #lastTime = 0;
  #dtAccumulator = 0;
  #fixedTimestep = 1 / 60;

  get fixedTimestep() {
    return this.#fixedTimestep;
  }

  get isRunning() {
    return this.#rAFId !== -1;
  }

  constructor(host: AnimationFrameControllerHost) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected() {
    this.start();
  }

  hostUpdate() {}

  hostDisconnected() {
    this.stop();
  }

  #tick = (timestamp: DOMHighResTimeStamp = performance.now()) => {
    this.#rAFId = requestAnimationFrame(this.#tick);

    const actualDelta = (timestamp - this.#lastTime) * 0.001;
    this.#lastTime = timestamp;

    // Accumulate delta time, but clamp to avoid spiral of death
    this.#dtAccumulator = Math.min(this.#dtAccumulator + actualDelta, 0.2);

    while (this.#dtAccumulator >= this.#fixedTimestep) {
      this.#host.tick();
      this.#dtAccumulator -= this.#fixedTimestep;
    }

    this.#host.render();
  };

  start() {
    if (this.isRunning) return;

    this.#lastTime = 0;
    requestAnimationFrame(this.#tick);
  }

  stop() {
    cancelAnimationFrame(this.#rAFId);
  }
}
