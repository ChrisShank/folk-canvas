import { AbstractArrow } from './abstract-arrow.ts';
// This is a direct port from https://github.com/guerrillacontra/html5-es6-physics-rope/blob/master/js/microlib.js
const lerp = (first, second, percentage) => first + (second - first) * percentage;

class Vector2 {
  static zero() {
    return { x: 0, y: 0 };
  }

  static sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  static add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  static mult(a, b) {
    return { x: a.x * b.x, y: a.y * b.y };
  }

  static scale(v, scaleFactor) {
    return { x: v.x * scaleFactor, y: v.y * scaleFactor };
  }

  static mag(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  static normalized(v) {
    const mag = Vector2.mag(v);

    if (mag === 0) {
      return Vector2.zero();
    }
    return { x: v.x / mag, y: v.y / mag };
  }
}

//each rope part is one of these
//uses a high precison varient of Störmer–Verlet integration
//to keep the simulation consistant otherwise it would "explode"!
class RopePoint {
  //integrates motion equations per node without taking into account relationship
  //with other nodes...
  static integrate(point, gravity, dt, previousFrameDt) {
    if (!point.isFixed) {
      point.velocity = Vector2.sub(point.pos, point.oldPos);
      point.oldPos = { ...point.pos };

      //drastically improves stability
      let timeCorrection = previousFrameDt != 0.0 ? dt / previousFrameDt : 0.0;

      let accel = Vector2.add(gravity, { x: 0, y: point.mass });

      const velCoef = timeCorrection * point.damping;
      const accelCoef = Math.pow(dt, 2);

      point.pos.x += point.velocity.x * velCoef + accel.x * accelCoef;
      point.pos.y += point.velocity.y * velCoef + accel.y * accelCoef;
    } else {
      point.velocity = Vector2.zero();
      point.oldPos = { ...point.pos };
    }
  }

  //apply constraints related to other nodes next to it
  //(keeps each node within distance)
  static constrain(point) {
    if (point.next) {
      const delta = Vector2.sub(point.next.pos, point.pos);
      const len = Vector2.mag(delta);
      const diff = len - point.distanceToNextPoint;
      const normal = Vector2.normalized(delta);

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
      const delta = Vector2.sub(point.prev.pos, point.pos);
      const len = Vector2.mag(delta);
      const diff = len - point.distanceToNextPoint;
      const normal = Vector2.normalized(delta);

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

  constructor(initialPos, distanceToNextPoint, mass = 1, damping = 1, isFixed = false) {
    this.pos = initialPos;
    this.distanceToNextPoint = distanceToNextPoint;
    this.isFixed = isFixed;
    this.oldPos = { ...initialPos };
    this.velocity = Vector2.zero();
    this.mass = mass;
    this.damping = damping;
    this.prev = null;
    this.next = null;
  }
}

//manages a collection of rope points and executes
//the integration
class Rope {
  //generate an array of points suitable for a dynamic
  //rope contour
  static generate(start, end, resolution, mass, damping) {
    const delta = Vector2.sub(end, start);
    const len = Vector2.mag(delta);

    let points: RopePoint[] = [];
    const pointsLen = Math.floor(len / resolution);

    for (let i = 0; i < pointsLen; i++) {
      const percentage = i / (pointsLen - 1);

      const lerpX = lerp(start.x, end.x, percentage);
      const lerpY = lerp(start.y, end.y, percentage);
      const isFixed = i === 0 || i === pointsLen - 1;
      points.push(new RopePoint({ x: lerpX, y: lerpY }, resolution, mass, damping, isFixed));
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

  constructor(points, solverIterations) {
    this._points = points;
    this._prevDelta = 0;
    this._solverIterations = solverIterations;
  }

  update(gravity, dt) {
    for (const point of this._points) {
      let accel = { ...gravity };

      RopePoint.integrate(point, accel, dt, this._prevDelta);
    }

    for (let iteration = 0; iteration < this._solverIterations; iteration++)
      for (const point of this._points) {
        RopePoint.constrain(point);
      }

    this._prevDelta = dt;
  }
}

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

  #lastTime = 0;
  #currentTime = 0;
  #deltaTime = 0;
  #interval = 1000 / 60; // ms per frame
  #gravity = { x: 0, y: 3000 };
  #points: RopePoint[] = [];
  #rope: Rope | null = null;

  constructor() {
    super();

    this.#canvas.width = this.clientWidth;
    this.#canvas.height = this.clientHeight;

    this.#shadow.appendChild(this.#canvas);
    this.tick = this.tick.bind(this);
  }

  tick(timestamp: number) {
    requestAnimationFrame(this.tick);

    this.#currentTime = timestamp;

    this.#deltaTime = this.#currentTime - this.#lastTime;

    if (this.#deltaTime > this.#interval) {
      //delta time in seconds
      const dts = this.#deltaTime * 0.001;

      this.#rope?.update(this.#gravity, dts);

      this.drawRopePoints();

      this.#lastTime = this.#currentTime - (this.#deltaTime % this.#interval);
    }
  }

  render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    if (this.#rope === null) {
      this.#points = Rope.generate(
        { x: 100, y: this.#canvas.height / 2 },
        { x: this.#canvas.width - 100, y: this.#canvas.height / 2 },
        5,
        1,
        0.99
      );

      this.#rope = new Rope(this.#points, 600);

      this.#lastTime = 0;
      this.#currentTime = 0;
      this.#deltaTime = 0;

      this.tick(performance.now());
    }

    const startingPoint = this.#points.at(0);
    const endingPoint = this.#points.at(-1);

    if (startingPoint === undefined || endingPoint === undefined) return;

    startingPoint.pos.x = sourceRect.x + sourceRect.width / 2;
    startingPoint.pos.y = sourceRect.y + sourceRect.height / 2;

    endingPoint.pos.x = targetRect.x + targetRect.width / 2;
    endingPoint.pos.y = targetRect.y + targetRect.height / 2;
  }

  drawRopePoints() {
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
}
