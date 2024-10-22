import { SpatialGeometry } from '../../src/canvas/spatial-geometry.ts';
import { SpatialConnection } from '../../src/arrows/spatial-connection.ts';
import { FileSaver } from '../../src/persistence/file.ts';

declare global {
  interface HTMLElementTagNameMap {
    'spatial-thought': SpatialThought;
  }
}

class SpatialThought extends HTMLElement {
  static tagName = 'spatial-thought';

  static register() {
    customElements.define(this.tagName, this);
  }

  constructor() {
    super();

    this.addEventListener('pointerdown', this);
  }

  #textarea = this.querySelector('textarea')!;
  #geometry = this.querySelector('spatial-geometry')!;

  #identifier = this.getAttribute('identifier') || '';
  get identifier() {
    return this.#identifier;
  }
  set identifier(id) {
    this.#identifier = id;
  }

  get text() {
    return this.#textarea.value;
  }
  set text(text) {
    this.#textarea.value = text;
  }

  get x() {
    return this.#geometry.x;
  }
  set x(x) {
    this.#geometry.x = x;
  }

  get y() {
    return this.#geometry.y;
  }

  set y(y) {
    this.#geometry.y = y;
  }

  focusTextArea() {
    this.#textarea.focus();
  }

  handleEvent(event: PointerEvent): void {}
}

SpatialGeometry.register();
SpatialThought.register();
SpatialConnection.register();

interface Thought {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface Connection {
  sourceId: string;
  targetId: string;
}

interface ChainOfThought {
  thoughts: Thought[];
  connections: Connection[];
}

const html = String.raw;

function parseHTML(html: string): Element {
  return document.createRange().createContextualFragment(html).firstElementChild!;
}

function renderThought(thought: Thought) {
  return html`<spatial-geometry x="${thought.x}" y="${thought.y}" width="200" height="100">
    <spatial-thought contenteditable="true" identifier="${thought.id}">${thought.text}</spatial-thought>
  </spatial-geometry>`;
}

function renderConnection({ sourceId, targetId }: Connection) {
  return html`<spatial-connection
    source="spatial-geometry:has(spatial-thought[identifier='${sourceId}'])"
    target="spatial-geometry:has(spatial-thought[identifier='${targetId}'])"
  ></spatial-connection>`;
}

function renderChainOfThought({ thoughts, connections }: ChainOfThought) {
  return html`${thoughts.map(renderThought).join('')}${connections.map(renderConnection).join('')}`;
}

function parseChainOfThought(): ChainOfThought {
  return {
    thoughts: Array.from(document.querySelectorAll('spatial-thought')).map((el) => ({
      id: el.identifier,
      text: el.text,
      x: el.x,
      y: el.y,
    })),
    connections: Array.from(document.querySelectorAll('spatial-connection')).map((el) => ({
      sourceId: (el.sourceElement as SpatialThought).identifier,
      targetId: (el.targetElement as SpatialThought).identifier,
    })),
  };
}

const openButton = document.querySelector('button[name="open"]')!;
const saveButton = document.querySelector('button[name="save"]')!;
const saveAsButton = document.querySelector('button[name="save-as"]')!;
const main = document.querySelector('main')!;
const fileSaver = new FileSaver('chains-of-thought', 'json', 'application/json');

main.addEventListener('dblclick', (e) => {
  if (e.target === main) {
    main.appendChild(
      parseHTML(
        renderThought({
          id: String(document.querySelectorAll('spatial-thought').length + 1),
          text: '',
          x: e.clientX,
          y: e.clientY,
        })
      )
    );
  }
});

async function openFile(showPicker = true) {
  try {
    const text = await fileSaver.open(showPicker);
    const json = JSON.parse(text || '{ "thoughts": [], "connections": [] }');
    main.innerHTML = renderChainOfThought(json);
  } catch (e) {
    // No file handler was persisted or the file is invalid JSON.
    console.error(e);
  }
}

async function saveFile(promptNewFile = false) {
  fileSaver.save(JSON.stringify(parseChainOfThought(), null, 2), promptNewFile);
}

openButton.addEventListener('click', () => {
  openFile();
});

saveButton.addEventListener('click', () => {
  saveFile();
});

saveAsButton.addEventListener('click', () => {
  saveFile(true);
});

openFile(false);
