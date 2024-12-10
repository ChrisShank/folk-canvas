import { FolkElement } from './common/folk-element';

declare global {
  interface HTMLElementTagNameMap {
    'folk-timer': FolkTimer;
  }
}

export class FolkTimer extends FolkElement {
  static tagName = 'folk-timer';

  #timeMs = 0;
  #timeoutId = -1;

  #intervalMs = 100;

  connectedCallback() {
    super.connectedCallback();
    this.#updateTime(0);
  }

  start() {
    this.#timeoutId = window.setInterval(this.#updateTime, this.#intervalMs);
  }

  stop() {
    window.clearInterval(this.#timeoutId);
    this.#timeoutId = -1;
  }

  reset() {
    this.stop();
    this.#updateTime(0);
  }

  #updateTime = (time = this.#timeMs + this.#intervalMs) => {
    this.#timeMs = time;
    this.textContent = (time / 1000).toFixed(1);
  };
}
