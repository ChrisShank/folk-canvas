import { FolkSet } from './folk-set';
import { Vertex, verticesToPolygon } from './arrows/utils';

declare global {
  interface HTMLElementTagNameMap {
    'folk-hull': FolkHull;
  }
}

export class FolkHull extends FolkSet {
  static tagName = 'folk-hull';

  #hull: Vertex[] = [];

  get hull(): ReadonlyArray<Vertex> {
    return this.#hull;
  }

  update() {
    if (this.sourcesMap.size === 0) {
      this.style.clipPath = '';
      return;
    }

    const rects = Array.from(this.sourcesMap.values());
    this.#hull = makeHull(rects);
    this.style.clipPath = verticesToPolygon(this.#hull);
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

function comparePoints(a: Vertex, b: Vertex): number {
  if (a.x < b.x) return -1;
  if (a.x > b.x) return 1;
  if (a.y < b.y) return -1;
  if (a.y > b.y) return 1;
  return 0;
}

export function makeHull(rects: DOMRectReadOnly[]): Vertex[] {
  const points: Vertex[] = rects
    .flatMap((rect) => [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.left, y: rect.bottom },
      { x: rect.right, y: rect.bottom },
    ])
    .sort(comparePoints);

  if (points.length <= 1) return points;

  // Andrew's monotone chain algorithm. Positive y coordinates correspond to "up"
  // as per the mathematical convention, instead of "down" as per the computer
  // graphics convention. This doesn't affect the correctness of the result.

  const upperHull: Array<Vertex> = [];
  for (let i = 0; i < points.length; i++) {
    const p: Vertex = points[i];
    while (upperHull.length >= 2) {
      const q: Vertex = upperHull[upperHull.length - 1];
      const r: Vertex = upperHull[upperHull.length - 2];
      if ((q.x - r.x) * (p.y - r.y) >= (q.y - r.y) * (p.x - r.x)) upperHull.pop();
      else break;
    }
    upperHull.push(p);
  }
  upperHull.pop();

  const lowerHull: Array<Vertex> = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p: Vertex = points[i];
    while (lowerHull.length >= 2) {
      const q: Vertex = lowerHull[lowerHull.length - 1];
      const r: Vertex = lowerHull[lowerHull.length - 2];
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
  )
    return upperHull;

  return upperHull.concat(lowerHull);
}
