// This is a rewrite of https://github.com/guerrillacontra/html5-es6-physics-rope

import { Vector } from './common/Vector.ts';
import type { Point } from './common/types.ts';
import { FolkConnection } from './folk-connection.ts';

const lerp = (first: number, second: number, percentage: number) => first + (second - first) * percentage;

// Each rope part is one of these uses a high precision variant of Störmer–Verlet integration to keep the simulation consistent otherwise it would "explode"!
interface RopePoint {
  pos: Point;
  distanceToNextPoint: number;
  isFixed: boolean;
  oldPos: Point;
  velocity: Point;
  mass: number;
  damping: number;
  prev: RopePoint | null;
  next: RopePoint | null;
}

declare global {
  interface HTMLElementTagNameMap {
    'folk-rope': FolkRope;
  }
}

export class FolkRope extends FolkConnection {
  static override tagName = 'folk-rope';

  #svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  #path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  #path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  #shadow = this.attachShadow({ mode: 'open' });

  #rAFId = -1;
  #lastTime = 0;
  #gravity = { x: 0, y: 3000 };
  #points: RopePoint[] = [];

  get points() {
    return this.#points;
  }

  #stroke = '';
  get stroke() {
    return this.#stroke;
  }
  set stroke(stroke) {
    this.#stroke = stroke;
    this.#path.setAttribute('stroke', this.#stroke);
    this.#path2.setAttribute('stroke', this.#stroke);
  }

  constructor() {
    super();
    this.#svg.style.height = '100%';
    this.#svg.style.width = '100%';
    this.#svg.style.pointerEvents = 'none';
    this.#svg.appendChild(this.#path);
    this.#svg.appendChild(this.#path2);

    this.#shadow.appendChild(this.#svg);

    this.#path.setAttribute('stroke-width', '3');
    this.#path.setAttribute('fill', 'none');
    this.#path.style.pointerEvents = 'auto';

    this.#path2.setAttribute('stroke-width', '3');
    this.#path2.setAttribute('fill', 'none');
    this.#path2.style.pointerEvents = 'auto';

    this.stroke = this.getAttribute('stroke') || 'black';
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    cancelAnimationFrame(this.#rAFId);
  }

  #dtAccumulator = 0;
  #fixedTimestep = 1 / 60;

  #tick = (timestamp: number = performance.now()) => {
    this.#rAFId = requestAnimationFrame(this.#tick);

    const actualDelta = (timestamp - this.#lastTime) * 0.001;
    this.#lastTime = timestamp;

    // Accumulate delta time, but clamp to avoid spiral of death
    this.#dtAccumulator = Math.min(this.#dtAccumulator + actualDelta, 0.2);
    while (this.#dtAccumulator >= this.#fixedTimestep) {
      for (const point of this.#points) {
        this.#integratePoint(point, this.#gravity);
      }

      // 3 constraint iterations is enough for fixed timestep
      for (let iteration = 0; iteration < 3; iteration++) {
        for (const point of this.#points) {
          this.#constrainPoint(point);
        }
      }

      this.#dtAccumulator -= this.#fixedTimestep;
    }

    this.draw();
  };

  override render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    if (this.#points.length === 0) {
      this.#points = this.#generatePoints(
        { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.bottom },
        { x: targetRect.x + targetRect.width / 2, y: targetRect.bottom }
      );

      this.#lastTime = 0;

      this.#tick();
    }

    const startingPoint = this.#points.at(0);
    const endingPoint = this.#points.at(-1);

    if (startingPoint === undefined || endingPoint === undefined) return;

    startingPoint.pos.x = sourceRect.x + sourceRect.width / 2;
    startingPoint.pos.y = sourceRect.bottom;

    endingPoint.pos.x = targetRect.x + targetRect.width / 2;
    endingPoint.pos.y = targetRect.bottom;
  }

  draw() {
    if (this.#points.length < 2) return;

    let pathData = `M ${this.#points[0].pos.x} ${this.#points[0].pos.y}`;

    let path2Data = '';
    let isBroken = false;

    for (let i = 1; i < this.#points.length; i++) {
      const point = this.#points[i];

      if (point.prev === null) {
        isBroken = true;
        path2Data = `M ${point.pos.x} ${point.pos.y}`;
      } else if (isBroken) {
        path2Data += ` L ${point.pos.x} ${point.pos.y}`;
      } else {
        pathData += ` L ${point.pos.x} ${point.pos.y}`;
      }
    }

    this.#path.setAttribute('d', pathData);

    if (path2Data) {
      this.#path2.setAttribute('d', path2Data);
    } else {
      this.#path2.removeAttribute('d');
    }
  }

  #generatePoints(start: Point, end: Point) {
    const delta = Vector.sub(end, start);
    const len = Vector.mag(delta);
    const resolution = 5;
    const points: RopePoint[] = [];
    const pointsLen = Math.floor(len / resolution);

    for (let i = 0; i < pointsLen; i++) {
      const percentage = i / (pointsLen - 1);
      const pos = {
        x: lerp(start.x, end.x, percentage),
        y: lerp(start.y, end.y, percentage),
      };

      points.push({
        pos,
        oldPos: { ...pos },
        distanceToNextPoint: resolution,
        mass: 1,
        damping: 0.99,
        velocity: Vector.zero(),
        isFixed: i === 0 || i === pointsLen - 1,
        prev: null,
        next: null,
      });
    }

    // Link nodes into a doubly linked list
    for (let i = 0; i < pointsLen; i++) {
      const prev = i != 0 ? points[i - 1] : null;
      const curr = points[i];
      const next = i != pointsLen - 1 ? points[i + 1] : null;

      curr.prev = prev;
      curr.next = next;
    }

    return points;
  }

  #integratePoint(point: RopePoint, gravity: Point) {
    if (!point.isFixed) {
      point.velocity = Vector.sub(point.pos, point.oldPos);
      point.oldPos = { ...point.pos };

      const accel = Vector.add(gravity, { x: 0, y: point.mass });
      const tsSq = this.#fixedTimestep * this.#fixedTimestep;

      point.pos.x += point.velocity.x * point.damping + accel.x * tsSq;
      point.pos.y += point.velocity.y * point.damping + accel.y * tsSq;
    } else {
      point.velocity = Vector.zero();
      point.oldPos = { ...point.pos };
    }
  }

  // Apply constraints related to other nodes next to it (keeps each node within distance)
  #constrainPoint(point: RopePoint) {
    if (point.next) applyConstraint(point, point.next);
    if (point.prev) applyConstraint(point, point.prev);
  }

  cut(index = Math.floor(this.#points.length / 2)) {
    if (index < 0 || index >= this.#points.length - 1) return;

    this.#points[index].next = null;
    this.#points[index + 1].prev = null;
  }

  mend(index = Math.floor(this.#points.length / 2)) {
    if (index < 0 || index >= this.#points.length - 1) return;

    this.#points[index].next = this.#points[index + 1];
    this.#points[index + 1].prev = this.#points[index];
  }
}

function applyConstraint(p1: RopePoint, p2: RopePoint) {
  const delta = Vector.sub(p2.pos, p1.pos);
  const len = Vector.mag(delta);

  // Prevent division by zero
  if (len < 0.0001) return;

  const diff = len - p1.distanceToNextPoint;
  const normal = Vector.normalized(delta);
  const adjustment = Vector.scale(normal, diff * 0.75);

  if (!p1.isFixed) {
    p1.pos = Vector.add(p1.pos, adjustment);
  }
  if (!p2.isFixed) {
    p2.pos = Vector.sub(p2.pos, adjustment);
  }
}
