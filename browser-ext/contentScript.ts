import browser from 'webextension-polyfill';
import { FolkShape } from '../src/folk-shape';

// Define the custom element with its proper tag name
customElements.define('folk-shape', FolkShape);

browser.runtime.onMessage.addListener((message: any) => {
  if (message.action === 'insertFolkCanvas') {
    // Append a 'folk-canvas' div to the document body
    const folkCanvas = document.createElement('div');
    folkCanvas.className = 'folk-canvas';
    document.body.appendChild(folkCanvas);

    // Create and add a 'folk-shape' element
    const folkShape = document.createElement('folk-shape') as FolkShape;
    folkShape.innerHTML = '<p>Hello, Folk Shape!</p>';
    folkCanvas.appendChild(folkShape);
  }
  return true;
});
