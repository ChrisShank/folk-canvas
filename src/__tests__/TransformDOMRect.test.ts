import { expect, test, describe } from 'bun:test';
import { TransformDOMRect, TransformDOMRectReadonly } from '../common/TransformDOMRect';
import { Point } from '../common/types';

// Helper for comparing points with floating point values
const expectPointClose = (actual: Point, expected: Point) => {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
};

describe('TransformDOMRect', () => {
  test('constructor initializes with default values', () => {
    const rect = new TransformDOMRect();
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
    expect(rect.rotation).toBe(0);
  });

  test('constructor initializes with provided values', () => {
    const rect = new TransformDOMRect({
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

  test('DOMRect properties are calculated correctly', () => {
    const rect = new TransformDOMRect({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
    expect(rect.left).toBe(10);
    expect(rect.top).toBe(20);
    expect(rect.right).toBe(110);
    expect(rect.bottom).toBe(70);
  });

  test('vertices returns correct local space corners', () => {
    const rect = new TransformDOMRect({
      width: 100,
      height: 50,
    });

    const vertices = rect.vertices();
    expectPointClose(vertices[0], { x: 0, y: 0 });
    expectPointClose(vertices[1], { x: 100, y: 0 });
    expectPointClose(vertices[2], { x: 100, y: 50 });
    expectPointClose(vertices[3], { x: 0, y: 50 });
  });

  test('coordinate space conversion with rotation', () => {
    const rect = new TransformDOMRect({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: Math.PI / 2, // 90 degrees
    });

    const parentPoint = { x: 10, y: 20 };
    const localPoint = rect.toLocalSpace(parentPoint);
    const backToParent = rect.toParentSpace(localPoint);

    expectPointClose(backToParent, parentPoint);
  });

  test('getBounds returns correct bounding box after rotation', () => {
    const rect = new TransformDOMRect({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: Math.PI / 2, // 90 degrees
    });

    const bounds = rect.getBounds();
    expect(bounds.width).toBeCloseTo(50);
    expect(bounds.height).toBeCloseTo(100);
  });

  test('setters update matrices correctly', () => {
    const rect = new TransformDOMRect();
    rect.x = 10;
    rect.y = 20;
    rect.width = 100;
    rect.height = 50;
    rect.rotation = Math.PI / 4;

    const point = { x: 0, y: 0 };
    const transformed = rect.toParentSpace(point);
    const backToLocal = rect.toLocalSpace(transformed);

    expectPointClose(backToLocal, point);
  });

  test('coordinate transformations with rotation and translation', () => {
    const rect = new TransformDOMRect({
      x: 100,
      y: 100,
      width: 200,
      height: 100,
      rotation: Math.PI / 4, // 45 degrees
    });

    // Test multiple points
    const testPoints = [
      { x: -100, y: 100 }, // Origin point
      { x: 200, y: 150 }, // Middle point
      { x: 300, y: 200 }, // Far point
    ];

    testPoints.forEach((point) => {
      const localPoint = rect.toLocalSpace(point);
      const backToParent = rect.toParentSpace(localPoint);
      expectPointClose(backToParent, point);
    });
  });

  describe('corner setters', () => {
    test('setTopLeft maintains rectangle properties', () => {
      const rect = new TransformDOMRect({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      });

      rect.setTopLeft({ x: 50, y: 50 });
      expect(rect.x).toBe(50);
      expect(rect.y).toBe(50);
      expect(rect.width).toBe(250); // Increased by 50
      expect(rect.height).toBe(150); // Increased by 50
    });

    test('setTopRight maintains rectangle properties', () => {
      const rect = new TransformDOMRect({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      });

      rect.setTopRight({ x: 350, y: 50 });
      expect(rect.x).toBe(100);
      expect(rect.y).toBe(50);
      expect(rect.width).toBe(350);
      expect(rect.height).toBe(150);
    });

    test('setBottomRight maintains rectangle properties', () => {
      const rect = new TransformDOMRect({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      });

      rect.setBottomRight({ x: 350, y: 250 });
      expect(rect.x).toBe(100);
      expect(rect.y).toBe(100);
      expect(rect.width).toBe(350);
      expect(rect.height).toBe(250);
    });

    test('setBottomLeft maintains rectangle properties', () => {
      const rect = new TransformDOMRect({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
      });

      rect.setBottomLeft({ x: 50, y: 250 });
      expect(rect.x).toBe(50);
      expect(rect.y).toBe(100);
      expect(rect.width).toBe(250);
      expect(rect.height).toBe(250);
    });

    test('corner setters work with rotation', () => {
      const rect = new TransformDOMRect({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        rotation: Math.PI / 4, // 45 degrees
      });

      const newTopLeft = rect.toParentSpace({ x: 0, y: 0 });
      rect.setTopLeft(newTopLeft);

      const transformedTopLeft = rect.toLocalSpace(newTopLeft);
      expectPointClose(transformedTopLeft, { x: 0, y: 0 });
    });

    test('setBottomRight works with upside down rotation', () => {
      const rect = new TransformDOMRect({
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        rotation: Math.PI, // 180 degrees - upside down
      });

      rect.setBottomRight({ x: 350, y: 250 });
      expect(rect.x).toBe(100);
      expect(rect.y).toBe(100);
      expect(rect.width).toBe(250);
      expect(rect.height).toBe(150);

      // Verify the corner is actually at the expected position
      const transformedBottomRight = rect.toParentSpace(rect.bottomRight);
      expectPointClose(transformedBottomRight, { x: 350, y: 250 });
    });
  });
});

describe('TransformDOMRectReadonly', () => {
  test('prevents modifications through setters', () => {
    const rect = new TransformDOMRectReadonly({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    expect(() => {
      rect.x = 20;
    }).toThrow();
    expect(() => {
      rect.y = 30;
    }).toThrow();
    expect(() => {
      rect.width = 200;
    }).toThrow();
    expect(() => {
      rect.height = 100;
    }).toThrow();
    expect(() => {
      rect.rotation = Math.PI;
    }).toThrow();
  });

  test('allows reading properties', () => {
    const rect = new TransformDOMRectReadonly({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(50);
  });
});

describe('Performance Tests', () => {
  test('matrix operations performance', () => {
    const rect = new TransformDOMRect({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: Math.PI / 4,
    });
    const point = { x: 25, y: 25 };

    measurePerformance('toLocalSpace()', 1_000_000, () => {
      rect.toLocalSpace(point);
    });

    measurePerformance('toParentSpace()', 1_000_000, () => {
      rect.toParentSpace(point);
    });
  });

  test('vertices calculation performance', () => {
    const rect = new TransformDOMRect({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: Math.PI / 6,
    });

    measurePerformance('getBounds()', 1_000_000, () => {
      rect.getBounds();
    });

    measurePerformance('vertices()', 1_000_000, () => {
      rect.vertices();
    });
  });
});

function measurePerformance(label: string, iterations: number, fn: () => void): void {
  const start = Bun.nanoseconds();

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const end = Bun.nanoseconds();
  const timeInNs = end - start;
  const timeInMs = timeInNs / 1_000_000;
  const opsPerMs = iterations / timeInMs;

  const formattedSpeed = opsPerMs.toFixed(2);

  console.log('    \x1b[36m%s\x1b[0m \x1b[1m%s\x1b[0m \x1b[33m%s\x1b[0m', `${label}:`, formattedSpeed, 'ops/ms');
}
