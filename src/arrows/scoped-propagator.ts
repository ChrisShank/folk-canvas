import { AbstractArrow } from './abstract-arrow';

export class ScopedPropagator extends AbstractArrow {
  static tagName = 'scoped-propagator';

  render(
    sourceRect: DOMRectReadOnly,
    targetRect: DOMRectReadOnly,
    sourceElement: Element,
    targetElement: Element
  ) {}
}
