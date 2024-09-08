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

export class RecenterEvent extends CustomEvent<LatLng> {
  constructor(detail: LatLng) {
    super('recenter', { detail, bubbles: true });
  }
}

export class LeafletMap extends HTMLElement {
  static tagName = 'leaflet-map';

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

  connectedCallback() {
    this.#map = map(this.#container);
    this.#map.addLayer(
      tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
    );
    const coordinates = (this.getAttribute('coordinates')
      ?.split(',')
      .map((str) => Number(str)) || [0, 0]) as LatLngExpression;
    const zoom = Number(this.getAttribute('zoom') || 13);
    this.#map.setView(coordinates, zoom);

    this.#map.on('zoom', this.handleEvent);
    this.#map.on('moveend', this.handleEvent);
  }

  handleEvent(event: LeafletEvent) {
    switch (event.type) {
      case 'zoom':
      case 'moveend': {
        this.dispatchEvent(new RecenterEvent(this.#map.getCenter()));
        break;
      }
    }
  }
}
