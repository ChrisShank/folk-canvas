import { css, PropertyValues } from '@lit/reactive-element';
import { FolkRope } from './folk-rope.ts';
import { property } from '@lit/reactive-element/decorators.js';
// import * as parser from '@babel/parser';

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

  #function: Function | null = null;
  #triggerTextarea = document.createElement('textarea');
  #expressionTextarea = document.createElement('textarea');

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
  }

  override updated(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has('trigger')) {
      this.sourceElement?.removeEventListener(this.trigger, this.#evaluateExpression);
      this.sourceElement?.addEventListener(this.trigger, this.#evaluateExpression);
    }

    if (changedProperties.has('expression')) {
      this.#parseExpression();
    }

    const previousSourceElement = changedProperties.get('sourceElement');
    if (previousSourceElement) {
      const trigger = changedProperties.get('trigger') || this.trigger;
      previousSourceElement.removeEventListener(trigger, this.#evaluateExpression);
      this.sourceElement?.addEventListener(this.trigger, this.#evaluateExpression);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.sourceElement?.removeEventListener(this.trigger, this.#evaluateExpression);
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

  #parseExpression() {
    const processedExp = this.expression.trim();

    const codeLines: string[] = [];

    // Split the expression into lines, handling different line endings
    const lines = processedExp.split(/\r?\n/);

    for (const line of lines) {
      let line_trimmed = line.trim();
      if (!line_trimmed) continue;

      // Remove trailing comma if it exists (only if it's at the very end of the line)
      if (line_trimmed.endsWith(',')) {
        line_trimmed = line_trimmed.slice(0, -1).trim();
      }

      // Find the first colon index, which separates the key and value.
      // Colons can still be used in ternary operators or other expressions,
      const colonIndex = line_trimmed.indexOf(':');
      if (colonIndex === -1) {
        // Line without a colon, skip or handle error
        console.warn(`Skipping line without colon: "${line_trimmed}"`);
        continue;
      }

      const key = line_trimmed.slice(0, colonIndex).trim();
      const value = line_trimmed.slice(colonIndex + 1).trim();

      if (key === '()') {
        // Anonymous function: directly evaluate the value
        codeLines.push(`${value};`);
      } else if (key.endsWith('()')) {
        // If the key is a method, execute it if the condition is true
        const methodName = key.slice(0, -2);
        codeLines.push(`
if (typeof to.${methodName} !== 'function') throw new Error(\`Method '${methodName}' does not exist on target element.\`);
else if (${value}) to.${methodName}();`);
      } else {
        // For property assignments, assign the value directly
        codeLines.push(`
if (!('${key}' in to)) throw new Error(\`Property '${key}' does not exist on target element.\`);
to.${key} = ${value};`);
      }
    }

    const functionBody = codeLines.join('\n');

    try {
      // parseAst(functionBody);
      this.#function = new Function('from', 'to', 'event', functionBody);
      this.mend();
    } catch (error) {
      console.warn('Failed to parse expression:', error, functionBody);
      this.cut();
      this.#function = null;
    }
  }

  #evaluateExpression = (event?: Event) => {
    if (this.sourceElement === null || this.targetElement === null) return;

    if (!this.#function) return;

    try {
      this.#function(this.sourceElement, this.targetElement, event);
      this.style.setProperty('--folk-rope-color', '');
    } catch (error) {
      console.warn('Failed to evaluate expression:', error);
      this.style.setProperty('--folk-rope-color', 'red');
    }
  };
}

/* function parseAst(functionBody: string) {
  const ast = parser.parse(functionBody, {
    sourceType: 'script',
  });

  const toProps = new Set<string>();
  const fromProps = new Set<string>();

  function walkAst(node: Node) {
    if (!node || typeof node !== 'object') return;

    if (node.type === 'MemberExpression' && node.object?.type === 'Identifier') {
      const objName = node.object.name;
      if (objName !== 'to' && objName !== 'from') return;

      const propSet = objName === 'to' ? toProps : fromProps;

      if (node.property?.type === 'Identifier') {
        propSet.add(node.property.name);
      } else if (node.property?.type === 'StringLiteral') {
        propSet.add(node.property.value);
      }
    }

    // Recursively walk through all properties
    for (const key of Object.keys(node)) {
      const value = (node as any)[key];
      if (Array.isArray(value)) {
        value.forEach(walkAst);
      } else if (value && typeof value === 'object') {
        walkAst(value as Node);
      }
    }
  }

  walkAst(ast);

  console.log('Properties accessed on to:', Array.from(toProps));
  console.log('Properties accessed on from:', Array.from(fromProps));
} */
