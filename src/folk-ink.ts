import { getStroke, StrokeOptions } from 'perfect-freehand';
import { css } from './common/tags';

export type Point = [x: number, y: number, pressure: number];

export type Stroke = number[][];

// TODO: look into any-pointer media queries to tell if the user has a mouse or touch screen
// https://developer.mozilla.org/en-US/docs/Web/CSS/@media/any-pointer
const styles = css`
  :host,
  svg {
    display: block;
    height: 100%;
    width: 100%;
    touch-action: none;
    pointer-events: none;
  }

  :host(:state(drawing)) {
    position: fixed;
    inset: 0 0 0 0;
    cursor: var(--tracing-cursor, crosshair);
  }
`;

declare global {
  interface HTMLElementTagNameMap {
    'folk-ink': FolkInk;
  }
}

export class FolkInk extends HTMLElement {
  static tagName = 'folk-ink';

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #internals = this.attachInternals();

  #svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  #path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  #size = Number(this.getAttribute('size') || 16);

  get size() {
    return this.#size;
  }
  set size(size) {
    this.#size = size;
    this.#update();
  }

  #thinning = Number(this.getAttribute('thinning') || 0.5);

  get thinning() {
    return this.#thinning;
  }
  set thinning(thinning) {
    this.#thinning = thinning;
    this.#update();
  }

  #smoothing = Number(this.getAttribute('smoothing') || 0.5);

  get smoothing() {
    return this.#smoothing;
  }
  set smoothing(smoothing) {
    this.#smoothing = smoothing;
    this.#update();
  }

  #streamline = Number(this.getAttribute('streamline') || 0.5);

  get streamline() {
    return this.#streamline;
  }
  set streamline(streamline) {
    this.#streamline = streamline;
    this.#update();
  }

  #simulatePressure = this.getAttribute('streamline') === 'false' ? false : true;

  get simulatePressure() {
    return this.#simulatePressure;
  }
  set simulatePressure(simulatePressure) {
    this.#simulatePressure = simulatePressure;
    this.#update();
  }

  #points: Point[] = JSON.parse(this.getAttribute('points') || '[]');

  get points() {
    return this.#points;
  }
  set points(points) {
    this.#points = points;
    this.#update();
  }

  constructor() {
    super();

    const shadowRoot = this.attachShadow({
      mode: 'open',
      delegatesFocus: true,
    });
    shadowRoot.adoptedStyleSheets.push(styles);
    this.#svg.appendChild(this.#path);
    shadowRoot.appendChild(this.#svg);
  }

  connectedCallback() {
    this.#update();
  }

  getPathBox() {
    return this.#path.getBBox();
  }

  setViewBox() {
    this.#svg.viewBox;
  }

  #tracingPromise: PromiseWithResolvers<void> | null = null;

  // TODO: cancel trace?
  draw(event?: PointerEvent) {
    if (event?.type === 'pointerdown') {
      this.handleEvent(event);
    } else {
      this.addEventListener('pointerdown', this);
    }
    this.#tracingPromise = Promise.withResolvers();
    return this.#tracingPromise.promise;
  }

  addPoint(point: Point) {
    this.#points.push(point);
    this.#update();
  }

  handleEvent(event: PointerEvent) {
    switch (event.type) {
      // for some reason adding a point on pointer down causes a bug
      case 'pointerdown': {
        if (event.button !== 0 || event.ctrlKey) return;

        this.points = [];
        this.addEventListener('lostpointercapture', this);
        this.addEventListener('pointermove', this);
        this.setPointerCapture(event.pointerId);
        this.#internals.states.add('drawing');
        return;
      }
      case 'pointermove': {
        this.addPoint([event.offsetX, event.offsetY, event.pressure]);
        return;
      }
      case 'lostpointercapture': {
        this.removeEventListener('pointerdown', this);
        this.removeEventListener('pointermove', this);
        this.removeEventListener('lostpointercapture', this);
        this.#internals.states.delete('drawing');
        this.#tracingPromise?.resolve();
        this.#tracingPromise = null;
        return;
      }
    }
  }

  #update() {
    const options: StrokeOptions = {
      size: this.#size,
      thinning: this.#thinning,
      smoothing: this.#smoothing,
      streamline: this.#streamline,
      simulatePressure: this.#simulatePressure,
      // TODO: figure out how to expose these as attributes
      easing: (t) => t,
      start: {
        taper: 100,
        easing: (t) => t,
        cap: true,
      },
      end: {
        taper: 100,
        easing: (t) => t,
        cap: true,
      },
    };
    this.#path.setAttribute('d', this.#getSvgPathFromStroke(getStroke(this.#points, options)));
  }

  #getSvgPathFromStroke(stroke: Stroke): string {
    if (stroke.length === 0) return '';

    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
  }
}
