/// <reference lib="webworker" />
import { Fields } from './fields.ts';

declare const self: DedicatedWorkerGlobalScope;

// Initialize the Fields instance
let fields: Fields;

// Listen for messages from the main thread
self.onmessage = (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'initialize':
      fields = new Fields(data.resolution);
      break;

    case 'addShape':
      fields.addShape(data.id, data.points, data.color);
      break;

    case 'removeShape':
      fields.removeShape(data.id);
      break;

    case 'updateShape':
      fields.updateShape(data.id, data.points);
      break;

    case 'generateImageData': {
      const imageData = fields.generateImageData();
      // Post the ImageData back to the main thread
      postMessage({ type: 'imageData', imageData }, [imageData.data.buffer]);
      break;
    }

    default:
      console.warn(`Unknown message type: ${type}`);
  }
};
