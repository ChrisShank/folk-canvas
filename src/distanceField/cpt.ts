import type { Vector2 } from '../utils/Vector2.ts';

/** Adapted from Felzenszwalb, P. F., & Huttenlocher, D. P. (2012). Distance Transforms of Sampled Functions. Theory of Computing, 8(1), 415–428. */
export function computeCPT(
  sedt: Float32Array[],
  cpt: Vector2[][],
  xcoords: Float32Array[],
  ycoords: Float32Array[]
): Vector2[][] {
  const length = sedt.length;
  const tempArray = new Float32Array(length);

  // Pre-allocate hull arrays
  const hullVertices: Vector2[] = [];
  const hullIntersections: Vector2[] = [];

  for (let row = 0; row < length; row++) {
    horizontalPass(sedt[row], xcoords[row], hullVertices, hullIntersections);
  }

  for (let i = 0; i < length; i++) {
    for (let j = i + 1; j < length; j++) {
      tempArray[0] = sedt[i][j];
      sedt[i][j] = sedt[j][i];
      sedt[j][i] = tempArray[0];
    }
  }

  for (let row = 0; row < length; row++) {
    horizontalPass(sedt[row], ycoords[row], hullVertices, hullIntersections);
  }

  const len = length * length;
  for (let i = 0; i < len; i++) {
    const row = i % length;
    const col = (i / length) | 0;
    const y = ycoords[col][row];
    const x = xcoords[y][col];
    cpt[row][col].x = x;
    cpt[row][col].y = y;
  }

  return cpt;
}

function horizontalPass(
  singleRow: Float32Array,
  indices: Float32Array,
  hullVertices: Vector2[],
  hullIntersections: Vector2[]
) {
  // Clear hull arrays before use
  hullVertices.length = 0;
  hullIntersections.length = 0;

  findHullParabolas(singleRow, hullVertices, hullIntersections);
  marchParabolas(singleRow, hullVertices, hullIntersections, indices);
}

function marchParabolas(row: Float32Array, verts: Vector2[], intersections: Vector2[], indices: Float32Array) {
  let k = 0;
  const n = row.length;
  const numVerts = verts.length;

  for (let i = 0; i < n; i++) {
    while (k < numVerts - 1 && intersections[k + 1].x < i) {
      k++;
    }
    const dx = i - verts[k].x;
    row[i] = dx * dx + verts[k].y;
    indices[i] = verts[k].x;
  }
}

function findHullParabolas(row: Float32Array, verts: Vector2[], intersections: Vector2[]) {
  let k = 0;

  verts[k] = { x: 0, y: row[0] };
  intersections[k] = { x: -Infinity, y: 0 };
  intersections[k + 1] = { x: Infinity, y: 0 };

  const n = row.length;

  for (let i = 1; i < n; i++) {
    const s: Vector2 = { x: 0, y: 0 };
    const qx = i;
    const qy = row[i];
    let p = verts[k];

    // Calculate intersection
    s.x = (qy + qx * qx - (p.y + p.x * p.x)) / (2 * (qx - p.x));

    while (k > 0 && s.x <= intersections[k].x) {
      k--;
      p = verts[k];
      s.x = (qy + qx * qx - (p.y + p.x * p.x)) / (2 * (qx - p.x));
    }

    k++;
    verts[k] = { x: qx, y: qy };
    intersections[k] = { x: s.x, y: 0 };
    intersections[k + 1] = { x: Infinity, y: 0 };
  }

  // Adjust the length of verts and intersections arrays
  verts.length = k + 1;
  intersections.length = k + 2;
}
