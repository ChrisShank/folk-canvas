export function collisionDetection(rect1: DOMRect, rect2: DOMRect, proximity = 0) {
  return (
    rect1.left - rect2.right < proximity &&
    rect2.left - rect1.right < proximity &&
    rect1.top - rect2.bottom < proximity &&
    rect2.top - rect1.bottom < proximity
  );
}
