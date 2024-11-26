export type Vector2 = { x: number; y: number };

export class Vector {
  static zero: () => Vector2 = () => ({ x: 0, y: 0 });
  static sub: (a: Vector2, b: Vector2) => Vector2 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  static add: (a: Vector2, b: Vector2) => Vector2 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  static mult: (a: Vector2, b: Vector2) => Vector2 = (a, b) => ({ x: a.x * b.x, y: a.y * b.y });
  static scale: (v: Vector2, scaleFactor: number) => Vector2 = (v, scaleFactor) => ({
    x: v.x * scaleFactor,
    y: v.y * scaleFactor,
  });
  static mag: (v: Vector2) => number = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
  static normalized: (v: Vector2) => Vector2 = (v) => {
    const mag = Vector.mag(v);
    return mag === 0 ? Vector.zero() : { x: v.x / mag, y: v.y / mag };
  };
}
