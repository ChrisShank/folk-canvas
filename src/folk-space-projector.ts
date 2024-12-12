import { css, PropertyValues } from '@lit/reactive-element';
import { FolkBaseSet } from './folk-base-set';
import { FolkShape } from './folk-shape';
import { FolkSpreadsheet, FolkSpreadSheetCell, templateCells } from './folk-spreadsheet';
import { DOMRectTransform } from './common/DOMRectTransform';

FolkShape.define();
FolkSpreadsheet.define();

export class FolkSpaceProjector extends FolkBaseSet {
  static override tagName = 'folk-space-projector';

  static override styles = [
    FolkBaseSet.styles,
    css`
      folk-spreadsheet {
        position: absolute;
        bottom: 5px;
        right: 5px;
        pointer-events: auto;
      }
    `,
  ];

  #spreadsheet = document.createElement('folk-spreadsheet');

  override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this.#spreadsheet.style.setProperty('--cell-width', '50px');

    this.renderRoot.append(this.#spreadsheet);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#spreadsheet.addEventListener('propagate', this.#onPropagate);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#spreadsheet.removeEventListener('propagate', this.#onPropagate);
  }

  #lock = false;

  #onPropagate = (event: Event) => {
    if (this.#lock) return;

    const cell = event.target as FolkSpreadSheetCell;

    const shape = this.sourceElements
      .values()
      .drop(cell.row - 1)
      .find(() => true);

    if (!(shape instanceof FolkShape)) return;

    // beware of infinite event loop
    switch (cell.column) {
      case 'A': {
        shape.x = cell.value;
        return;
      }
      case 'B': {
        shape.y = cell.value;
        return;
      }
      case 'C': {
        shape.width = cell.value;
        return;
      }
      case 'D': {
        shape.height = cell.value;
        return;
      }
      case 'E': {
        shape.rotation = (cell.value * Math.PI) / 180;
        return;
      }
    }
  };

  override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has('sourceElements')) {
      const cells = templateCells(this.sourceElements.size, 5, {});
      this.#spreadsheet.setHTMLUnsafe(cells);
    }

    if (this.sourcesMap.size !== this.sourceElements.size) return;

    this.#lock = true;
    const rects = this.sourceRects;
    for (let i = 0; i < rects.length; i += 1) {
      const row = i + 1;
      const rect = rects[i];
      if (rect instanceof DOMRectTransform) {
        const { x, y } = rect.toParentSpace(rect.topLeft);
        this.#spreadsheet.getCell('A', row)!.expression = Math.round(x);
        this.#spreadsheet.getCell('B', row)!.expression = Math.round(y);
        this.#spreadsheet.getCell('C', row)!.expression = Math.round(rect.width);
        this.#spreadsheet.getCell('D', row)!.expression = Math.round(rect.height);
        this.#spreadsheet.getCell('E', row)!.expression = Math.round((rect.rotation * 180) / Math.PI);
      } else {
        this.#spreadsheet.getCell('A', row)!.expression = Math.round(rect.x);
        this.#spreadsheet.getCell('B', row)!.expression = Math.round(rect.y);
        this.#spreadsheet.getCell('C', row)!.expression = Math.round(rect.width);
        this.#spreadsheet.getCell('D', row)!.expression = Math.round(rect.height);
      }
    }
    Promise.resolve().then(() => {
      this.#lock = false;
    });
  }
}
