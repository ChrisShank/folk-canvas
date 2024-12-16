import { DOMRectTransform } from './common/DOMRectTransform.ts';
import { FolkBaseSet } from './folk-base-set.ts';
import { PropertyValues } from '@lit/reactive-element';
import { Layout } from 'webcola';
import { FolkShape } from './folk-shape.ts';
import { FolkArrow } from './folk-arrow.ts';

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

export class FolkGraph extends FolkBaseSet {
  static override tagName = 'folk-graph';

  private graphSim: Layout;
  private animationFrameId?: number;
  private colaNodes: Map<FolkShape, ColaNode> = new Map();
  private colaLinks: Map<FolkArrow, ColaLink> = new Map();

  constructor() {
    super();
    this.graphSim = new Layout();
  }

  connectedCallback() {
    super.connectedCallback();
    this.startSimulation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.colaNodes.clear();
    this.colaLinks.clear();
  }

  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);
    this.updateGraph();
  }

  private updateGraph() {
    // Clear existing nodes and links
    this.colaNodes.clear();
    this.colaLinks.clear();

    // Create nodes for shapes
    for (const element of this.sourceElements) {
      if (!(element instanceof FolkShape)) continue;
      const rect = this.sourcesMap.get(element);
      if (!(rect instanceof DOMRectTransform)) continue;

      const node: ColaNode = {
        id: element,
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
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

  private startSimulation() {
    const step = () => {
      this.graphSim.start(1, 0, 0, 0, true, false);

      for (const node of this.graphSim.nodes() as ColaNode[]) {
        const shape = node.id;
        const rect = this.sourcesMap.get(shape);
        if (!(rect instanceof DOMRectTransform)) continue;

        if (shape !== document.activeElement) {
          shape.x = node.x - rect.width / 2;
          shape.y = node.y - rect.height / 2;
        } else {
          node.x = rect.x + rect.width / 2;
          node.y = rect.y + rect.height / 2;
        }
      }

      this.animationFrameId = requestAnimationFrame(step);
    };

    this.animationFrameId = requestAnimationFrame(step);
  }
}
