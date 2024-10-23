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

  #deleteButton = this.querySelector('button[name="delete"]') as HTMLButtonElement;
  #text = this.querySelector('span[name="text"]') as HTMLSpanElement;

  #geometry = this.parentElement as SpatialGeometry;

  constructor() {
    super();

    this.addEventListener('click', this);
  }

  get text() {
    return this.#text.innerText;
  }

  handleEvent(event: PointerEvent): void {
    if (event.type === 'click' && event.target === this.#deleteButton) {
      this.#geometry.remove();
      document
        .querySelectorAll(
          `spatial-connection[source="spatial-geometry[id='${this.#geometry.id}']"], 
          spatial-connection[target="spatial-geometry[id='${this.#geometry.id}']"]`
        )
        .forEach((el) => el.remove());
    }
  }
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

function renderThought({ id, x, y, text }: Thought) {
  return html`<spatial-geometry id="${id}" x="${x}" y="${y}" width="200" height="100">
    <spatial-thought contenteditable="true">
      <span name="text">${text}</span>
      <button name="delete">␡</button>
    </spatial-thought>
  </spatial-geometry>`;
}

function renderConnection({ sourceId, targetId }: Connection) {
  return html`<spatial-connection
    source="spatial-geometry[id='${sourceId}']"
    target="spatial-geometry[id='${targetId}']"
  ></spatial-connection>`;
}

function renderChainOfThought({ thoughts, connections }: ChainOfThought) {
  return html`${thoughts.map(renderThought).join('')}${connections.map(renderConnection).join('')}`;
}

function parseChainOfThought(): ChainOfThought {
  return {
    thoughts: Array.from(document.querySelectorAll('spatial-geometry')).map((el) => ({
      id: el.id,
      text: (el.firstElementChild as SpatialThought).text,
      x: el.x,
      y: el.y,
    })),
    connections: Array.from(document.querySelectorAll('spatial-connection')).map((el) => ({
      sourceId: (el.sourceElement as SpatialGeometry).id,
      targetId: (el.targetElement as SpatialGeometry).id,
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
  const file = JSON.stringify(parseChainOfThought(), null, 2);
  fileSaver.save(file, promptNewFile);
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
