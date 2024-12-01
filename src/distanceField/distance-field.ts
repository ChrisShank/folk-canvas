import type { FolkGeometry } from '../canvas/fc-geometry.ts';
import type { Vector2 } from '../utils/Vector2.ts';

export class DistanceField extends HTMLElement {
  static tagName = 'distance-field';

  static define() {
    customElements.define(this.tagName, this);
  }

  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private resolution: number;
  private imageSmoothing: boolean;
  private worker!: Worker;
  private geometryShapeIds: Map<HTMLElement, string> = new Map();

  // Get all geometry elements
  private geometries = document.querySelectorAll('fc-geometry');

  constructor() {
    super();

    this.resolution = 800; // default resolution
    this.imageSmoothing = true;

    const { ctx, offscreenCtx, offscreenCanvas } = this.createCanvas(
      window.innerWidth,
      window.innerHeight,
      this.resolution,
      this.resolution
    );

    this.ctx = ctx;
    this.offscreenCtx = offscreenCtx;
    this.offscreenCanvas = offscreenCanvas;

    // Initialize the Web Worker
    try {
      this.worker = new Worker(new URL('./distance-field.worker.ts', import.meta.url).href, { type: 'module' });
      this.worker.onmessage = this.handleWorkerMessage;
      this.worker.postMessage({ type: 'initialize', data: { resolution: this.resolution } });
    } catch (error) {
      console.error('Error initializing worker', error);
    }

    this.renderDistanceField();
  }

  connectedCallback() {
    // Update distance field when geometries move or resize
    this.geometries.forEach((geometry) => {
      geometry.addEventListener('move', this.handleGeometryUpdate);
      geometry.addEventListener('resize', this.handleGeometryUpdate);
    });
  }

  disconnectedCallback() {
    // Remove event listeners and terminate the worker
    this.geometries.forEach((geometry) => {
      geometry.removeEventListener('move', this.handleGeometryUpdate);
      geometry.removeEventListener('resize', this.handleGeometryUpdate);
    });
    this.worker.terminate();
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'resolution') {
      this.resolution = parseInt(newValue, 10);
      // Re-initialize the worker with the new resolution
      this.worker.postMessage({ type: 'initialize', data: { resolution: this.resolution } });
    } else if (name === 'image-smoothing') {
      this.imageSmoothing = newValue === 'true';
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = this.imageSmoothing;
      }
    }
  }

  private renderDistanceField() {
    // Request the worker to generate ImageData
    this.worker.postMessage({ type: 'generateImageData' });
  }

  // Handle messages from the worker
  private handleWorkerMessage = (event: MessageEvent) => {
    const { type, imageData } = event.data;

    if (type === 'imageData') {
      // Reconstruct ImageData from the transferred buffer
      const imgData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

      // Update the canvas with the new image data
      this.offscreenCtx.putImageData(imgData, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(
        this.offscreenCanvas,
        0,
        0,
        this.resolution,
        this.resolution,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }
  };

  // Public method to reset fields
  reset() {
    // Reset the fields in the worker
    this.worker.postMessage({ type: 'initialize', data: { resolution: this.resolution } });
  }

  private transformToFieldCoordinates(point: Vector2): Vector2 {
    // Transform from screen coordinates to field coordinates (0 to resolution)
    return {
      x: (point.x / this.canvas.width) * this.resolution,
      y: (point.y / this.canvas.height) * this.resolution,
    };
  }

  addShape(points: Vector2[]) {
    // Transform and send points to the worker
    const transformedPoints = points.map((point) => this.transformToFieldCoordinates(point));
    this.worker.postMessage({ type: 'addShape', data: { points: transformedPoints } });
    this.renderDistanceField();
  }

  removeShape(index: number) {
    // Inform the worker to remove a shape
    this.worker.postMessage({ type: 'removeShape', data: { index } });
    this.renderDistanceField();
  }

  private createCanvas(width: number, height: number, offScreenWidth: number, offScreenHeight: number) {
    this.canvas = document.createElement('canvas');
    const offscreenCanvas = document.createElement('canvas');

    // Set canvas styles
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '-1';

    offscreenCanvas.width = offScreenWidth;
    offscreenCanvas.height = offScreenHeight;
    this.canvas.width = width;
    this.canvas.height = height;

    const offscreenCtx = offscreenCanvas.getContext('2d', {
      willReadFrequently: true,
    });
    const ctx = this.canvas.getContext('2d');

    if (!ctx || !offscreenCtx) throw new Error('Could not get context');
    ctx.imageSmoothingEnabled = this.imageSmoothing;

    this.appendChild(this.canvas);
    return { ctx, offscreenCtx, offscreenCanvas };
  }

  handleGeometryUpdate = (event: Event) => {
    const geometry = event.target as HTMLElement;
    const shapeId = this.geometryShapeIds.get(geometry);

    const rect = geometry.getBoundingClientRect();
    const points = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ];

    const transformedPoints = this.transformPoints(points);

    if (shapeId) {
      this.worker.postMessage({
        type: 'updateShape',
        data: { id: shapeId, points: transformedPoints },
      });
    } else {
      const newId = crypto.randomUUID();
      this.geometryShapeIds.set(geometry, newId);
      this.worker.postMessage({
        type: 'addShape',
        data: { id: newId, points: transformedPoints },
      });
    }

    this.renderDistanceField();
  };

  private transformPoints(points: Vector2[]): Vector2[] {
    return points.map((point) => this.transformToFieldCoordinates(point));
  }
}
