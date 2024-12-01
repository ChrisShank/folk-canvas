import type { Vector2 } from '../utils/Vector2.ts';

export function intersectParabolas(p: Vector2, q: Vector2): Vector2 {
  const x = (q.y + q.x * q.x - (p.y + p.x * p.x)) / (2 * q.x - 2 * p.x);
  return { x, y: 0 };
}

export function transpose(matrix: Float32Array[]) {
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      const temp = matrix[i][j];
      matrix[i][j] = matrix[j][i];
      matrix[j][i] = temp;
    }
  }
}

export function findHullParabolas(row: Float32Array, verts: Vector2[], intersections: Vector2[]) {
  let k = 0;

  verts[0] = { x: 0, y: row[0] };
  intersections[0] = { x: -Infinity, y: 0 };
  intersections[1] = { x: Infinity, y: 0 };

  for (let i = 1; i < row.length; i++) {
    const q: Vector2 = { x: i, y: row[i] };
    let p = verts[k];
    let s = intersectParabolas(p, q);

    while (s.x <= intersections[k].x) {
      k--;
      p = verts[k];
      s = intersectParabolas(p, q);
    }

    k++;
    verts[k] = q;
    intersections[k] = s;
    intersections[k + 1] = { x: Infinity, y: 0 };
  }
}
