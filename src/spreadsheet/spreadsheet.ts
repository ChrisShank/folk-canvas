const styles = new CSSStyleSheet();
styles.replaceSync(`
:host {
  --column-number: 26;
  --row-number: 100;
  --cell-height: 1.75rem;
  --cell-width: 100px;
  display: grid;
  font-family: monospace;
  grid-template-columns: 50px repeat(var(--column-number), var(--cell-width));
  grid-template-rows: repeat(calc(var(--row-number) + 1), var(--cell-height));
  position: relative;
  overflow: scroll;
  scroll-snap-type: both mandatory;
  scroll-padding-top: var(--cell-height);
  scroll-padding-left: 50px;
}

textarea {
  background-color: rgba(255, 255, 255, 0.75);
  grid-column: var(--text-column, 0);
  grid-row: var(--text-row, 0);
}

s-columns {
  box-shadow: 0px 3px 5px 0px rgba(173, 168, 168, 0.6);
  display: grid;
  grid-column: 2 / -1;
  grid-row: 1;
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
  position: sticky;
  top: 0;
  z-index: 2;
}

s-rows {
  box-shadow: 3px 0px 5px 0px rgba(173, 168, 168, 0.4);
  display: grid;
  grid-column: 1;
  grid-row: 2 / -1;
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
  position: sticky;
  left: 0;
  z-index: 2;

  s-header {
    font-size: 0.75rem;
  }
}

s-header {
  background-color: #f8f9fa;
  border: 1px solid #e1e1e1;
  display: flex;
  padding: 0.125rem 0.5rem;
  align-items: center;
  justify-content: center;

  &[empty] {
    box-shadow: 3px 3px 3px 0px rgba(173, 168, 168, 0.4);
    grid-area: 1;
    position: sticky;
    top: 0;
    left: 0;
    z-index: 3;
  }

  &:state(selected) {
    background-color: #d3e2fd;
    font-weight: bold;
  }
}

s-body {
  background-color: rgb(255, 255, 255);
  display: grid;
  grid-column: 2 / -1;
  grid-row: 2 / -1;
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
}

::slotted(s-cell) {
  align-items: center;
  border: 0.5px solid #e1e1e1;
  display: flex;
  padding: 0.25rem;
  justify-content: start;
  scroll-snap-align: start;
}

::slotted(s-cell[type='number']) {
  justify-content: end;
}

::slotted(s-cell:focus) {
  border: 2px solid #1b73e8;
  outline: none;
}
`);

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getColumnName(index: number) {
  return alphabet[index % alphabet.length];
}

function getColumnIndex(name: string) {
  return alphabet.indexOf(name);
}

function relativeColumnName(name: string, num: number) {
  const index = alphabet.indexOf(name);
  return alphabet[index + num];
}

export class SpreadsheetTable extends HTMLElement {
  static tagName = 's-table';

  static register() {
    customElements.define(this.tagName, this);
  }

  #shadow = this.attachShadow({ mode: 'open' });

  #textarea;

  #editedCell: SpreadsheetCell | null = null;

  constructor() {
    super();

    this.addEventListener('click', this);
    this.addEventListener('dblclick', this);
    this.addEventListener('keydown', this);
    this.addEventListener('focusin', this);
    this.addEventListener('focusout', this);

    this.#shadow.adoptedStyleSheets.push(styles);
    const columnHeaders = Array.from({ length: 26 })
      .map((_, i) => `<s-header column="${getColumnName(i)}">${getColumnName(i)}</s-header>`)
      .join('');
    const columnRows = Array.from({ length: 100 })
      .map((_, i) => `<s-header row="${i + 1}">${i + 1}</s-header>`)
      .join('');

    this.#shadow.innerHTML = `
      <s-header empty></s-header>
      <s-columns>${columnHeaders}</s-columns>
      <s-rows>${columnRows}</s-rows>
      <s-body><slot></slot></s-body>
      <textarea hidden></textarea>
    `;

    this.#textarea = this.#shadow.querySelector('textarea')!;
  }

  #range = '';
  get range() {
    return this.#range;
  }
  set range(range) {
    this.#range = range;
  }

  connectedCallback() {
    let html = '';

    for (let i = 0; i < 100; i += 1) {
      for (let j = 0; j < 26; j += 1) {
        html += `<s-cell column="${getColumnName(j)}" row="${i + 1}" tabindex="0"></s-cell>`;
      }
    }

    this.innerHTML = html;
  }

  handleEvent(event: Event) {
    switch (event.type) {
      case 'keydown': {
        if (!(event instanceof KeyboardEvent)) return;

        const { target } = event;

        if (target instanceof SpreadsheetCell) {
          event.preventDefault(); // dont scroll as we change focus

          switch (event.code) {
            case 'ArrowUp': {
              target.cellAbove?.focus();
              return;
            }
            case 'ArrowDown': {
              target.cellBelow?.focus();
              return;
            }
            case 'ArrowLeft': {
              target.cellToTheLeft?.focus();
              return;
            }
            case 'ArrowRight': {
              target.cellToTheRight?.focus();
              return;
            }
            case 'Enter': {
              this.#focusTextarea(target);
              return;
            }
          }
          return;
        }

        const composedTarget = event.composedPath()[0];
        if (composedTarget === this.#textarea) {
          if (event.code === 'Escape' || (event.code === 'Enter' && event.shiftKey)) {
            // Focusing out of the textarea will clean it up.
            this.#textarea.blur();
          }
        }
        return;
      }
      case 'dblclick': {
        if (event.target instanceof SpreadsheetCell) {
          this.#focusTextarea(event.target);
        }
        return;
      }
      case 'focusin': {
        if (event.target instanceof SpreadsheetCell) {
          this.#getHeader('column', event.target.column).selected = true;
          this.#getHeader('row', event.target.row).selected = true;
          this.range = event.target.name;
        }

        return;
      }
      case 'focusout': {
        if (event.target instanceof SpreadsheetCell) {
          this.#getHeader('column', event.target.column).selected = false;
          this.#getHeader('row', event.target.row).selected = false;
          this.range = event.target.name;
          return;
        }

        const composedTarget = event.composedPath()[0];
        if (composedTarget === this.#textarea) {
          this.#resetTextarea();
        }

        return;
      }
    }
  }

  #getHeader(type: 'row' | 'column', value: string | number): SpreadsheetHeader {
    return this.#shadow.querySelector(`s-header[${type}="${value}"]`)!;
  }

  #focusTextarea(cell: SpreadsheetCell) {
    this.#editedCell = cell;
    const gridColumn = getColumnIndex(cell.column) + 2;
    const gridRow = cell.row + 1;
    this.#textarea.style.setProperty('--text-column', `${gridColumn} / ${gridColumn + 3}`);
    this.#textarea.style.setProperty('--text-row', `${gridRow} / ${gridRow + 3}`);
    this.#textarea.value = cell.expression;
    this.#textarea.hidden = false;
    this.#textarea.focus();
  }

  #resetTextarea() {
    if (this.#editedCell === null) return;
    this.#textarea.style.setProperty('--text-column', '0');
    this.#textarea.style.setProperty('--text-row', '0');
    this.#editedCell.expression = this.#textarea.value;
    this.#textarea.value = '';
    this.#editedCell.focus();
    this.#textarea.hidden = true;
    this.#editedCell = null;
  }
}

export class SpreadsheetHeader extends HTMLElement {
  static tagName = 's-header';

  static register() {
    customElements.define(this.tagName, this);
  }

  #internals = this.attachInternals();

  #selected = false;
  get selected() {
    return this.#selected;
  }
  set selected(selected) {
    this.#selected = selected;

    if (this.#selected) {
      this.#internals.states.add('selected');
    } else {
      this.#internals.states.delete('selected');
    }
  }
}

export class SpreadsheetCell extends HTMLElement {
  static tagName = 's-cell';

  static register() {
    customElements.define(this.tagName, this);
  }

  connectedCallback() {
    // this should run after all of the other cells have run
    this.expression = this.getAttribute('expression') || '';
  }

  get type() {
    return this.getAttribute('type') || '';
  }

  get name() {
    return `${this.#column}${this.#row}`;
  }

  #column = this.getAttribute('column') || '';
  get column() {
    return this.#column;
  }
  set column(column) {
    this.#column = column;
  }

  #row = Number(this.getAttribute('row')) || -1;
  get row() {
    return this.#row;
  }
  set row(row) {
    this.#row = row;
  }

  #expression = '';
  #dependencies: SpreadsheetCell[] = [];
  #function = new Function();
  get expression() {
    return this.#expression;
  }
  set expression(expression) {
    expression = expression.trim();
    this.#expression = expression;

    this.#dependencies.forEach((dep) => dep.removeEventListener('propagate', this));

    if (expression === '') return;

    if (!expression.includes('return ')) {
      expression = `return ${expression}`;
    }

    const argNames: string[] = expression.match(/\$[A-Z]+\d+/g) ?? [];

    this.#dependencies = argNames
      .map((dep) => {
        const [, column, row] = dep.split(/([A-Z]+)(\d+)/s);
        return this.#getCell(column, row);
      })
      .filter((cell) => cell !== null);

    this.#dependencies.forEach((dep) => dep.addEventListener('propagate', this));

    this.#function = new Function(...argNames, expression);

    this.#evaluate();
  }

  // More generic parsing?
  #value = NaN;
  get value(): number {
    return this.#value;
  }

  #getCell(column: string, row: number | string): SpreadsheetCell | null {
    return document.querySelector(`s-cell[column="${column}"][row="${row}"]`);
  }

  get cellAbove() {
    return this.#getCell(this.#column, this.#row - 1);
  }

  get cellBelow() {
    return this.#getCell(this.#column, this.#row + 1);
  }

  get cellToTheLeft() {
    return this.#getCell(relativeColumnName(this.column, -1), this.#row);
  }

  get cellToTheRight() {
    return this.#getCell(relativeColumnName(this.column, 1), this.#row);
  }

  #evaluate() {
    try {
      this.#invalidated = false;
      const args = this.#dependencies.map((dep) => dep.value);

      const value = this.#function.apply(null, args);

      if (typeof value === 'number' && !Number.isNaN(value)) {
        this.#value = value;
        this.textContent = value.toString();
        this.dispatchEvent(new Event('propagate'));
        this.setAttribute('type', 'number');
      }
    } catch (error) {
      console.log(error);
    }
  }

  #invalidated = false;

  handleEvent(event: Event) {
    switch (event.type) {
      case 'propagate': {
        // This deduplicates call similar to a topological sort algorithm.
        if (this.#invalidated) return;
        this.#invalidated = true;
        queueMicrotask(() => this.#evaluate());
        return;
      }
    }
  }
}
