import type { RotatedDOMRect } from './common/types';
import { FolkBaseSet } from './folk-base-set';
declare global {
  interface HTMLElementTagNameMap {
    'folk-shrink-hull': FolkShrinkHull;
  }
}

export class FolkShrinkHull extends FolkBaseSet {
  static tagName = 'folk-shrink-hull';

  #hull: SpanningPoint[] = [];
  #svg: SVGElement;

  constructor() {
    super();

    // Create SVG element once
    this.#svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.#svg.setAttribute('width', '100%');
    this.#svg.setAttribute('height', '100%');
    this.#svg.style.position = 'absolute';
    this.#svg.style.pointerEvents = 'none';
  }

  connectedCallback() {
    super.connectedCallback?.();
    this.appendChild(this.#svg);
  }

  update() {
    if (this.sourcesMap.size === 0) {
      this.#svg.innerHTML = '';
      return;
    }

    const rects = Array.from(this.sourcesMapRotated.values());
    this.#hull = addMidpoints(makeHull(rects));
    this.#svg.innerHTML = verticesToColoredPolygon(this.#hull);
  }
}

/* This code has been modified from the original source, see the original source below. */
/*
 * Convex hull algorithm - Library (TypeScript)
 *
 * Copyright (c) 2021 Project Nayuki
 * https://www.nayuki.io/page/convex-hull-algorithm
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program (see COPYING.txt and COPYING.LESSER.txt).
 * If not, see <http://www.gnu.org/licenses/>.
 */

function compareColoredPoints(a: SpanningPoint, b: SpanningPoint): number {
  if (a.x < b.x) return -1;
  if (a.x > b.x) return 1;
  if (a.y < b.y) return -1;
  if (a.y > b.y) return 1;
  return 0;
}

export function makeHull(rects: RotatedDOMRect[]): SpanningPoint[] {
  const points: SpanningPoint[] = rects
    .flatMap((rect, index) =>
      rect.corners().map((corner) => ({ id: index, isSpanning: false, isMidpoint: false, x: corner.x, y: corner.y }))
    )
    .sort(compareColoredPoints);

  if (points.length <= 1) return points;

  // Build upper hull
  const upperHull: Array<SpanningPoint> = [];
  for (let i = 0; i < points.length; i++) {
    const p: SpanningPoint = points[i];
    while (upperHull.length >= 2) {
      const q: SpanningPoint = upperHull[upperHull.length - 1];
      const r: SpanningPoint = upperHull[upperHull.length - 2];
      if ((q.x - r.x) * (p.y - r.y) >= (q.y - r.y) * (p.x - r.x)) upperHull.pop();
      else break;
    }
    upperHull.push(p);
  }
  upperHull.pop();

  // Build lower hull
  const lowerHull: Array<SpanningPoint> = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p: SpanningPoint = points[i];
    while (lowerHull.length >= 2) {
      const q: SpanningPoint = lowerHull[lowerHull.length - 1];
      const r: SpanningPoint = lowerHull[lowerHull.length - 2];
      if ((q.x - r.x) * (p.y - r.y) >= (q.y - r.y) * (p.x - r.x)) lowerHull.pop();
      else break;
    }
    lowerHull.push(p);
  }
  lowerHull.pop();

  if (
    upperHull.length === 1 &&
    lowerHull.length === 1 &&
    upperHull[0].x === lowerHull[0].x &&
    upperHull[0].y === lowerHull[0].y
  ) {
    return upperHull;
  }

  const hull = upperHull.concat(lowerHull);

  // Mark the spanning segments
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    const nextP = hull[(i + 1) % hull.length];
    if (p.id !== nextP.id) {
      p.isSpanning = true;
    }
  }

  return hull;
}

/** isSpanning indicates the color of the line between this point and the next */
type SpanningPoint = {
  id: number;
  isSpanning: boolean;
  isMidpoint: boolean;
  x: number;
  y: number;
};

export function verticesToColoredPolygon(points: SpanningPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    // For a single point, draw a small circle
    const p = points[0];
    return `<circle cx="${p.x}" cy="${p.y}" r="2" fill="${idToColor(p.id)}"/>`;
  }

  // Create path segments and circles
  const paths = points.map((point, i) => {
    const color = idToColor(point.id);
    const nextPoint = points[(i + 1) % points.length];
    return `<path d="M ${point.x} ${point.y} L ${nextPoint.x} ${nextPoint.y}" 
        stroke="${color ?? '#999'}" 
        stroke-width="${point.isSpanning ? '2' : '4'}"
        ${point.isSpanning ? 'stroke-dasharray="4"' : ''}
        stroke-linejoin="miter"
        opacity="${point.isSpanning ? '0.5' : '1'}"
        fill="none"/>`;
  });

  const circles = points.map(
    (point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${idToColor(point.id)}"/>`
  );

  return [...paths, ...circles].join('\n');
}

function idToColor(id: number): string {
  // Golden ratio conjugate (~0.618033988749895) helps create visually pleasing color spacing
  const hue = ((id * 0.618033988749895) % 1) * 360;
  // Fixed saturation and lightness for consistent, vibrant colors
  return `hsl(${hue}, 85%, 60%)`;
}

function addMidpoints(hull: SpanningPoint[]): SpanningPoint[] {
  const result: SpanningPoint[] = [];

  for (let i = 0; i < hull.length; i++) {
    const current = hull[i];
    result.push(current);

    if (current.isSpanning) {
      const next = hull[(i + 1) % hull.length];
      // Create midpoint
      const midpoint: SpanningPoint = {
        id: current.id,
        isSpanning: true,
        isMidpoint: true,
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      };
      result.push(midpoint);
    }
  }

  return result;
}
