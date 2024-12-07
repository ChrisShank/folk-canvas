import { FolkShape } from '../folk-shape.ts';
import { ClientRectObserverManager, ClientRectObserverEntry } from './client-rect-observer.ts';

const clientRectObserver = new ClientRectObserverManager();

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

  getElement(selector: string) {
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

  function boundingBoxCallback(entry: ClientRectObserverEntry) {
    window.parent.postMessage({
      type: 'folk-element-change',
      selector: observedSelectors.get(entry.target),
      boundingBox: entry.contentRect,
    });
  }

  function onGeometryChange(event: any) {
    window.parent.postMessage({
      type: 'folk-element-change',
      selector: observedSelectors.get(event.target),
      boundingBox: event.target?.getTransformDOMRect(),
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

        if (element instanceof FolkShape) {
          element.addEventListener('transform', onGeometryChange);

          window.parent.postMessage({
            type: 'folk-element-change',
            selector: selector,
            boundingBox: element.getTransformDOMRect(),
          });
        } else {
          clientRectObserver.observe(element, boundingBoxCallback);
        }
        return;
      }
      case 'folk-unobserve-element': {
        const selector = event.data.selector;
        const element = observedElements.get(selector);

        if (element === undefined) return;

        if (element instanceof FolkShape) {
          element.removeEventListener('transform', onGeometryChange);
          observedElements.delete(selector);
          observedSelectors.delete(element);
        } else {
          clientRectObserver.unobserve(element, boundingBoxCallback);
        }

        return;
      }
    }
  });

  window.parent.postMessage({
    type: 'folk-iframe-ready',
  });
}
