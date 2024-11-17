// This is a rewrite of https://github.com/guerrillacontra/html5-es6-physics-rope

import { ResizeObserverManager } from '../resize-observer.ts';
import { AbstractArrow } from './abstract-arrow.ts';
import { Vertex } from './utils.ts';

const lerp = (first, second, percentage) => first + (second - first) * percentage;

class Vector {
  static zero = () => ({ x: 0, y: 0 });
  static sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  static add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  static mult = (a, b) => ({ x: a.x * b.x, y: a.y * b.y });
  static scale = (v, scaleFactor) => ({ x: v.x * scaleFactor, y: v.y * scaleFactor });
  static mag = (v) => Math.sqrt(v.x * v.x + v.y * v.y);
  static normalized(v) {
    const mag = Vector.mag(v);
    return mag === 0 ? Vector.zero() : { x: v.x / mag, y: v.y / mag };
  }
}

// Each rope part is one of these uses a high precision variant of Störmer–Verlet integration to keep the simulation consistent otherwise it would "explode"!
interface RopePoint {
  pos: Vertex;
  distanceToNextPoint: number;
  isFixed: boolean;
  oldPos: Vertex;
  velocity: Vertex;
  mass: number;
  damping: number;
  prev: RopePoint | null;
  next: RopePoint | null;
}

const resizeObserver = new ResizeObserverManager();

declare global {
  interface HTMLElementTagNameMap {
    'fc-rope': FolkRope;
  }
}

export class FolkRope extends AbstractArrow {
  static override tagName = 'fc-rope';

  #canvas = document.createElement('canvas');
  #context = this.#canvas.getContext('2d')!;
  #shadow = this.attachShadow({ mode: 'open' });

  #rAFId = -1;
  #lastTime = 0;
  #currentTime = 0;
  #deltaTime = 0;
  #previousDelta = 0;
  #interval = 1000 / 60; // ms per frame
  #gravity = { x: 0, y: 3000 };
  #points: RopePoint[] = [];

  constructor() {
    super();

    this.#shadow.appendChild(this.#canvas);
  }

  connectedCallback(): void {
    super.connectedCallback();

    resizeObserver.observe(this, this.#onResize);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    resizeObserver.unobserve(this, this.#onResize);
  }

  #onResize = (entry) => {
    this.#canvas.width = entry.contentRect.width;
    this.#canvas.height = entry.contentRect.height;
    this.#drawRopePoints();
  };

  #tick = (timestamp: number = performance.now()) => {
    this.#rAFId = requestAnimationFrame(this.#tick);

    this.#currentTime = timestamp;

    this.#deltaTime = this.#currentTime - this.#lastTime;

    if (this.#deltaTime > this.#interval) {
      const dts = this.#deltaTime * 0.001; // delta time in seconds

      for (const point of this.#points) {
        this.#integratePoint(point, this.#gravity, dts, this.#previousDelta);
      }

      for (let iteration = 0; iteration < 100; iteration++) {
        for (const point of this.#points) {
          this.#constrainPoint(point);
        }
      }

      this.#previousDelta = dts;

      this.#drawRopePoints();

      this.#lastTime = this.#currentTime - (this.#deltaTime % this.#interval);
    }
  };

  render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    if (this.#points.length === 0) {
      this.#points = this.#generatePoints(
        { x: sourceRect.x, y: sourceRect.y },
        { x: targetRect.right, y: targetRect.bottom }
      );

      this.#lastTime = 0;
      this.#currentTime = 0;
      this.#deltaTime = 0;

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

  #drawRopePoints() {
    this.#context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

    for (let i = 0; i < this.#points.length; i++) {
      let p = this.#points[i];

      const prev = i > 0 ? this.#points[i - 1] : null;

      if (prev) {
        this.#context.beginPath();
        this.#context.moveTo(prev.pos.x, prev.pos.y);
        this.#context.lineTo(p.pos.x, p.pos.y);
        this.#context.lineWidth = 2;
        this.#context.strokeStyle = 'black';
        this.#context.stroke();
      }
    }
  }

  #generatePoints(start: Vertex, end: Vertex) {
    const delta = Vector.sub(end, start);
    const len = Vector.mag(delta);
    const resolution = 5;
    let points: RopePoint[] = [];
    const pointsLen = Math.floor(len / resolution);

    for (let i = 0; i < pointsLen; i++) {
      const percentage = i / (pointsLen - 1);
      const pos = {
        x: lerp(start.x, end.x, percentage),
        y: lerp(start.y, end.y, percentage),
      };
      // new RopePoint({ x: lerpX, y: lerpY }, resolution, mass, damping, isFixed)
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

    //Link nodes into a doubly linked list
    for (let i = 0; i < pointsLen; i++) {
      const prev = i != 0 ? points[i - 1] : null;
      const curr = points[i];
      const next = i != pointsLen - 1 ? points[i + 1] : null;

      curr.prev = prev;
      curr.next = next;
    }

    return points;
  }

  // Integrate motion equations per node without taking into account relationship with other nodes...
  #integratePoint(point: RopePoint, gravity, dt, previousFrameDt) {
    if (!point.isFixed) {
      point.velocity = Vector.sub(point.pos, point.oldPos);
      point.oldPos = { ...point.pos };

      // Drastically improves stability
      let timeCorrection = previousFrameDt != 0.0 ? dt / previousFrameDt : 0.0;

      let accel = Vector.add(gravity, { x: 0, y: point.mass });

      const velCoef = timeCorrection * point.damping;
      const accelCoef = Math.pow(dt, 2);

      point.pos.x += point.velocity.x * velCoef + accel.x * accelCoef;
      point.pos.y += point.velocity.y * velCoef + accel.y * accelCoef;
    } else {
      point.velocity = Vector.zero();
      point.oldPos = { ...point.pos };
    }
  }

  // Apply constraints related to other nodes next to it (keeps each node within distance)
  #constrainPoint(point: RopePoint) {
    if (point.next) {
      const delta = Vector.sub(point.next.pos, point.pos);
      const len = Vector.mag(delta);
      const diff = len - point.distanceToNextPoint;
      const normal = Vector.normalized(delta);

      if (!point.isFixed) {
        point.pos.x += normal.x * diff * 0.25;
        point.pos.y += normal.y * diff * 0.25;
      }

      if (!point.next.isFixed) {
        point.next.pos.x -= normal.x * diff * 0.25;
        point.next.pos.y -= normal.y * diff * 0.25;
      }
    }
    if (point.prev) {
      const delta = Vector.sub(point.prev.pos, point.pos);
      const len = Vector.mag(delta);
      const diff = len - point.distanceToNextPoint;
      const normal = Vector.normalized(delta);

      if (!point.isFixed) {
        point.pos.x += normal.x * diff * 0.25;
        point.pos.y += normal.y * diff * 0.25;
      }

      if (!point.prev.isFixed) {
        point.prev.pos.x -= normal.x * diff * 0.25;
        point.prev.pos.y -= normal.y * diff * 0.25;
      }
    }
  }
}
