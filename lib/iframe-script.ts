// this needs to move to the web extension once that's set up.

import { ClientRectObserverEntry } from './client-rect-observer.ts';
import { FolkObserver } from './folk-observer.ts';

const folkObserver = new FolkObserver();

// If this page is framed in then mock inject the following post message script
if (window.parent !== window) {
  // keep track of count of elements being observed
  const observedElements = new Map();
  const observedSelectors = new Map();

  function boundingBoxCallback(entry: ClientRectObserverEntry) {
    window.parent.postMessage({
      type: 'folk-element-change',
      selector: observedSelectors.get(entry.target),
      contentRect: entry.contentRect.toJSON(),
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

        folkObserver.observe(element, boundingBoxCallback);
        return;
      }
      case 'folk-unobserve-element': {
        const selector = event.data.selector;
        const element = observedElements.get(selector);

        if (element === undefined) return;

        folkObserver.unobserve(element, boundingBoxCallback);
      }
    }
  });

  window.parent.postMessage({
    type: 'folk-iframe-ready',
  });
}
