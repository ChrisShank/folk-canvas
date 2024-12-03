import { html } from './common/tags';

declare global {
  interface HTMLElementTagNameMap {
    'folk-space': FolkSpace;
  }
}

export class FolkSpace extends HTMLElement {
  static tagName = 'folk-space';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = html`
      <style>
        :host {
          display: block;
          perspective: 1000px;
          position: relative;
          width: 100%;
          height: 100%;
        }

        .space {
          position: absolute;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transform-origin: center;
          transition: transform 0.6s;
        }

        .space.rotate {
          transform: rotateX(-90deg);
        }

        .face {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
        }

        .front {
          transform: rotateX(0deg);
        }

        .back {
          transform: rotateX(90deg);
        }
      </style>
      <div class="space">
        <div class="face front">
          <slot name="front"></slot>
        </div>
        <div class="face back">
          <slot name="back"></slot>
        </div>
      </div>
    `;
  }

  transition() {
    const space = this.shadowRoot?.querySelector('.space');
    space?.classList.toggle('rotate');
  }
}

FolkSpace.define();
