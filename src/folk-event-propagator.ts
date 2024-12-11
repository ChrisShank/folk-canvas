import { css, PropertyValues } from '@lit/reactive-element';
import { FolkRope } from './folk-rope.ts';
import { property } from '@lit/reactive-element/decorators.js';
import { BiPropagator } from './common/BiPropagator.ts';

export class FolkEventPropagator extends FolkRope {
  static override tagName = 'folk-event-propagator';

  static styles = [
    ...FolkRope.styles,
    css`
      .input-container {
        position: absolute;
        display: flex;
        flex-direction: column;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }

      textarea {
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
      }

      .input-container textarea:first-child {
        border-radius: 5px 5px 0 0;
        border-bottom: none;
      }

      .input-container textarea:last-child {
        border-radius: 0 0 5px 5px;
      }
    `,
  ];

  @property({ type: String, reflect: true }) sourceTrigger = '';
  @property({ type: String, reflect: true }) sourceExpression = '';
  @property({ type: String, reflect: true }) targetTrigger = '';
  @property({ type: String, reflect: true }) targetExpression = '';

  #sourceTriggerTextarea = document.createElement('textarea');
  #sourceExpressionTextarea = document.createElement('textarea');
  #targetTriggerTextarea = document.createElement('textarea');
  #targetExpressionTextarea = document.createElement('textarea');
  #propagator: BiPropagator | null = null;

  #sourceContainer = document.createElement('div');
  #targetContainer = document.createElement('div');

  override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this.#sourceTriggerTextarea.addEventListener('change', () => {
      this.sourceTrigger = this.#sourceTriggerTextarea.value;
    });
    this.#sourceExpressionTextarea.addEventListener('input', () => {
      this.sourceExpression = this.#sourceExpressionTextarea.value;
    });
    this.#targetTriggerTextarea.addEventListener('change', () => {
      this.targetTrigger = this.#targetTriggerTextarea.value;
    });
    this.#targetExpressionTextarea.addEventListener('input', () => {
      this.targetExpression = this.#targetExpressionTextarea.value;
    });

    this.#sourceTriggerTextarea.value = this.sourceTrigger;
    this.#sourceExpressionTextarea.value = this.sourceExpression;
    this.#targetTriggerTextarea.value = this.targetTrigger;
    this.#targetExpressionTextarea.value = this.targetExpression;

    this.#sourceContainer.className = 'input-container';
    this.#targetContainer.className = 'input-container';

    this.#sourceContainer.append(this.#sourceTriggerTextarea, this.#sourceExpressionTextarea);
    this.#targetContainer.append(this.#targetTriggerTextarea, this.#targetExpressionTextarea);

    this.renderRoot.append(this.#sourceContainer, this.#targetContainer);

    this.#initializePropagator();
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (
      changedProperties.has('sourceTrigger') ||
      changedProperties.has('sourceExpression') ||
      changedProperties.has('targetTrigger') ||
      changedProperties.has('targetExpression')
    ) {
      this.#initializePropagator();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#propagator?.dispose();
  }

  #initializePropagator() {
    this.#propagator?.dispose();
    this.#propagator = new BiPropagator({
      source: this.sourceElement,
      target: this.targetElement,
      sourceEvent: this.sourceTrigger,
      targetEvent: this.targetTrigger,
      sourceHandler: this.sourceExpression,
      targetHandler: this.targetExpression,
      onParseError: () => this.cut(),
      onParseSuccess: () => this.mend(),
    });
    console.log(this.#propagator);
    console.log(this.sourceElement);
    console.log(this.targetElement);
    console.log(this.sourceTrigger);
    console.log(this.sourceExpression);
    console.log(this.targetTrigger);
    console.log(this.targetExpression);
  }

  override render() {
    super.render();

    const sourcePoint = this.points[Math.floor(this.points.length * 0.25)];
    if (sourcePoint) {
      this.#sourceContainer.style.left = `${sourcePoint.pos.x}px`;
      this.#sourceContainer.style.top = `${sourcePoint.pos.y}px`;
    }

    const targetPoint = this.points[Math.floor(this.points.length * 0.75)];
    if (targetPoint) {
      this.#targetContainer.style.left = `${targetPoint.pos.x}px`;
      this.#targetContainer.style.top = `${targetPoint.pos.y}px`;
    }
  }
}
