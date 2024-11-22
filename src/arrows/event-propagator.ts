import { FolkRope } from './fc-rope.ts';

export class EventPropagator extends FolkRope {
  static override tagName = 'event-propagator';

  #triggers = (this.getAttribute('triggers') || '').split(',');
  get triggers() {
    return this.#triggers;
  }
  set triggers(triggers) {
    this.#triggers = triggers;
  }

  #expression = '';
  #function = new Function();
  get expression() {
    return this.#expression;
  }
  set expression(expression) {
    this.#expression = expression;
    this.#function = new Function('$source', '$target', '$event', expression);
  }

  constructor() {
    super();

    this.expression = this.getAttribute('expression') || '';
  }

  override observeSource() {
    super.observeSource();

    for (const trigger of this.#triggers) {
      // TODO: add special triggers for intersection, rAF, etc.
      this.sourceElement?.addEventListener(trigger, this.evaluateExpression);
    }
    //should we evaluate them immediately?
    // this.evaluateExpression();
  }

  override unobserveSource() {
    super.unobserveSource();

    for (const trigger of this.#triggers) {
      // TODO: add special triggers for intersection, rAF, etc.
      this.sourceElement?.removeEventListener(trigger, this.evaluateExpression);
    }
  }

  override observeTarget() {
    super.observeTarget();
    // this.evaluateExpression();
  }

  override unobserveTarget() {
    super.unobserveTarget();
  }

  // Do we need the event at all?
  evaluateExpression = (event?: Event) => {
    if (this.sourceElement === null || this.targetElement === null) return;

    this.#function(this.sourceElement, this.targetElement, event);
  };
}
