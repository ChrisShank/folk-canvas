import { collisionDetection } from './collision';
import { FolkHull } from './folk-hull';
import { FolkGeometry } from './canvas/fc-geometry.ts';

// TODO dont hard code this
const PROXIMITY = 50;

declare global {
  interface HTMLElementTagNameMap {
    'folk-cluster': FolkCluster;
    'folk-proximity': FolkProximity;
  }
}

export class FolkCluster extends FolkHull {
  static tagName = 'folk-cluster';

  #data = new Map();

  isElementInCluster(element: FolkGeometry) {
    return this.sourceElements.includes(element);
  }

  isElementInProximity(element: FolkGeometry) {
    for (const el of this.sourceElements as FolkGeometry[]) {
      if (collisionDetection(el.getClientRect(), element.getClientRect(), PROXIMITY)) return true;
    }
    return false;
  }

  addElements(...elements) {
    this.sources = this.sourceElements
      .concat(elements)
      .map((el) => `#${el.id}`)
      .join(', ');
  }

  removeElement(element) {
    this.sources = this.sourceElements
      .filter((el) => el !== element)
      .map((el) => `#${el.id}`)
      .join(', ');
  }
}

export class FolkProximity extends HTMLElement {
  static tagName = 'folk-proximity';

  static register() {
    customElements.define(this.tagName, this);
  }

  #clusters = new Set<FolkCluster>();
  #geometries = Array.from(this.querySelectorAll('fc-geometry'));

  constructor() {
    super();

    this.addEventListener('move', this.#handleProximity);
    this.addEventListener('resize', this.#handleProximity);
    // document.addEventListener('recenter', (e) => {
    //   proximityMap.get(e.target.parentElement)?.forEach((el) => {
    //     const content = el.firstElementChild;
    //     if (content instanceof GeoWiki) {
    //       const { lat, lng } = e.target.coordinates;
    //       content.coordinates = [lat, lng];
    //     }
    //   });
    // });
  }

  #handleProximity = (e) => {
    const el = e.target as FolkGeometry;

    const cluster = this.#findCluster(el);

    if (cluster === null) {
      for (const cluster of this.#clusters) {
        // what if its in proximity to multiple clusters?
        if (cluster.isElementInProximity(el)) {
          cluster.addElements(el);
          return;
        }
      }

      for (const geometry of this.#geometries) {
        if (geometry === el) break;

        if (collisionDetection(geometry.getClientRect(), el.getClientRect(), PROXIMITY)) {
          const cluster = document.createElement('folk-cluster');
          cluster.addElements(geometry, el);
          this.#clusters.add(cluster);
          this.appendChild(cluster);
          return;
        }
      }
    } else {
      const isInCluster = (cluster.sourceElements as FolkGeometry[])
        .filter((element) => el !== element)
        .some((element) => collisionDetection(el.getClientRect(), element.getClientRect(), PROXIMITY));

      if (!isInCluster) {
        cluster.removeElement(el);

        if (cluster.sourcesMap.size === 1) {
          this.#clusters.delete(cluster);
          cluster.remove();
        }
      }
    }
  };

  #findCluster(element) {
    for (const cluster of this.#clusters) {
      if (cluster.isElementInCluster(element)) return cluster;
    }
    return null;
  }
}
