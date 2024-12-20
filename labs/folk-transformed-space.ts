import { FolkElement, type Point } from '@lib';
import { Gizmos } from '@lib/folk-gizmos';
import { html } from '@lib/tags';
import { TransformEvent } from '@lib/TransformEvent';
import { css } from '@lit/reactive-element';

interface TransformRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class FolkTransformedSpace extends FolkElement {
  static override tagName = 'folk-transformed-space';

  static #perspective = 1000;

  static styles = css`
    :host {
      display: block;
      perspective: ${this.#perspective}px;
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

    Gizmos.clear();
  }

  #handleTransform = (event: TransformEvent) => {
    const previous = this.transformRect(event.previous);
    const current = this.transformRect(event.current);

    Gizmos.rect(event.current, {
      color: 'rgba(0, 0, 255, 0.1)',
      width: 2,
      layer: 'default',
    });

    Gizmos.line(event.current, current, {
      color: 'gray',
      width: 2,
      layer: 'transformed',
    });
    Gizmos.point(event.current, {
      color: 'blue',
      size: 3,
      layer: 'transformed',
    });
    Gizmos.point(current, {
      color: 'red',
      size: 3,
      layer: 'transformed',
    });

    const delta = {
      x: current.x - previous.x,
      y: current.y - previous.y,
    };

    event.current.x += delta.x;
    event.current.y += delta.y;
  };

  localToScreen(point: Point): Point {
    const spaceRect = this.getBoundingClientRect();
    const centerX = spaceRect.width / 2;
    const centerY = spaceRect.height / 2;

    // Use the same matrix we're using for CSS
    const matrix = new DOMMatrix().translate(centerX, centerY).multiply(this.#matrix).translate(-centerX, -centerY);

    const transformedPoint = matrix.transformPoint(new DOMPoint(point.x, point.y, 0, 1));

    const w = transformedPoint.w || 1;
    return {
      x: transformedPoint.x / w,
      y: transformedPoint.y / w,
    };
  }

  /**
   * Transforms a rect from an element in either face to screen coordinates
   */
  transformRect(rect: TransformRect): TransformRect {
    // Get center point
    const center = {
      x: rect.x,
      y: rect.y,
    };

    // Transform center point
    const transformedCenter = this.localToScreen(center);

    return {
      x: transformedCenter.x,
      y: transformedCenter.y,
      width: rect.width,
      height: rect.height,
    };
  }
}
