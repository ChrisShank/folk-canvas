import { FolkElement, type Point } from '@lib';
import { Gizmos } from '@lib/folk-gizmos';
import { html } from '@lib/tags';
import { TransformEvent } from '@lib/TransformEvent';
import { css } from '@lit/reactive-element';

export class FolkTransformedSpace extends FolkElement {
  static override tagName = 'folk-transformed-space';

  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }

    .space {
      position: absolute;
      width: 100%;
      height: 100%;
      transform-origin: 0 0;
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

    return root;
  }

  rotate(angle: number = 45) {
    this.#matrix = new DOMMatrix().rotateAxisAngle(1, 0, 0, angle);

    const space = this.shadowRoot?.querySelector('.space');
    if (space instanceof HTMLElement) {
      space.style.transform = this.#matrix.toString();
    }

    Gizmos.clear();
  }

  static projectPoint(point: Point, space: FolkTransformedSpace): Point {
    // Visualize the click location in screen space
    Gizmos.point(point, { color: 'red', size: 2 });

    // Get the inverse of the current transform matrix
    const inverseMatrix = space.#matrix.inverse();

    // Transform the screen point back to find where it should be placed on the transformed plane
    const pointOnTransformedSpace = inverseMatrix.transformPoint(point);

    // Visualize where we'll place the point on the transformed plane
    Gizmos.point(pointOnTransformedSpace, { color: 'blue', size: 4, layer: 'transformed' });

    return pointOnTransformedSpace;
  }
}
