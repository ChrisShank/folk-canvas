import { LatLng, LatLngExpression, LeafletEvent, map, Map, tileLayer } from 'leaflet';

// @ts-ignore
// Vite specific import :(
import leafletCSS from 'leaflet/dist/leaflet.css?inline';
import { FolkElement } from '@lib/folk-element';
import { css, PropertyValues, unsafeCSS } from '@lit/reactive-element';

export class RecenterEvent extends Event {
  constructor() {
    super('recenter', { bubbles: true });
  }
}

export class FolkMap extends FolkElement {
  static override tagName = 'folk-map';

  static override styles = css`
    ${unsafeCSS(leafletCSS)}
    :host {
      display: block;
    }

    :host > div {
      height: 100%;
      width: 100%;
    }
  `;

  #container = document.createElement('div');
  #map = map(this.#container);

  override createRenderRoot() {
    const root = super.createRenderRoot();

    root.appendChild(this.#container);

    this.#map.addLayer(
      tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      })
    );

    this.#map.setView(
      (this.getAttribute('coordinates') || '0, 0').split(',').map(Number) as LatLngExpression,
      Number(this.getAttribute('zoom') || 13)
    );

    return root;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Move end includes changes to zoom
    this.#map.on('moveend', this.handleEvent);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    // Move end includes changes to zoom
    this.#map.off('moveend', this.handleEvent);
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

  handleEvent = (event: LeafletEvent) => {
    switch (event.type) {
      case 'moveend': {
        this.dispatchEvent(new RecenterEvent());
        break;
      }
    }
  };
}
