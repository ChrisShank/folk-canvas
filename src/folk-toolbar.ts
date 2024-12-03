import { FolkEventPropagator } from './folk-event-propagator.ts';
import { css } from './common/tags.ts';

const styles = new CSSStyleSheet();
styles.replaceSync(css`
  :host {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    gap: 8px;
  }

  button {
    padding: 8px 16px;
    border-radius: 4px;
    border: 1px solid #ccc;
    background: white;
    cursor: pointer;
  }

  button.active {
    background: #eee;
  }
`);

export class FolkToolbar extends HTMLElement {
  static tagName = 'folk-toolbar';

  static define() {
    customElements.define(this.tagName, this);
  }

  #mode: 'idle' | 'connecting' = 'idle';
  #sourceElement: Element | null = null;
  #connectBtn: HTMLButtonElement;

  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [styles];

    const connectBtn = document.createElement('button');
    connectBtn.textContent = 'Connect Elements';
    connectBtn.addEventListener('click', () => this.toggleConnectionMode());
    this.#connectBtn = connectBtn;
    shadow.appendChild(connectBtn);

    document.addEventListener('click', this.handleDocumentClick.bind(this));
  }

  toggleConnectionMode() {
    if (this.#mode === 'idle') {
      this.#mode = 'connecting';
      this.#sourceElement = null;
      document.body.style.cursor = 'crosshair';
      this.#connectBtn.classList.add('active');
      this.#connectBtn.textContent = 'Select Source Element...';
    } else {
      this.#mode = 'idle';
      this.#sourceElement = null;
      document.body.style.cursor = '';
      this.#connectBtn.classList.remove('active');
      this.#connectBtn.textContent = 'Connect Elements';
    }
  }

  handleDocumentClick(event: MouseEvent) {
    if (this.#mode !== 'connecting') return;

    // Prevent clicking toolbar itself
    if (event.composedPath().includes(this)) return;

    event.preventDefault();

    const target = event.target as Element;

    if (!this.#sourceElement) {
      // First click - select source
      this.#sourceElement = target;
      this.#connectBtn.textContent = 'Select Target Element...';
    } else {
      // Second click - create connection
      this.createConnection(this.#sourceElement, target);
      this.#sourceElement = null;
      this.#mode = 'idle';
      document.body.style.cursor = '';
      this.#connectBtn.classList.remove('active');
      this.#connectBtn.textContent = 'Connect Elements';
    }
  }

  createConnection(source: Element, target: Element) {
    const sourceId = source.id || this.ensureElementId(source);
    const targetId = target.id || this.ensureElementId(target);

    // hack because we gotta sort out usage of constructor vs connectedCallback
    const propagator = new DOMParser().parseFromString(
      `
      <folk-event-propagator 
        source="#${sourceId}"
        target="#${targetId}"
        triggers="click"
        expression="rotation: Math.random() * 360"
      ></folk-event-propagator>
    `,
      'text/html'
    ).body.firstElementChild;

    if (!customElements.get('folk-event-propagator')) {
      FolkEventPropagator.define();
    }
    if (propagator) {
      document.body.appendChild(propagator);
    }
  }

  ensureElementId(element: Element): string {
    if (!element.id) {
      element.id = `folk-element-${Math.random().toString(36).slice(2)}`;
    }
    return element.id;
  }
}
