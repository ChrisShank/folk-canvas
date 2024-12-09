import { css, html } from './common/tags';
import { FolkShape } from './folk-shape';
import { DOMRectTransform } from './common/DOMRectTransform';

const styles = css`
  :host {
    display: block;
    position: relative;
    border: 2px dashed hsl(214, 84%, 56%);
    border-radius: 50%;
  }

  ::slotted(*) {
    position: absolute;
    transform-origin: 50% 0%;
  }

  .center-point {
    position: absolute;
    width: 8px;
    height: 8px;
    background: hsl(214, 84%, 56%);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
`;

export class FolkSpaceRadial extends HTMLElement {
  static tagName = 'folk-space-radial';

  static define() {
    if (!customElements.get(this.tagName)) {
      customElements.define(this.tagName, this);
    }
  }

  #shadow = this.attachShadow({ mode: 'open' });
  #centerPoint: HTMLDivElement;

  constructor() {
    super();
    this.#shadow.adoptedStyleSheets = [styles];

    // Create center point marker
    this.#centerPoint = document.createElement('div');
    this.#centerPoint.className = 'center-point';

    this.#shadow.setHTMLUnsafe(html`<slot></slot> `);
    this.#shadow.appendChild(this.#centerPoint);

    // Listen for changes in the slot to layout children when they change
    const slot = this.#shadow.querySelector('slot');
    slot?.addEventListener('slotchange', () => this.#layoutChildren());
  }

  connectedCallback() {
    this.#layoutChildren();
  }

  #layoutChildren() {
    const slot = this.#shadow.querySelector('slot');
    const assignedElements = slot?.assignedElements() || [];
    const count = assignedElements.length;

    // Determine the radius and center of the radial layout
    const radius = Math.min(this.clientWidth, this.clientHeight) / 2 - 50;
    const centerX = this.clientWidth / 2;
    const centerY = this.clientHeight / 2;

    assignedElements.forEach((element, index) => {
      if (!(element instanceof FolkShape)) return;

      // Calculate the angle for each child
      const angle = (index / count) * 2 * Math.PI;

      // Create a transform for each child
      const transform = new DOMRectTransform({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        rotation: angle,
        transformOrigin: { x: 0.5, y: 0 },
      });

      // Set the transform on the child
      // element.setTransform(transform);
    });
  }
}

FolkSpaceRadial.define();
