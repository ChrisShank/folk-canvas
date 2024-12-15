import { FolkShape } from './folk-shape';

export abstract class FolkInteractionHandler extends HTMLElement {
  abstract readonly events: string[];
  abstract handleEvent(event: Event): void;

  static toolbar: FolkToolset | null = null;

  protected button: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      button {
        padding: 8px 16px;
        border: 2px solid transparent;
        cursor: pointer;
      }
      :host(.active) button {
        background-color: #00aaff;
        outline: none;
      }
    `;

    this.button = document.createElement('button');
    this.shadowRoot!.appendChild(style);
    this.shadowRoot!.appendChild(this.button);
    this.button.addEventListener('click', () => this.activate());
  }

  activate() {
    console.log('activate', this);
    FolkToolset.setActiveTool(this);
  }
}

export class FolkShapeTool extends FolkInteractionHandler {
  static tagName = 'folk-shape-tool';
  readonly events = ['pointerdown'];

  constructor() {
    super();
    this.button.textContent = 'Create Shape';
  }

  handleEvent(event: Event): void {
    if (!(event instanceof PointerEvent)) return;
    const target = event.target as HTMLElement;
    if (!target || target instanceof FolkShape) return;

    event.stopImmediatePropagation();

    const shape = new FolkShape();
    const rect = target.getBoundingClientRect();
    const width = 100;
    const height = 100;
    shape.x = event.clientX - rect.left - width / 2;
    shape.y = event.clientY - rect.top - height / 2;
    shape.width = width;
    shape.height = height;

    target.appendChild(shape);
    shape.focus();
  }

  static define() {
    if (!customElements.get(this.tagName)) {
      customElements.define(this.tagName, this);
    }
  }
}

export class FolkDeleteTool extends FolkInteractionHandler {
  static tagName = 'folk-delete-tool';
  readonly events = ['pointerdown'];

  constructor() {
    super();
    this.button.textContent = 'Delete';
  }

  handleEvent(event: Event): void {
    if (!(event instanceof PointerEvent)) return;
    const target = event.target as HTMLElement;
    if (!target || !(target instanceof FolkShape)) return;
    event.stopImmediatePropagation();
    target.remove();
  }

  static define() {
    if (!customElements.get(this.tagName)) {
      customElements.define(this.tagName, this);
    }
  }
}

export class FolkToolset extends HTMLElement {
  static tagName = 'folk-toolset';
  private static instance: FolkToolset | null = null;
  private currentHandler: ((event: Event) => void) | null = null;
  private activeTool: FolkInteractionHandler | null = null;

  static setActiveTool(tool: FolkInteractionHandler) {
    if (this.instance) {
      this.instance.activateTool(tool);
    }
  }

  constructor() {
    super();
    FolkToolset.instance = this;
  }

  private activateTool(tool: FolkInteractionHandler) {
    // Remove active class from previous tool
    if (this.activeTool) {
      this.activeTool.classList.remove('active');
    }

    // Deactivate current handler
    if (this.currentHandler) {
      tool.events.forEach((event) => {
        this.removeEventListener(event, this.currentHandler!, true);
      });
    }

    // If clicking same tool, just deactivate
    if (this.currentHandler === tool.handleEvent.bind(tool)) {
      this.currentHandler = null;
      this.activeTool = null;
      return;
    }

    // Activate new handler
    this.currentHandler = tool.handleEvent.bind(tool);
    tool.events.forEach((event) => {
      this.addEventListener(event, this.currentHandler!, true);
    });

    // Add active class to new tool
    tool.classList.add('active');
    this.activeTool = tool;
  }

  static define() {
    if (!customElements.get(this.tagName)) {
      customElements.define(this.tagName, this);
    }
  }
}

FolkShapeTool.define();
FolkDeleteTool.define();
FolkToolset.define();
