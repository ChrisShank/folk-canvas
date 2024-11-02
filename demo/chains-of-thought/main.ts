import { FolkGeometry } from "../../src/canvas/fc-geometry.ts";
import { FolkConnection } from "../../src/arrows/fc-connection.ts";
import { FileSaver } from "../../src/persistence/file.ts";

declare global {
  interface HTMLElementTagNameMap {
    "fc-thought": FolkThought;
  }
}

class FolkThought extends HTMLElement {
  static tagName = "fc-thought";

  static register() {
    customElements.define(this.tagName, this);
  }

  #deleteButton = this.querySelector(
    'button[name="delete"]'
  ) as HTMLButtonElement;
  #text = this.querySelector('[name="text"]') as HTMLElement;

  #geometry = this.parentElement as FolkGeometry;

  constructor() {
    super();

    this.addEventListener("click", this);
  }

  get text() {
    return this.#text.innerHTML;
  }

  handleEvent(event: PointerEvent): void {
    if (event.type === "click" && event.target === this.#deleteButton) {
      this.#geometry.remove();

      document
        .querySelectorAll(
          `fc-connection[source="fc-geometry[id='${this.#geometry.id}']"], 
          fc-connection[target="fc-geometry[id='${this.#geometry.id}']"]`
        )
        .forEach((el) => el.remove());
    }
  }
}

FolkGeometry.register();
FolkThought.register();
FolkConnection.register();

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
  return document.createRange().createContextualFragment(html)
    .firstElementChild!;
}

function renderThought({ id, x, y, text }: Thought) {
  return html`<fc-geometry id="${id}" x="${x}" y="${y}">
    <fc-thought>
      <div contenteditable="true" name="text">${text}</div>
      <button name="delete">␡</button>
    </fc-thought>
  </fc-geometry>`;
}

function renderConnection({ sourceId, targetId }: Connection) {
  return html`<fc-connection
    source="fc-geometry[id='${sourceId}']"
    target="fc-geometry[id='${targetId}']"
  ></fc-connection>`;
}

function renderChainOfThought({ thoughts, connections }: ChainOfThought) {
  return html`${thoughts.map(renderThought).join("")}${connections
    .map(renderConnection)
    .join("")}`;
}

function parseChainOfThought(): ChainOfThought {
  return {
    thoughts: Array.from(document.querySelectorAll("fc-geometry")).map(
      (el) => ({
        id: el.id,
        text: (el.firstElementChild as FolkThought).text,
        x: el.x,
        y: el.y,
      })
    ),
    connections: Array.from(document.querySelectorAll("fc-connection")).map(
      (el) => ({
        sourceId: (el.sourceElement as FolkGeometry).id,
        targetId: (el.targetElement as FolkGeometry).id,
      })
    ),
  };
}

const openButton = document.querySelector('button[name="open"]')!;
const saveButton = document.querySelector('button[name="save"]')!;
const saveAsButton = document.querySelector('button[name="save-as"]')!;
const main = document.querySelector("main")!;
const fileSaver = new FileSaver(
  "chains-of-thought",
  "json",
  "application/json"
);

main.addEventListener("dblclick", (e) => {
  if (e.target === main) {
    main.appendChild(
      parseHTML(
        renderThought({
          id: String(document.querySelectorAll("fc-thought").length + 1),
          text: "",
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

function saveFile(promptNewFile = false) {
  const file = JSON.stringify(parseChainOfThought(), null, 2);
  fileSaver.save(file, promptNewFile);
}

openButton.addEventListener("click", () => {
  openFile();
});

saveButton.addEventListener("click", () => {
  saveFile();
});

saveAsButton.addEventListener("click", () => {
  saveFile(true);
});

openFile(false);
