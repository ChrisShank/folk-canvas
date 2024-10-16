import { getBoxToBoxArrow } from 'perfect-arrows';
import { AbstractArrow } from './abstract-arrow';
import { pointsOnBezierCurves } from './points-on-path';
import getStroke, { StrokeOptions } from 'perfect-freehand';

export type Arrow = [
  /** The x position of the (padded) starting point. */
  sx: number,
  /** The y position of the (padded) starting point. */
  sy: number,
  /** The x position of the control point. */
  cx: number,
  /** The y position of the control point. */
  cy: number,
  /** The x position of the (padded) ending point. */
  ex: number,
  /** The y position of the (padded) ending point. */
  ey: number,
  /** The angle (in radians) for an ending arrowhead. */
  ae: number,
  /** The angle (in radians) for a starting arrowhead. */
  as: number,
  /** The angle (in radians) for a center arrowhead. */
  ac: number
];

export class SpatialConnection extends AbstractArrow {
  static tagName = 'spatial-connection' as const;

  #options: StrokeOptions = {
    size: 10,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
    // TODO: figure out how to expose these as attributes
    easing: (t) => t,
    start: {
      taper: 50,
      easing: (t) => t,
      cap: true,
    },
    end: {
      taper: 0,
      easing: (t) => t,
      cap: true,
    },
  };

  render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    const [sx, sy, cx, cy, ex, ey, ae] = getBoxToBoxArrow(
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      targetRect.x,
      targetRect.y,
      targetRect.width,
      targetRect.height
    ) as Arrow;

    const points = pointsOnBezierCurves([
      [sx, sy],
      [cx, cy],
      [ex, ey],
      [ex, ey],
    ]);

    const stroke = getStroke(points, this.#options);
    const path = getSvgPathFromStroke(stroke);
    this.style.clipPath = `path('${path}')`;
    this.style.backgroundColor = 'black';
  }
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return '';

  for (const point of stroke) {
    point[0] = Math.round(point[0] * 100) / 100;
    point[1] = Math.round(point[1] * 100) / 100;
  }

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );

  d.push('Z');
  return d.join(' ');
}

declare global {
  interface HTMLElementTagNameMap {
    [SpatialConnection.tagName]: SpatialConnection;
  }
}
