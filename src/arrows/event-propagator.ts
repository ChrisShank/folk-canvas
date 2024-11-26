import { FolkRope } from './fc-rope.ts';

const styles = new CSSStyleSheet();
styles.replaceSync(`
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
`);

export class EventPropagator extends FolkRope {
  static override tagName = 'event-propagator';

  #triggers: string[] = [];
  get triggers() {
    return this.#triggers;
  }
  set triggers(triggers: string | string[]) {
    if (typeof triggers === 'string') {
      triggers = triggers.split(',');
    }
    this.#removeEventListenersToSource();

    this.#triggers = triggers;

    this.#addEventListenersToSource();
  }

  #expression = '';
  #function = new Function();
  get expression() {
    return this.#expression;
  }
  set expression(expression) {
    this.mend();
    this.#expression = expression;
    try {
      this.#function = new Function('$source', '$target', '$event', expression);
    } catch (error) {
      console.warn('Failed to parse expression:', error);
      // Use no-op function when parsing fails
      this.cut();
      this.#function = () => {};
    }
  }

  #triggerTextarea = document.createElement('textarea');
  #expressionTextarea = document.createElement('textarea');

  constructor() {
    super();

    this.shadowRoot?.adoptedStyleSheets.push(styles);

    this.#triggerTextarea.addEventListener('change', () => {
      this.triggers = this.#triggerTextarea.value;
    });
    this.triggers = this.#triggerTextarea.value = this.getAttribute('triggers') || '';

    this.shadowRoot?.appendChild(this.#triggerTextarea);

    this.#expressionTextarea.addEventListener('input', () => {
      this.expression = this.#expressionTextarea.value;
    });

    this.shadowRoot?.appendChild(this.#expressionTextarea);

    this.expression = this.#expressionTextarea.value = this.getAttribute('expression') || '';
  }

  override render(sourceRect: DOMRectReadOnly, targetRect: DOMRectReadOnly) {
    super.render(sourceRect, targetRect);
  }

  override draw() {
    super.draw();

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

  override observeSource() {
    super.observeSource();

    this.#addEventListenersToSource();
  }

  #addEventListenersToSource() {
    for (const trigger of this.#triggers) {
      // TODO: add special triggers for intersection, rAF, etc.
      this.sourceElement?.addEventListener(trigger, this.evaluateExpression);
    }
  }

  override unobserveSource() {
    super.unobserveSource();
    this.#removeEventListenersToSource();
  }

  #removeEventListenersToSource() {
    for (const trigger of this.#triggers) {
      this.sourceElement?.removeEventListener(trigger, this.evaluateExpression);
    }
  }

  override observeTarget() {
    super.observeTarget();
  }

  override unobserveTarget() {
    super.unobserveTarget();
  }

  // Do we need the event at all?
  evaluateExpression = (event?: Event) => {
    if (this.sourceElement === null || this.targetElement === null) return;
    this.stroke = 'black';
    try {
      this.#function(this.sourceElement, this.targetElement, event);
    } catch (error) {
      this.stroke = 'red';
    }
  };
}
