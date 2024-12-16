import { FolkBaseSet } from './folk-base-set.ts';
import { PropertyValues } from '@lit/reactive-element';
import { Layout } from 'webcola';
import { FolkShape } from './folk-shape.ts';
import { FolkArrow } from './folk-arrow.ts';
import { AnimationFrameController, AnimationFrameControllerHost } from './common/animation-frame-controller.ts';

type ColaNode = {
  id: FolkShape;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type ColaLink = {
  source: FolkShape;
  target: FolkShape;
};

export class FolkGraph extends FolkBaseSet implements AnimationFrameControllerHost {
  static override tagName = 'folk-graph';

  private graphSim: Layout;
  private colaNodes: Map<FolkShape, ColaNode> = new Map();
  private colaLinks: Map<FolkArrow, ColaLink> = new Map();
  #rAF = new AnimationFrameController(this);

  constructor() {
    super();
    this.graphSim = new Layout();
  }

  render() {}

  connectedCallback() {
    super.connectedCallback();
    this.#rAF.start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#rAF.stop();
    this.colaNodes.clear();
    this.colaLinks.clear();
  }

  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);
    this.updateGraph();
  }

  tick() {
    this.graphSim.start(1, 0, 0, 0, true, false);

    for (const node of this.graphSim.nodes() as ColaNode[]) {
      const shape = node.id;
      if (shape !== document.activeElement) {
        shape.x = node.x - shape.width / 2;
        shape.y = node.y - shape.height / 2;
      } else {
        const rect = shape.getTransformDOMRect();
        node.x = rect.center.x;
        node.y = rect.center.y;
      }
    }
  }

  private updateGraph() {
    this.colaNodes.clear();
    this.colaLinks.clear();

    // Create nodes for shapes
    for (const element of this.sourceElements) {
      if (!(element instanceof FolkShape)) continue;
      const rect = element.getTransformDOMRect();

      const node: ColaNode = {
        id: element,
        x: rect.center.x,
        y: rect.center.y,
        width: rect.width,
        height: rect.height,
        rotation: rect.rotation,
      };
      this.colaNodes.set(element, node);
    }

    // Create links from arrows
    const arrows = Array.from(this.sourceElements).filter(
      (element): element is FolkArrow => element instanceof FolkArrow
    );

    for (const arrow of arrows) {
      const source = arrow.sourceElement as FolkShape;
      const target = arrow.targetElement as FolkShape;
      if (!source || !target) continue;
      if (!this.colaNodes.has(source) || !this.colaNodes.has(target)) continue;

      const link: ColaLink = {
        source,
        target,
      };
      this.colaLinks.set(arrow, link);
    }

    const nodes = [...this.colaNodes.values()];
    const nodeIdToIndex = new Map(nodes.map((n, i) => [n.id, i]));

    const links = Array.from(this.colaLinks.values())
      .map((l) => {
        const source = nodeIdToIndex.get(l.source);
        const target = nodeIdToIndex.get(l.target);
        return source !== undefined && target !== undefined ? { source, target } : null;
      })
      .filter((l): l is { source: number; target: number } => l !== null);

    this.graphSim.nodes(nodes).links(links).linkDistance(250).avoidOverlaps(true).handleDisconnected(true);
  }
}
