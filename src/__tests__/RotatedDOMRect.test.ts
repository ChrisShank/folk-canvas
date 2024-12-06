import { expect, test, describe } from 'bun:test';
import { RotatedDOMRect } from '../common/rotated-dom-rect-2';
import { Vector } from '../common/Vector';

// Helper for comparing points with floating point values
const expectPointClose = (actual: { x: number; y: number }, expected: { x: number; y: number }) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
};

describe('RotatedDOMRect', () => {
  describe('constructor', () => {
    test('initializes with default values', () => {
      const rect = new RotatedDOMRect();
      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(0);
      expect(rect.height).toBe(0);
      expect(rect.rotation).toBe(0);
    });

    test('initializes with custom values', () => {
      const rect = new RotatedDOMRect({
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: Math.PI / 4,
      });
      expect(rect.x).toBe(10);
      expect(rect.y).toBe(20);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(50);
      expect(rect.rotation).toBe(Math.PI / 4);
    });
  });

  describe('corner calculations', () => {
    test('calculates corners for unrotated rectangle', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
      });

      expectPointClose(rect.topLeft, { x: -50, y: -25 });
      expectPointClose(rect.topRight, { x: 50, y: -25 });
      expectPointClose(rect.bottomLeft, { x: -50, y: 25 });
      expectPointClose(rect.bottomRight, { x: 50, y: 25 });
    });

    test('calculates corners for 90-degree rotated rectangle', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: Math.PI / 2,
      });

      expectPointClose(rect.topLeft, { x: 50, y: -50 });
      expectPointClose(rect.topRight, { x: 50, y: 50 });
      expectPointClose(rect.bottomLeft, { x: -50, y: -50 });
      expectPointClose(rect.bottomRight, { x: -50, y: 50 });
    });
  });

  describe('bounds', () => {
    test('calculates bounds for unrotated rectangle', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
      });

      expect(rect.getBounds()).toEqual({
        x: -50,
        y: -25,
        width: 100,
        height: 50,
      });
    });

    test('calculates bounds for 45-degree rotated rectangle', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: Math.PI / 4,
      });

      const bounds = rect.getBounds();
      const cos45 = Math.cos(Math.PI / 4);
      const sin45 = Math.sin(Math.PI / 4);
      const expectedWidth = Math.abs(100 * cos45) + Math.abs(50 * sin45);
      const expectedHeight = Math.abs(100 * sin45) + Math.abs(50 * cos45);

      expect(bounds.width).toBeCloseTo(expectedWidth);
      expect(bounds.height).toBeCloseTo(expectedHeight);
      expect(bounds.x).toBeCloseTo(-expectedWidth / 2);
      expect(bounds.y).toBeCloseTo(-expectedHeight / 2);
    });
  });

  describe('setters', () => {
    test('updates corners when center is modified', () => {
      const rect = new RotatedDOMRect({
        width: 100,
        height: 50,
      });

      rect.center = { x: 100, y: 100 };
      expectPointClose(rect.topLeft, { x: 50, y: 75 });
      expectPointClose(rect.bottomRight, { x: 150, y: 125 });
    });

    test('updates dimensions and rotation when setting topRight', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });

      expect(rect.width).toBe(100);
      expect(rect.height).toBe(50);
      expect(rect.rotation).toBe(0);
      expectPointClose(rect.bottomLeft, { x: -50, y: 25 });
      expectPointClose(rect.bottomRight, { x: 50, y: 25 });
      expectPointClose(rect.center, { x: 0, y: 0 });
      expectPointClose(rect.topLeft, { x: -50, y: -25 });

      expectPointClose(rect.topRight, { x: 50, y: -25 });
      rect.topRight = { x: 100, y: -50 };
      expect(rect.width).toBe(150);
    });
  });

  describe('corner setters', () => {
    test('updates dimensions when setting bottomLeft', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      });

      // Store original topRight position as it should remain fixed
      const originalTopRight = { ...rect.topRight }; // (50, -25)

      // Set new bottomLeft position
      rect.bottomLeft = { x: -100, y: 100 };

      // Verify topRight hasn't moved
      expectPointClose(rect.topRight, originalTopRight);

      // Verify bottomLeft is at new position
      expectPointClose(rect.bottomLeft, { x: -100, y: 100 });

      // Verify center is halfway between bottomLeft and topRight
      expectPointClose(rect.center, {
        x: (-100 + 50) / 2, // -25
        y: (100 + -25) / 2, // 37.5
      });

      // Verify new dimensions
      expect(rect.width).toBeCloseTo(150); // abs(-100 - 50) = 150
      expect(rect.height).toBeCloseTo(125); // abs(100 - -25) = 125
    });

    test('maintains rectangle properties when setting corners', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: Math.PI / 6,
      });

      rect.bottomRight = { x: 75, y: 75 };

      // After setting bottomRight, topLeft and bottomRight should be equidistant from center
      const distanceToTopLeft = Vector.distance(rect.center, rect.topLeft);
      const distanceToBottomRight = Vector.distance(rect.center, rect.bottomRight);
      expect(distanceToTopLeft).toBeCloseTo(distanceToBottomRight);
    });

    test('setting topLeft updates rectangle correctly', () => {
      const rect = new RotatedDOMRect({
        x: 50,
        y: 50,
        width: 100,
        height: 100,
        rotation: 0,
      });

      const originalBottomRight = { ...rect.bottomRight };

      rect.topLeft = { x: 30, y: 30 };

      // The bottomRight corner should remain the same
      expectPointClose(rect.bottomRight, originalBottomRight);

      // The center should be halfway between the new topLeft and the original bottomRight
      expectPointClose(rect.center, {
        x: (30 + originalBottomRight.x) / 2,
        y: (30 + originalBottomRight.y) / 2,
      });

      // The width and height should be updated accordingly
      expect(rect.width).toBeCloseTo(originalBottomRight.x - 30);
      expect(rect.height).toBeCloseTo(originalBottomRight.y - 30);

      // Verify updated topLeft
      expectPointClose(rect.topLeft, { x: 30, y: 30 });
    });

    test('setting corners with negative widths and heights', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        rotation: 0,
      });

      const originalBottomRight = { ...rect.bottomRight };

      // Move topLeft beyond bottomRight to create negative width and height
      rect.topLeft = { x: 100, y: 100 };

      // The bottomRight corner should remain the same
      expectPointClose(rect.bottomRight, originalBottomRight);

      // Width and height should be negative
      expect(rect.width).toBeLessThan(0);
      expect(rect.height).toBeLessThan(0);

      // Center should be updated accordingly
      expectPointClose(rect.center, {
        x: (100 + originalBottomRight.x) / 2,
        y: (100 + originalBottomRight.y) / 2,
      });
    });

    test('setting corners across axes flips rectangle correctly', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 80,
        height: 60,
        rotation: 0,
      });

      const originalTopLeft = { ...rect.topLeft };
      const originalBottomRight = { ...rect.bottomRight };

      // Move bottomRight to the top left of topLeft, flipping both axes
      rect.bottomRight = { x: -60, y: -40 };

      // The topLeft corner should remain the same
      expectPointClose(rect.topLeft, originalTopLeft);

      // Width and height should be negative
      expect(rect.width).toBeLessThan(0);
      expect(rect.height).toBeLessThan(0);

      // Center should be halfway between the new bottomRight and original topLeft
      expectPointClose(rect.center, {
        x: (originalTopLeft.x + -60) / 2,
        y: (originalTopLeft.y + -40) / 2,
      });
    });

    test('setting corners with rotation crosses zero correctly', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: Math.PI / 2, // 90 degrees
      });

      const originalTopRight = { ...rect.topRight };

      // Move bottomLeft across topRight
      rect.bottomLeft = { x: 60, y: -60 };

      // The topRight corner should remain the same
      expectPointClose(rect.topRight, originalTopRight);

      // Width and height should adjust correctly (may be negative)
      const delta = Vector.sub(originalTopRight, rect.bottomLeft);
      const rotatedDelta = Vector.rotate(delta, -rect.rotation);
      expect(rect.width).toBeCloseTo(rotatedDelta.x);
      expect(rect.height).toBeCloseTo(rotatedDelta.y);

      // Verify updated bottomLeft
      expectPointClose(rect.bottomLeft, { x: 60, y: -60 });
    });

    test('simple resize by moving corner', () => {
      const rect = new RotatedDOMRect({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
      });

      // Initial state verification
      expectPointClose(rect.topLeft, { x: -50, y: -50 });
      expectPointClose(rect.bottomRight, { x: 50, y: 50 });
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(100);

      // Move bottomRight to double the size
      rect.bottomRight = { x: 100, y: 100 };

      // Verify new state
      expectPointClose(rect.topLeft, { x: -50, y: -50 }); // Should stay fixed
      expectPointClose(rect.bottomRight, { x: 100, y: 100 }); // New position
      expect(rect.width).toBeCloseTo(150); // New width should be 150
      expect(rect.height).toBeCloseTo(150); // New height should be 150
      expectPointClose(rect.center, { x: 25, y: 25 }); // Center should move to midpoint
    });
  });

  describe('edge cases', () => {
    test('handles zero dimensions', () => {
      const rect = new RotatedDOMRect({
        x: 10,
        y: 10,
        width: 0,
        height: 0,
        rotation: Math.PI / 4,
      });

      expect(rect.getBounds()).toEqual({
        x: 10,
        y: 10,
        width: 0,
        height: 0,
      });
    });

    test('handles 360-degree rotation', () => {
      const rect = new RotatedDOMRect({
        width: 100,
        height: 50,
        rotation: Math.PI * 2,
      });

      // Should be equivalent to rotation: 0
      expectPointClose(rect.topLeft, { x: -50, y: -25 });
      expectPointClose(rect.topRight, { x: 50, y: -25 });
    });
  });
});
