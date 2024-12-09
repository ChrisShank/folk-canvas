import { html, css } from './common/tags';

declare global {
  interface HTMLElementTagNameMap {
    'folk-space': FolkSpace;
  }
}

const styles = css`
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
`;

export class FolkSpace extends HTMLElement {
  static tagName = 'folk-space';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #shadow = this.attachShadow({ mode: 'open' });

  constructor() {
    super();

    this.#shadow.adoptedStyleSheets.push(styles);

    this.#shadow.setHTMLUnsafe(html`
      <div class="space">
        <div class="face front">
          <slot name="front"></slot>
        </div>
        <div class="face back">
          <slot name="back"></slot>
        </div>
      </div>
    `);
  }

  transition() {
    const space = this.shadowRoot?.querySelector('.space');
    space?.classList.toggle('rotate');
  }
}
