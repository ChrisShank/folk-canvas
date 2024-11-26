import { FolkGeometry } from '../canvas/fc-geometry';
import { ClientRectObserverManager, ClientRectObserverEntry } from './visual-observer.ts';

interface ObservedElementEntry {
  selector: string;
  element: Element;
  count: number;
}

class ObservedElements {
  #elements: ObservedElementEntry[] = [];

  observe(selector: string) {
    let entry = this.#elements.find((e) => e.selector === selector);

    if (entry === undefined) {
      entry = { selector, element: document.querySelector(selector)!, count: 0 };
      this.#elements.push(entry);
    }

    entry.count += 1;

    return entry.element;
  }

  unobserve(selector: string) {
    const entryIndex = this.#elements.findIndex((e) => e.selector === selector);
    const entry = this.#elements[entryIndex];

    if (entry === undefined) return;

    entry.count -= 1;

    if (entry.count === 0) {
      this.#elements.splice(entryIndex, 1);
    }
  }

  getElement(selector) {
    return this.#elements.find((e) => e.selector === selector)?.element;
  }

  getSelector(element: Element) {
    return this.#elements.find((e) => e.element === element)?.selector;
  }
}

// If this page is framed in then mock inject the following post message script
if (window.parent !== window) {
  // keep track of count of elements being observed
  const observedElements = new Map();
  const observedSelectors = new Map();

  function boundingBoxCallback(entry: ClientRectObserverEntry) {}

  function onGeometryChange(event) {
    window.parent.postMessage({
      type: 'folk-element-change',
      selector: observedSelectors.get(event.target),
      boundingBox: event.target.getClientRect(),
    });
  }

  window.addEventListener('message', (event) => {
    switch (event.data.type) {
      case 'folk-observe-element': {
        const selector = event.data.selector;
        const element = document.querySelector(selector);

        if (element === null) return;

        observedElements.set(selector, element);
        observedSelectors.set(element, selector);

        if (element instanceof FolkGeometry) {
          element.addEventListener('move', onGeometryChange);
          element.addEventListener('resize', onGeometryChange);

          window.parent.postMessage({
            type: 'folk-element-change',
            selector: selector,
            boundingBox: element.getClientRect(),
          });
        } else {
          // use BoundingBoxObserver
        }
        return;
      }
      case 'folk-unobserve-element': {
        const selector = event.data.selector;
        const element = observedElements.get(selector);

        if (element === undefined) return;

        if (element instanceof FolkGeometry) {
          element.removeEventListener('move', onGeometryChange);
          element.removeEventListener('resize', onGeometryChange);
          observedElements.delete(selector);
          observedSelectors.delete(element);
        } else {
        }

        return;
      }
    }
  });

  window.parent.postMessage({
    type: 'folk-iframe-ready',
  });
}
