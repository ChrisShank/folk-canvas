// will eventually extend Lit's ReactiveElement
export class FolkElement extends HTMLElement {
  static tagName = '';

  static define() {
    if (customElements.get(this.tagName)) return;

    customElements.define(this.tagName, this);
  }
}
