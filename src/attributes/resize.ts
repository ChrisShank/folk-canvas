import { CustomAttribute } from './custom-attributes';

export class Resizable extends CustomAttribute {
  // Add resize handlers and CSS variables
  connectedCallback() {
    this.ownerElement.addEventListener('pointerdown', this);
    this.ownerElement.addEventListener('lostpointercapture', this);
    this.ownerElement.addEventListener('touchstart', this);
    this.ownerElement.addEventListener('dragstart', this);
  }

  disconnectedCallback() {
    this.ownerElement.removeEventListener('pointerdown', this);
    this.ownerElement.removeEventListener('lostpointercapture', this);
    this.ownerElement.removeEventListener('touchstart', this);
    this.ownerElement.removeEventListener('dragstart', this);
  }

  handleEvent(event: PointerEvent) {
    switch (event.type) {
      case 'pointerdown': {
        if (event.button !== 0 || event.ctrlKey) return;

        this.ownerElement.addEventListener('pointermove', this);
        this.ownerElement.setPointerCapture(event.pointerId);
        (this.ownerElement as HTMLElement).style.userSelect = 'none';
        return;
      }
      // TODO
      case 'pointermove': {
        return;
      }
      case 'lostpointercapture': {
        (this.ownerElement as HTMLElement).style.userSelect = '';
        this.ownerElement.removeEventListener('pointermove', this);
        return;
      }
      case 'touchstart':
      case 'dragstart': {
        event.preventDefault();
        return;
      }
    }
  }
}
