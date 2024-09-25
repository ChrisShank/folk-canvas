import getStroke, { StrokeOptions } from 'perfect-freehand';

export type Point = [x: number, y: number, pressure: number];

export type Stroke = number[][];

// TODO: look into any-pointer media queries to tell if the user has a mouse or touch screen
// https://developer.mozilla.org/en-US/docs/Web/CSS/@media/any-pointer
const styles = new CSSStyleSheet();
styles.replaceSync(`
  :host, svg {
    display: block;
    height: 100%;
    width: 100%;
    touch-action: none;
  }
`);

export class SpatialInk extends HTMLElement {
  static tagName = 'spatial-ink';

  static register() {
    customElements.define(this.tagName, this);
  }

  #internals = this.attachInternals();

  #path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  #stroke: Stroke = [];

  #d = '';

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

    const shadowRoot = this.attachShadow({ mode: 'open', delegatesFocus: true });
    shadowRoot.adoptedStyleSheets.push(styles);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.appendChild(this.#path);
    shadowRoot.appendChild(svg);
  }

  connectedCallback() {
    this.#update();
  }

  #tracingPromise: PromiseWithResolvers<DOMRectReadOnly | undefined> | null = null;

  // TODO: cancel trace?
  async draw(event: PointerEvent): Promise<DOMRectReadOnly | undefined> {
    if (event.button !== 0 || event.ctrlKey) return;

    this.points = [];
    this.addPoint([event.pageX, event.pageY, event.pressure]);
    this.addEventListener('lostpointercapture', this);
    this.addEventListener('pointermove', this);
    this.setPointerCapture(event.pointerId);
    this.#tracingPromise = Promise.withResolvers<DOMRectReadOnly | undefined>();
    return this.#tracingPromise.promise;
  }

  addPoint(point: Point) {
    this.#points.push(point);
    this.#update();
  }

  handleEvent(event: PointerEvent) {
    switch (event.type) {
      case 'pointermove': {
        this.addPoint([event.pageX, event.pageY, event.pressure]);
        return;
      }
      case 'lostpointercapture': {
        this.removeEventListener('pointermove', this);
        this.removeEventListener('pointerdown', this);
        this.removeEventListener('lostpointercapture', this);
        this.#tracingPromise?.resolve(this.#path.getBoundingClientRect());
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

    this.#stroke = getStroke(this.#points, options);
    this.#d = this.#getSvgPathFromStroke(this.#stroke);
    this.#path.setAttribute('d', this.#d);
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
