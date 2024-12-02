import { css } from './common/tags.ts';
import { FolkRope } from './folk-rope.ts';

const styles = new CSSStyleSheet();
styles.replaceSync(css`
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

export class FolkEventPropagator extends FolkRope {
  static override tagName = 'folk-event-propagator';

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
  #function: Function | null = null;
  get expression() {
    return this.#expression;
  }
  set expression(expression) {
    this.mend();
    this.#expression = expression;
    try {
      const processedExp = expression.trim();

      // Process each line, looking for the first ':' to separate key from value
      const processedProps = processedExp
        .split('\n')
        .map((line) => {
          const line_trimmed = line.trim();
          if (!line_trimmed || line_trimmed === '{' || line_trimmed === '}') return '';

          // Remove trailing comma if it exists
          const withoutComma = line_trimmed.replace(/,\s*$/, '');

          const colonIndex = withoutComma.indexOf(':');
          if (colonIndex === -1) return withoutComma;

          const key = withoutComma.slice(0, colonIndex).trim();
          const value = withoutComma.slice(colonIndex + 1).trim();

          return `${key}: (function() { const _ = to[${JSON.stringify(key)}]; return ${value}; })()`;
        })
        .filter((line) => line)
        .join(',\n');

      this.#function = new Function(
        'from',
        'to',
        'event',
        `
      return {
        ${processedProps}
      };
    `
      );

      console.log(processedProps);

      this.#function = new Function(
        'from',
        'to',
        'event',
        `
        return {
          ${processedProps}
        };
      `
      );
    } catch (error) {
      console.warn('Failed to parse expression:', error);
      this.cut();
      this.#function = null;
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

  evaluateExpression = (event?: Event) => {
    if (this.sourceElement === null || this.targetElement === null) return;
    this.stroke = 'black';
    if (!this.#function) return;

    try {
      const assignments = this.#function(this.sourceElement, this.targetElement, event);
      Object.assign(this.targetElement, assignments);
    } catch (error) {
      console.warn('Failed to parse expression:', error);
      this.stroke = 'red';
    }
  };
}
