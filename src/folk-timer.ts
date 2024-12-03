declare global {
  interface HTMLElementTagNameMap {
    'folk-timer': FolkTimer;
  }
}

export class FolkTimer extends HTMLElement {
  static tagName = 'folk-timer';

  static define() {
    customElements.define(this.tagName, this);
  }

  #timeMs = 0;
  #timeoutId: NodeJS.Timeout | -1 = -1;

  #intervalMs = 100;

  connectedCallback() {
    this.#updateTime(0);
  }

  start() {
    this.#timeoutId = setInterval(this.#updateTime, this.#intervalMs);
  }

  stop() {
    clearInterval(this.#timeoutId);
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

if (!customElements.get('folk-timer')) {
  FolkTimer.define();
}
