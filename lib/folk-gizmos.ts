import { DOMRectTransform, FolkElement, type Point } from '@lib';
import { html } from '@lib/tags';
import { css } from '@lit/reactive-element';

interface GizmoOptions {
  color?: string;
  layer?: string;
}

interface PointOptions extends GizmoOptions {
  size?: number;
}

interface LineOptions extends GizmoOptions {
  width?: number;
}

interface RectOptions extends LineOptions {
  fill?: string;
}

/**
 * Visual debugging system that renders canvas overlays in DOM containers.
 *
 * Creates full-size canvas overlays that can be placed anywhere in the DOM.
 * Supports multiple instances with isolated drawing layers.
 *
 * Usage:
 * ```html
 * <folk-gizmos layer="debug"></folk-gizmos>
 * ```
 *
 * Drawing methods:
 * ```ts
 * Gizmos.point({x, y});
 * Gizmos.line(start, end, { color: 'red' });
 * Gizmos.rect(domRect, { fill: 'blue' });
 * ```
 */
export class Gizmos extends FolkElement {
  static override tagName = 'folk-gizmos';
  static #layers = new Map<
    string,
    {
      ctx: CanvasRenderingContext2D;
      canvas: HTMLCanvasElement;
    }
  >();
  static #defaultLayer = 'default';
  static #hasLoggedDrawWarning = false;
  static #hasLoggedInitMessage = false;

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: calc(Infinity);
    }

    .gizmos-canvas {
      position: absolute;
      width: 100%;
      height: 100%;
    }
  `;

  readonly #layer: string;

  constructor() {
    super();
    this.#layer = this.getAttribute('layer') ?? Gizmos.#defaultLayer;
  }

  override createRenderRoot() {
    const root = super.createRenderRoot() as ShadowRoot;

    root.setHTMLUnsafe(html` <canvas class="gizmos-canvas"></canvas> `);

    const canvas = root.querySelector('.gizmos-canvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d') ?? null;

    if (canvas && ctx) {
      Gizmos.#layers.set(this.#layer, { canvas, ctx });
    }

    this.#handleResize();
    window.addEventListener('resize', () => this.#handleResize());

    return root;
  }

  /** Draws a point */
  static point(point: Point, { color = 'red', size = 5, layer = Gizmos.#defaultLayer }: PointOptions = {}) {
    const ctx = Gizmos.#getContext(layer);
    if (!ctx) return;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draws a line between two points */
  static line(start: Point, end: Point, { color = 'blue', width = 2, layer = Gizmos.#defaultLayer }: LineOptions = {}) {
    const ctx = Gizmos.#getContext(layer);
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  /** Draws a rectangle, can be a regular DOMRect or a DOMRectTransform */
  static rect(
    rect: DOMRect | DOMRectTransform,
    { color = 'blue', width = 2, fill, layer = Gizmos.#defaultLayer }: RectOptions = {},
  ) {
    const ctx = Gizmos.#getContext(layer);
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    if (rect instanceof DOMRectTransform) {
      // For transformed rectangles, draw using the vertices
      const vertices = rect.vertices().map((p) => rect.toParentSpace(p));
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();
    } else {
      // For regular DOMRects, draw a simple rectangle
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
    }

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.stroke();
  }

  /** Clears drawings from a specific layer or all layers if no layer specified */
  static clear(layer?: string) {
    if (layer) {
      const layerData = Gizmos.#layers.get(layer);
      if (!layerData) return;
      const { ctx, canvas } = layerData;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      // Clear all layers
      Gizmos.#layers.forEach(({ ctx, canvas }) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }
  }

  #handleResize() {
    const layerData = Gizmos.#layers.get(this.#layer);
    if (!layerData) return;

    const { canvas, ctx } = layerData;
    const rect = this.getBoundingClientRect();
    const dpr = window.devicePixelRatio;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
  }

  static #getContext(layer = Gizmos.#defaultLayer) {
    if (!Gizmos.#hasLoggedInitMessage) {
      const gizmos = document.querySelectorAll<Gizmos>(Gizmos.tagName);
      console.info(
        '%cGizmos',
        'font-weight: bold; color: #4CAF50;',
        '\n• Gizmo elements:',
        gizmos.length,
        '\n• Layers:',
        `[${Array.from(Gizmos.#layers.keys()).join(', ')}]`,
        '\n• Default layer:',
        Gizmos.#defaultLayer,
      );
      Gizmos.#hasLoggedInitMessage = true;
    }

    const layerData = Gizmos.#layers.get(layer);
    if (!layerData && !Gizmos.#hasLoggedDrawWarning) {
      console.warn(`Gizmos cannot draw: layer "${layer}" not found`);
      Gizmos.#hasLoggedDrawWarning = true;
      return null;
    }

    return layerData?.ctx;
  }
}

if (!customElements.get('folk-gizmos')) {
  customElements.define('folk-gizmos', Gizmos);
}
