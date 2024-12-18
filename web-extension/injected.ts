// just checking we can add a simple element (we can)
const testElement = document.createElement('p');
testElement.textContent = 'Hello, TEST!';
document.body.appendChild(testElement);

// Now you can use FolkShape in the page context
const folkShape = document.createElement('folk-shape');
document.body.appendChild(folkShape);

if (typeof customElements !== 'undefined') {
  console.log('defining folk-shape');
  // need to find the right way to bundle this all up and call it at the right time
  // FolkShape.define();
  console.log('importing folk-shape');
  // this also won't work
  // maybe just simply build and bundle it all up, this is probl easiest.
  // import('../../lib/folk-shape').then((m) => m.FolkShape.define());
} else {
  console.warn('CUSTOM ELEMENTS NOT DEFINED');
}
