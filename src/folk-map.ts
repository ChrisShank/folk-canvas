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

  static define() {
    if (customElements.get(this.tagName)) return;
    customElements.define(this.tagName, this);
  }

  #container = document.createElement('div');
  #map!: Map;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets.push(styles);
    shadow.appendChild(this.#container);
  }

  get lat() {
    return this.coordinates.lat;
  }
  set lat(lat) {
    this.coordinates = [lat, this.lng];
  }

  get lng() {
    return this.coordinates.lng;
  }
  set lng(lng) {
    this.coordinates = [this.lat, lng];
  }

  get coordinates(): LatLng {
    return this.#map.getCenter();
  }
  set coordinates(coordinates: LatLngExpression) {
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

    // Move end includes changes to zoom
    this.#map.on('moveend', this.handleEvent);

    this.#map.setView(
      (this.getAttribute('coordinates') || '0, 0').split(',').map(Number) as LatLngExpression,
      Number(this.getAttribute('zoom') || 13)
    );
  }

  handleEvent = (event: LeafletEvent) => {
    switch (event.type) {
      case 'moveend': {
        this.dispatchEvent(new RecenterEvent());
        break;
      }
    }
  };
}

FolkMap.define();
