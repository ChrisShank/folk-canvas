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

s-columns {
  box-shadow: 0px 3px 5px 0px rgba(173, 168, 168, 0.4);
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
}

s-body {
  background-color: #f8f9fa;
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

::slotted(s-cell[type="number"]) {
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

function relativeColumnName(name: string, num: number) {
  const index = alphabet.indexOf(name);
  return alphabet[index + num];
}

export class SpreadsheetTable extends HTMLElement {
  static tagName = 's-table';

  static register() {
    customElements.define(this.tagName, this);
  }

  constructor() {
    super();

    this.addEventListener('click', this);
    this.addEventListener('keydown', this);

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets.push(styles);

    const columnHeaders = Array.from({ length: 26 })
      .map((_, i) => `<s-header type="column" data-index="${i}">${getColumnName(i)}</s-header>`)
      .join('');
    const columnRows = Array.from({ length: 100 })
      .map((_, i) => `<s-header type="row" data-index="${i + 1}">${i + 1}</s-header>`)
      .join('');

    shadow.innerHTML = `
      <s-header empty></s-header>
      <s-columns>${columnHeaders}</s-columns>
      <s-rows>${columnRows}</s-rows>
      <s-body><slot></slot></s-body>
    `;
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
        if (event.target instanceof SpreadsheetCell && event instanceof KeyboardEvent) {
          event.preventDefault(); // dont scroll as we change focus
          switch (event.code) {
            case 'ArrowUp': {
              event.target.cellAbove?.focus();
              return;
            }
            case 'ArrowDown': {
              event.target.cellBelow?.focus();
              return;
            }
            case 'ArrowLeft': {
              event.target.cellToTheLeft?.focus();
              return;
            }
            case 'ArrowRight': {
              event.target.cellToTheRight?.focus();
              return;
            }
          }
        }
        return;
      }
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

    this.#dependencies.forEach((dep) => dep.removeEventListener('propagate', this));

    if (expression === '') {
      this.#expression = expression;
      return;
    }

    if (!expression.includes('return ')) {
      expression = `return ${expression}`;
    }

    this.#expression = expression;

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

  handleEvent(event: Event) {
    switch (event.type) {
      case 'propagate': {
        this.#evaluate();
        return;
      }
    }
  }
}
