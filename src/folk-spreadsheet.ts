const styles = new CSSStyleSheet();
// hardcoded column and row numbers
styles.replaceSync(`
:host {
  --column-number: 10;
  --row-number: 10;
  --cell-height: 1.75rem;
  --cell-width: 100px;
  --border-color: #e1e1e1;
  border: solid 1px var(--border-color);
  box-sizing: border-box;
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
  z-index: 11;
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
  display: grid;
  grid-column: 2 / -1;
  grid-row: 2 / -1;
  grid-template-columns: subgrid;
  grid-template-rows: subgrid;
  }
  
s-columns, s-rows, s-body {
  background-color: var(--border-color);
  gap: 1px;
}

::slotted(folk-cell) {
  box-sizing: border-box;
  align-items: center;
  background-color: rgb(255, 255, 255);
  display: flex;
  padding: 0.25rem;
  justify-content: start;
  scroll-snap-align: start;
  overflow: hidden;
}

::slotted(folk-cell[type='number']) {
  justify-content: end;
}

::slotted(folk-cell:focus) {
  outline: 2px solid #1b73e8;
  z-index: 4;
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

export function templateCells(numberOfRows: number, numberOfColumns: number, expressions: Record<string, string>) {
  const cells: string[] = [];
  for (let i = 0; i < numberOfRows; i += 1) {
    for (let j = 0; j < numberOfColumns; j += 1) {
      const column = getColumnName(j);
      const row = i + 1;
      const expression = expressions[`${column}${row}`];
      cells.push(
        `<folk-cell column="${column}" row="${row}" tabindex="0" ${
          expression ? `expression="${expression}"` : ''
        }></folk-cell>`
      );
    }
  }
  return cells.join('\n');
}

declare global {
  interface HTMLElementTagNameMap {
    'folk-spreadsheet': FolkSpreadsheet;
  }
}

export class FolkSpreadsheet extends HTMLElement {
  static tagName = 'folk-spreadsheet';

  static define() {
    FolkSpreadSheetCell.define();
    FolkSpreadsheetHeader.define();
    customElements.define(this.tagName, this);
  }

  #shadow = this.attachShadow({ mode: 'open' });

  #textarea: HTMLTextAreaElement | null = null;

  #editedCell: FolkSpreadSheetCell | null = null;

  constructor() {
    super();

    this.addEventListener('click', this);
    this.addEventListener('dblclick', this);
    this.addEventListener('keydown', this);
    this.addEventListener('focusin', this);
    this.addEventListener('focusout', this);

    this.#shadow.adoptedStyleSheets.push(styles);
  }

  connectedCallback() {
    this.#shadow.textContent = '';

    const columnNames = new Set();
    const rowNames = new Set();

    const cells = this.querySelectorAll('folk-cell');

    cells.forEach((cell) => {
      columnNames.add(cell.column);
      rowNames.add(cell.row);
    });

    const columns = Array.from({ length: columnNames.size }).map((_, i) => getColumnName(i));
    const rows = Array.from({ length: rowNames.size }).map((_, i) => i + 1);

    const columnHeaders = columns.map((column) => `<s-header column="${column}">${column}</s-header>`).join('\n');
    const rowHeaders = rows.map((row) => `<s-header row="${row}">${row}</s-header>`).join('\n');

    const style = `<style>
      ${columns
        .map(
          (column) =>
            `s-header[column="${column}"], ::slotted(folk-cell[column="${column}"]) { grid-column: ${
              getColumnIndex(column) + 1
            }; }`
        )
        .join('\n')}
      ${rows
        .map((row) => `s-header[row="${row}"], ::slotted(folk-cell[row="${row}"]) { grid-row: ${row}; }`)
        .join('\n')}
    </style>`;

    this.#shadow.innerHTML = `
      <s-header empty></s-header>
      <s-columns>${columnHeaders}</s-columns>
      <s-rows>${rowHeaders}</s-rows>
      <s-body><slot></slot></s-body>
      <textarea hidden></textarea>
      ${style}
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

  getCell(column: string, row: number | string): FolkSpreadSheetCell | null {
    return this.querySelector(`folk-cell[column="${column}"][row="${row}"]`);
  }

  handleEvent(event: Event) {
    switch (event.type) {
      case 'keydown': {
        if (!(event instanceof KeyboardEvent)) return;

        const { target } = event;

        if (target instanceof FolkSpreadSheetCell) {
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
        if (event.target instanceof FolkSpreadSheetCell) {
          this.#focusTextarea(event.target);
        }
        return;
      }
      case 'focusin': {
        if (event.target instanceof FolkSpreadSheetCell) {
          this.#getHeader('column', event.target.column).selected = true;
          this.#getHeader('row', event.target.row).selected = true;
          this.range = event.target.name;
        }

        return;
      }
      case 'focusout': {
        if (event.target instanceof FolkSpreadSheetCell) {
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

  #getHeader(type: 'row' | 'column', value: string | number): FolkSpreadsheetHeader {
    return this.#shadow.querySelector(`s-header[${type}="${value}"]`)!;
  }

  #focusTextarea(cell: FolkSpreadSheetCell) {
    if (this.#textarea === null) return;
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
    if (this.#textarea === null) return;
    this.#textarea.style.setProperty('--text-column', '0');
    this.#textarea.style.setProperty('--text-row', '0');
    this.#editedCell.expression = this.#textarea.value;
    this.#textarea.value = '';
    this.#editedCell.focus();
    this.#textarea.hidden = true;
    this.#editedCell = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    's-header': FolkSpreadsheetHeader;
  }
}

export class FolkSpreadsheetHeader extends HTMLElement {
  static tagName = 's-header';

  static define() {
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

declare global {
  interface HTMLElementTagNameMap {
    'folk-cell': FolkSpreadSheetCell;
  }
}

export class FolkSpreadSheetCell extends HTMLElement {
  static tagName = 'folk-cell';

  static define() {
    customElements.define(this.tagName, this);
  }

  connectedCallback() {
    // this should run after all of the other cells have run
    this.expression = this.getAttribute('expression') || '';

    if (this.tabIndex === -1) {
      this.tabIndex = 0;
    }
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

  #dependencies: ReadonlyArray<FolkSpreadSheetCell> = [];

  get dependencies() {
    return this.#dependencies;
  }

  #function = new Function();

  get expression() {
    return this.#expression;
  }
  set expression(expression) {
    expression = String(expression).trim();
    this.#expression = expression;

    this.#dependencies.forEach((dep) => dep.removeEventListener('propagate', this));

    if (expression === '') return;

    if (!expression.includes('return ')) {
      expression = `return ${expression}`;
    }

    const argNames: string[] = expression.match(/\$[A-Z]+\d+/g) ?? [];

    this.#dependencies = Object.freeze(
      argNames
        .map((dep) => {
          const [, column, row] = dep.split(/([A-Z]+)(\d+)/s);
          return this.#getCell(column, row);
        })
        .filter((cell) => cell !== null)
    );

    this.#dependencies.forEach((dep) => dep.addEventListener('propagate', this));

    this.#function = new Function(...argNames, expression);

    this.#evaluate();
  }

  #value: any;
  get value() {
    return this.#value;
  }

  #getCell(column: string, row: number | string): FolkSpreadSheetCell | null {
    return this.parentElement!.querySelector(`folk-cell[column="${column}"][row="${row}"]`);
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

      this.#value = value;
      this.textContent = value.toString();
      this.dispatchEvent(new Event('propagate'));
      this.setAttribute('type', typeof value);
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

if (!customElements.get('folk-cell')) {
  FolkSpreadSheetCell.define();
}
