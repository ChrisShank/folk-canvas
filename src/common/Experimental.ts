export class Experimental {
  static canMoveBefore() {
    const enabled = !!(Element.prototype as any).moveBefore;
    if (!enabled) {
      console.warn('moveBefore() API requires Chrome Canary with chrome://flags/#atomic-move enabled');
      alert('moveBefore() API requires Chrome Canary with chrome://flags/#atomic-move enabled');
    }
    return enabled;
  }
}
