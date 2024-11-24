import { FolkRope } from './fc-rope.ts';

export class EventPropagator extends FolkRope {
  static override tagName = 'event-propagator';

  #triggers = (this.getAttribute('triggers') || '').split(',');
  get triggers() {
    return this.#triggers;
  }
  set triggers(triggers) {
    this.#triggers = triggers;
  }

  #expression = '';
  #function = new Function();
  get expression() {
    return this.#expression;
  }
  set expression(expression) {
    this.stroke = 'black';
    this.#expression = expression;
    try {
      this.#function = new Function('$source', '$target', '$event', expression);
    } catch (error) {
      console.warn('Failed to parse expression:', error);
      // Use no-op function when parsing fails
      this.stroke = 'red';
      this.#function = () => {};
    }
  }

  #textarea = document.createElement('textarea');

  constructor() {
    super();

    this.#textarea.style.cssText = `
      position: absolute;
      width: auto;
      min-width: 60px;
      height: auto;
      resize: none;
      background: white;
      border: 1px solid #ccc;
      padding: 4px;
      pointer-events: auto;
      overflow: hidden;
      field-sizing: content;
    `;

    this.#textarea.value = this.getAttribute('expression') || '';
    this.#textarea.addEventListener('input', () => {
      this.expression = this.#textarea.value;
    });

    this.shadowRoot?.appendChild(this.#textarea);
    this.expression = this.#textarea.value;
  }

  override render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    super.render(sourceRect, targetRect);

    // Position textarea between source and target
    const midX = (sourceRect.x + targetRect.x) / 2;
    const midY = (sourceRect.y + targetRect.y) / 2;

    // Center the textarea by subtracting half its width and height
    this.#textarea.style.left = `${midX - this.#textarea.offsetWidth / 2}px`;
    this.#textarea.style.top = `${midY - this.#textarea.offsetHeight / 2}px`;
  }

  override observeSource() {
    super.observeSource();

    for (const trigger of this.#triggers) {
      // TODO: add special triggers for intersection, rAF, etc.
      this.sourceElement?.addEventListener(trigger, this.evaluateExpression);
    }
    //should we evaluate them immediately?
    // this.evaluateExpression();
  }

  override unobserveSource() {
    super.unobserveSource();

    for (const trigger of this.#triggers) {
      // TODO: add special triggers for intersection, rAF, etc.
      this.sourceElement?.removeEventListener(trigger, this.evaluateExpression);
    }
  }

  override observeTarget() {
    super.observeTarget();
    // this.evaluateExpression();
  }

  override unobserveTarget() {
    super.unobserveTarget();
  }

  // Do we need the event at all?
  evaluateExpression = (event?: Event) => {
    if (this.sourceElement === null || this.targetElement === null) return;

    this.#function(this.sourceElement, this.targetElement, event);
  };
}
