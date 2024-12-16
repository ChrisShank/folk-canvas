import { FolkBaseSet } from './folk-base-set.ts';
import { PropertyValues } from '@lit/reactive-element';
import { Layout } from 'webcola';
import { FolkShape } from './folk-shape.ts';
import { AnimationFrameController, AnimationFrameControllerHost } from './common/animation-frame-controller.ts';
import { FolkBaseConnection } from './folk-base-connection';

export class FolkGraph extends FolkBaseSet implements AnimationFrameControllerHost {
  static override tagName = 'folk-graph';

  private graphSim = new Layout();
  private nodes = new Map<FolkShape, number>();
  private arrows = new Set<FolkBaseConnection>();
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

  tick() {
    // TODO: figure out how to let cola continue running. I was never able to do that in the past...
    this.graphSim.start(1, 0, 0, 0, true, false);

    this.graphSim.nodes().forEach((node: any) => {
      const shape = node.id;
      if (shape === document.activeElement) {
        const rect = shape.getTransformDOMRect();
        node.x = rect.center.x;
        node.y = rect.center.y;
      } else {
        shape.x = node.x - shape.width / 2;
        shape.y = node.y - shape.height / 2;
      }
    });
  }

  private createGraph() {
    this.nodes.clear();
    this.arrows.clear();

    const colaNodes = this.createNodes();
    const colaLinks = this.createLinks();

    console.log(colaNodes, colaLinks);

    this.graphSim.nodes(colaNodes).links(colaLinks).linkDistance(250).avoidOverlaps(true).handleDisconnected(true);
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
