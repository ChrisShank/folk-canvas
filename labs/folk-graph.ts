import { FolkBaseSet } from './folk-base-set.ts';
import { PropertyValues } from '@lit/reactive-element';
import { Layout } from 'webcola';
import { FolkShape } from './folk-shape.ts';
import { AnimationFrameController, AnimationFrameControllerHost, TransformIntegrator } from '@lib';
import { FolkBaseConnection } from './folk-base-connection';

export class FolkGraph extends FolkBaseSet implements AnimationFrameControllerHost {
  static override tagName = 'folk-graph';

  private graphSim = new Layout();
  private nodes = new Map<FolkShape, number>();
  private arrows = new Set<FolkBaseConnection>();
  private integrator = TransformIntegrator.register('graph');
  #rAF = new AnimationFrameController(this);

  connectedCallback() {
    super.connectedCallback();
    this.#rAF.start();
  }

  render() {}

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#rAF.stop();
    this.nodes.clear();
    this.arrows.clear();
  }

  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);
    if (changedProperties.has('sourceElements')) {
      this.createGraph();
    }
  }

  async tick() {
    this.graphSim.start(1, 0, 0, 0, true, false);

    // Yield graph layout effects
    for (const node of this.graphSim.nodes() as any[]) {
      const shape = node.id;
      this.integrator.yield(shape, {
        x: node.x - shape.width / 2,
        y: node.y - shape.height / 2,
        rotation: shape.rotation,
        width: shape.width,
        height: shape.height,
      });
    }

    // Get integrated results and update graph state
    const results = await this.integrator.integrate();
    for (const [shape, result] of results) {
      // TODO: this is a hack to get the node from the graph
      const node = this.graphSim.nodes().find((n: any) => n.id === shape);
      if (node) {
        node.x = result.x + shape.width / 2;
        node.y = result.y + shape.height / 2;
      }
    }
  }

  private createGraph() {
    this.nodes.clear();
    this.arrows.clear();

    const colaNodes = this.createNodes();
    const colaLinks = this.createLinks();

    console.log(colaNodes, colaLinks);

    this.graphSim.nodes(colaNodes).links(colaLinks).linkDistance(150).avoidOverlaps(true).handleDisconnected(true);
  }

  private createNodes() {
    return Array.from(this.sourceElements)
      .filter((element): element is FolkShape => element instanceof FolkShape)
      .map((shape, index) => {
        this.nodes.set(shape, index);
        const rect = shape.getTransformDOMRect();
        return {
          id: shape,
          x: rect.center.x,
          y: rect.center.y,
          width: rect.width,
          height: rect.height,
          rotation: rect.rotation,
        };
      });
  }

  private createLinks() {
    return Array.from(this.sourceElements)
      .filter((element): element is FolkBaseConnection => element instanceof FolkBaseConnection)
      .map((arrow) => {
        this.arrows.add(arrow);
        const source = this.nodes.get(arrow.sourceElement as FolkShape);
        const target = this.nodes.get(arrow.targetElement as FolkShape);
        return source !== undefined && target !== undefined ? { source, target } : null;
      })
      .filter((link): link is { source: number; target: number } => link !== null);
  }
}
