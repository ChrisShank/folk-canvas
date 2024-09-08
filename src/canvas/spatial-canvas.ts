export class SpatialCanvas extends HTMLElement {
  static tagName = 'spatial-canvas';

  static register() {
    customElements.define(this.tagName, this);
  }
}
