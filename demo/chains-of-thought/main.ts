import { SpatialGeometry } from '../../src/canvas/spatial-geometry.ts';
import { SpatialConnection } from '../../src/arrows/spatial-connection.ts';
import { FileSaver } from '../../src/persistence/file.ts';

SpatialGeometry.register();
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
  return html` <spatial-geometry data-id="${thought.id}" x="${thought.x}" y="${thought.y}" width="200" height="100">
    <textarea>${thought.text}</textarea>
  </spatial-geometry>`;
}

function renderConnection({ sourceId, targetId }: Connection) {
  return html`<spatial-connection
    source="spatial-geometry[data-id='${sourceId}']"
    target="spatial-geometry[data-id='${targetId}']"
  ></spatial-connection>`;
}

function renderChainOfThought({ thoughts, connections }: ChainOfThought) {
  return html`${thoughts.map(renderThought).join('')}${connections.map(renderConnection).join('')}`;
}

function parseChainOfThought(): ChainOfThought {
  return {
    thoughts: Array.from(document.querySelectorAll('spatial-geometry')).map((el) => ({
      id: el.dataset.id || '',
      text: el.querySelector('textarea')?.value || '',
      x: el.x,
      y: el.y,
    })),
    connections: Array.from(document.querySelectorAll('spatial-connection')).map((el) => ({
      sourceId: (el.sourceElement as SpatialGeometry).dataset.id || '',
      targetId: (el.targetElement as SpatialGeometry).dataset.id || '',
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
    const spatialGeometry = parseHTML(
      renderThought({
        id: String(document.querySelectorAll('spatial-geometry').length + 1),
        text: '',
        x: e.clientX,
        y: e.clientY,
      })
    );
    main.appendChild(spatialGeometry);
    spatialGeometry.querySelector('textarea')?.focus();
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
