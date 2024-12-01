import { findHullParabolas, transpose } from './utils.ts';
import type { Vector2 } from '../utils/Vector2.ts';

// TODO: test performance of non-square sedt
export function computeEDT(sedt: Float32Array[]): Float32Array[] {
  for (let row = 0; row < sedt.length; row++) {
    horizontalPass(sedt[row]);
  }
  transpose(sedt);

  for (let row = 0; row < sedt.length; row++) {
    horizontalPass(sedt[row]);
  }
  transpose(sedt);

  return sedt.map((row) => row.map(Math.sqrt));
}

function horizontalPass(singleRow: Float32Array) {
  const hullVertices: Vector2[] = [];
  const hullIntersections: Vector2[] = [];
  findHullParabolas(singleRow, hullVertices, hullIntersections);
  marchParabolas(singleRow, hullVertices, hullIntersections);
}

function marchParabolas(row: Float32Array, verts: Vector2[], intersections: Vector2[]) {
  let k = 0;

  for (let i = 0; i < row.length; i++) {
    while (intersections[k + 1].x < i) {
      k++;
    }
    const dx = i - verts[k].x;
    row[i] = dx * dx + verts[k].y;
  }
}
