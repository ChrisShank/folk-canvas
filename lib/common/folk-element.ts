import { ReactiveElement } from '@lit/reactive-element';

// will eventually extend Lit's ReactiveElement
export class FolkElement extends ReactiveElement {
  static tagName = '';

  static define() {
    if (customElements.get(this.tagName)) return;

    customElements.define(this.tagName, this);
  }
}
