import { LatLng, LatLngExpression, LeafletEvent, map, Map, tileLayer } from 'leaflet';

// @ts-ignore
// Vite specific import :(
import css from 'leaflet/dist/leaflet.css?inline';
const styles = new CSSStyleSheet();
styles.replaceSync(`${css}
  :host {
    display: block;
  }
  
  :host > div {
    height: 100%;
    width: 100%;
  }  
`);

export class RecenterEvent extends Event {
  constructor() {
    super('recenter', { bubbles: true });
  }
}

export class FolkMap extends HTMLElement {
  static tagName = 'folk-map';

  static register() {
    customElements.define(this.tagName, this);
  }

  #container = document.createElement('div');
  #map!: Map;

  constructor() {
    super();

    this.handleEvent = this.handleEvent.bind(this);

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets.push(styles);
    shadow.appendChild(this.#container);
  }

  get coordinates() {
    return this.#map.getCenter();
  }
  set coordinates(coordinates) {
    this.#map.setView(coordinates);
  }

  get zoom() {
    return this.#map.getZoom();
  }
  set zoom(zoom) {
    this.#map.setZoom(zoom);
  }

  connectedCallback() {
    this.#map = map(this.#container);
    this.#map.addLayer(
      tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
    );

    this.#map.on('zoom', this.handleEvent);
    this.#map.on('moveend', this.handleEvent);

    this.#map.setView(
      (this.getAttribute('coordinates') || '0, 0').split(',').map(Number) as LatLngExpression,
      Number(this.getAttribute('zoom') || 13)
    );
  }

  handleEvent(event: LeafletEvent) {
    switch (event.type) {
      case 'zoom':
      case 'moveend': {
        this.dispatchEvent(new RecenterEvent());
        break;
      }
    }
  }
}
