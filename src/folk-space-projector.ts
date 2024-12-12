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
      folk-shape {
        pointer-events: auto;
      }
    `,
  ];

  #shape = document.createElement('folk-shape');
  #spreadsheet = document.createElement('folk-spreadsheet');

  override firstUpdated(changedProperties: PropertyValues<this>): void {
    super.firstUpdated(changedProperties);

    this.#shape.appendChild(this.#spreadsheet);

    this.renderRoot.append(this.#shape);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.#spreadsheet.addEventListener('propagate', this.#onPropagate);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#spreadsheet.removeEventListener('propagate', this.#onPropagate);
  }

  #onPropagate = (event: Event) => {
    const cell = event.target as FolkSpreadSheetCell;

    const shape = this.sourceElements
      .values()
      .drop(cell.row)
      .find(() => true);

    if (!(shape instanceof FolkShape)) return;

    // infinite event loop
    // switch (cell.column) {
    //   case 'A': {
    //     shape.x = cell.value;
    //     return;
    //   }
    //   case 'B': {
    //     shape.y = cell.value;
    //     return;
    //   }
    //   case 'C': {
    //     shape.width = cell.value;
    //     return;
    //   }
    //   case 'D': {
    //     shape.height = cell.value;
    //     return;
    //   }
    //   case 'E': {
    //     shape.rotation = cell.value;
    //     return;
    //   }
    // }
  };

  override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);

    if (changedProperties.has('sourceElements')) {
      const cells = templateCells(this.sourceElements.size, 5, {});
      this.#spreadsheet.setHTMLUnsafe(cells);
    }

    if (this.sourcesMap.size !== this.sourceElements.size) return;

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
  }
}
