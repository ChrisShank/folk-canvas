import { map, Map, tileLayer } from 'leaflet';

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

export class LeafletMap extends HTMLElement {
  static tagName = 'leaflet-map';

  static register() {
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

  connectedCallback() {
    this.#map = map(this.#container);
    this.#map.addLayer(
      tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
    );
    this.#map.setView([52.09, 5.12], 13);
  }
}
