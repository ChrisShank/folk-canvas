import { FolkGeometry } from '../canvas/fc-geometry';

// If this page is framed in then mock inject the following post message script
if (window.parent !== window) {
  // keep track of count of elements being observed
  const observedElements = new Map();
  const observedSelectors = new Map();

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
