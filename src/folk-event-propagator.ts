import { css, PropertyValues } from '@lit/reactive-element';
import { FolkRope } from './folk-rope.ts';
import { property } from '@lit/reactive-element/decorators.js';
import { Propagator } from './common/Propagator.ts';

export class FolkEventPropagator extends FolkRope {
  static override tagName = 'folk-event-propagator';

  static styles = [
    ...FolkRope.styles,
    css`
      textarea {
        position: absolute;
        width: auto;
        min-width: 3ch;
        height: auto;
        resize: none;
        background: rgba(256, 256, 256, 0.8);
        border: 1px solid #ccc;
        padding: 4px;
        pointer-events: auto;
        overflow: hidden;
        field-sizing: content;
        translate: -50% -50%;
        border-radius: 5px;
      }
    `,
  ];

  @property({ type: String, reflect: true }) trigger = '';
  @property({ type: String, reflect: true }) expression = '';

  #triggerTextarea = document.createElement('textarea');
  #expressionTextarea = document.createElement('textarea');
  #propagator: Propagator | null = null;

  override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this.#triggerTextarea.addEventListener('change', () => {
      this.trigger = this.#triggerTextarea.value;
    });

    this.#expressionTextarea.addEventListener('input', () => {
      this.expression = this.#expressionTextarea.value;
    });

    this.#triggerTextarea.value = this.trigger;
    this.#expressionTextarea.value = this.expression;

    this.renderRoot.append(this.#triggerTextarea, this.#expressionTextarea);

    this.#initializePropagator();
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has('trigger') || changedProperties.has('expression')) {
      this.#initializePropagator();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#propagator?.dispose();
  }

  #initializePropagator() {
    this.#propagator?.dispose();
    this.#propagator = new Propagator({
      source: this.sourceElement,
      target: this.targetElement,
      event: this.trigger,
      handler: this.expression,
      onParseError: () => this.cut(),
      onParseSuccess: () => this.mend(),
    });
  }

  override render() {
    super.render();

    const triggerPoint = this.points[Math.floor(this.points.length / 5)];
    if (triggerPoint) {
      this.#triggerTextarea.style.left = `${triggerPoint.pos.x}px`;
      this.#triggerTextarea.style.top = `${triggerPoint.pos.y}px`;
    }

    const expressionPoint = this.points[Math.floor(this.points.length / 2)];
    if (expressionPoint) {
      this.#expressionTextarea.style.left = `${expressionPoint.pos.x}px`;
      this.#expressionTextarea.style.top = `${expressionPoint.pos.y}px`;
    }
  }
}
