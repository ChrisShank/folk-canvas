import { FolkElement } from '@lib';
import { html } from '@lib/tags';
import { TransformEvent } from '@lib/TransformEvent';
import { css } from '@lit/reactive-element';

export class FolkTransformedSpace extends FolkElement {
  static override tagName = 'folk-transformed-space';

  static styles = css`
    :host {
      display: block;
      // perspective: 1000px;
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
      backface-visibility: hidden;
    }
  `;

  #matrix = new DOMMatrix();

  override createRenderRoot() {
    const root = super.createRenderRoot() as ShadowRoot;

    root.setHTMLUnsafe(html`
      <div class="space" style="transform: ${this.#matrix}">
        <slot></slot>
      </div>
    `);

    // Listen for transform events from shapes
    this.addEventListener('transform', this.#handleTransform);

    return root;
  }

  rotate(angle: number = 45) {
    this.#matrix = new DOMMatrix().rotateAxisAngle(1, 0, 0, angle);

    const space = this.shadowRoot?.querySelector('.space');
    if (space instanceof HTMLElement) {
      space.style.transform = this.#matrix.toString();
    }
  }

  #handleTransform = (event: TransformEvent) => {
    // Extract rotation angles from the transformation matrix
    const rotationX = Math.atan2(this.#matrix.m32, this.#matrix.m33);
    const rotationY = Math.atan2(
      -this.#matrix.m31,
      Math.sqrt(this.#matrix.m32 * this.#matrix.m32 + this.#matrix.m33 * this.#matrix.m33),
    );

    // Calculate projection factors for both axes
    const projectionFactorY = 1 / Math.cos(rotationX);
    const projectionFactorX = 1 / Math.cos(rotationY);

    // Apply the transformed movement with both projection factors
    event.current.x *= projectionFactorX;
    event.current.y *= projectionFactorY;
  };
}
