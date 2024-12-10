import type { TransformEvent } from './src/common/TransformEvent';

declare global {
  interface HTMLElementEventMap {
    transform: TransformEvent;
  }
}
