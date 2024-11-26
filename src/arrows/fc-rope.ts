// This is a rewrite of https://github.com/guerrillacontra/html5-es6-physics-rope

import { ResizeObserverManager } from '../resize-observer.ts';
import { Vector, type Vector2 } from '../utils/Vector2.ts';
import { AbstractArrow } from './abstract-arrow.ts';
import { Vertex } from './utils.ts';

const lerp = (first: number, second: number, percentage: number) => first + (second - first) * percentage;

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

  #svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  #path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  #shadow = this.attachShadow({ mode: 'open' });

  #rAFId = -1;
  #lastTime = 0;
  #currentTime = 0;
  #deltaTime = 0;
  #previousDelta = 0;
  #interval = 1000 / 60; // ms per frame
  #gravity = { x: 0, y: 3000 };
  #points: RopePoint[] = [];

  get points() {
    return this.#points;
  }

  #stroke = this.getAttribute('stroke') || 'black';
  get stroke() {
    return this.#stroke;
  }
  set stroke(stroke) {
    this.#stroke = stroke;
    // TODO: redraw rope?
  }

  constructor() {
    super();

    this.#svg.appendChild(this.#path);
    this.#shadow.appendChild(this.#svg);
  }

  override connectedCallback(): void {
    super.connectedCallback();

    resizeObserver.observe(this, this.#onResize);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    resizeObserver.unobserve(this, this.#onResize);
    cancelAnimationFrame(this.#rAFId);
  }

  #onResize = (entry: ResizeObserverEntry) => {
    this.#svg.setAttribute('width', entry.contentRect.width.toString());
    this.#svg.setAttribute('height', entry.contentRect.height.toString());
    this.draw();
  };

  #tick = (timestamp: number = performance.now()) => {
    this.#currentTime = timestamp;

    this.#rAFId = requestAnimationFrame(this.#tick);

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

      this.draw();

      this.#lastTime = this.#currentTime - (this.#deltaTime % this.#interval);
    }
  };

  override render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    if (this.#points.length === 0) {
      this.#points = this.#generatePoints(
        { x: sourceRect.x + sourceRect.width / 2, y: sourceRect.bottom },
        { x: targetRect.x + targetRect.width / 2, y: targetRect.bottom }
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

  draw() {
    if (this.#points.length < 2) return;

    let pathData = `M ${this.#points[0].pos.x} ${this.#points[0].pos.y}`;

    for (let i = 1; i < this.#points.length; i++) {
      pathData += ` L ${this.#points[i].pos.x} ${this.#points[i].pos.y}`;
    }

    this.#path.setAttribute('d', pathData);
    this.#path.setAttribute('stroke', this.#stroke);
    this.#path.setAttribute('stroke-width', '2');
    this.#path.setAttribute('fill', 'none');
  }

  #generatePoints(start: Vertex, end: Vertex) {
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

  // Integrate motion equations per node without taking into account relationship with other nodes...
  #integratePoint(point: RopePoint, gravity: Vector2, dt: number, previousFrameDt: number) {
    if (!point.isFixed) {
      point.velocity = Vector.sub(point.pos, point.oldPos);
      point.oldPos = { ...point.pos };

      // Drastically improves stability
      const timeCorrection = previousFrameDt !== 0.0 ? dt / previousFrameDt : 0.0;

      const accel = Vector.add(gravity, { x: 0, y: point.mass });

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
    const applyConstraint = (p1: RopePoint, p2: RopePoint) => {
      const delta = Vector.sub(p2.pos, p1.pos);
      const len = Vector.mag(delta);
      const diff = len - p1.distanceToNextPoint;
      const normal = Vector.normalized(delta);
      const adjustment = Vector.scale(normal, diff * 0.25);

      if (!p1.isFixed) {
        p1.pos = Vector.add(p1.pos, adjustment);
      }
      if (!p2.isFixed) {
        p2.pos = Vector.sub(p2.pos, adjustment);
      }
    };

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
