import type { Vector2 } from '../utils/Vector2.ts';
import { findHullParabolas, transpose } from './utils.ts';

export function computeCPT(
  sedt: Float32Array[],
  cpt: Vector2[][],
  xcoords: Float32Array[],
  ycoords: Float32Array[]
): Vector2[][] {
  const length = sedt.length;

  for (let row = 0; row < length; row++) {
    horizontalPass(sedt[row], xcoords[row]);
  }

  transpose(sedt);

  for (let row = 0; row < length; row++) {
    horizontalPass(sedt[row], ycoords[row]);
  }

  for (let col = 0; col < length; col++) {
    for (let row = 0; row < length; row++) {
      const y = ycoords[col][row];
      const x = xcoords[y][col];
      cpt[row][col] = { x, y };
    }
  }

  return cpt;
}

function horizontalPass(singleRow: Float32Array, indices: Float32Array) {
  const hullVertices: Vector2[] = [];
  const hullIntersections: Vector2[] = [];
  findHullParabolas(singleRow, hullVertices, hullIntersections);
  marchParabolas(singleRow, hullVertices, hullIntersections, indices);
}

function marchParabolas(row: Float32Array, verts: Vector2[], intersections: Vector2[], indices: Float32Array) {
  let k = 0;

  for (let i = 0; i < row.length; i++) {
    while (intersections[k + 1].x < i) {
      k++;
    }
    const dx = i - verts[k].x;
    row[i] = dx * dx + verts[k].y;
    indices[i] = verts[k].x;
  }
}
