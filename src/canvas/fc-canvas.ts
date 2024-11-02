export class FCSpace extends HTMLElement {
  static tagName = 'fc-space';

  static register() {
    customElements.define(this.tagName, this);
  }
}
