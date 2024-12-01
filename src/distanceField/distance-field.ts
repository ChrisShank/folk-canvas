import type { FolkGeometry } from '../canvas/fc-geometry.ts';
import type { Vector2 } from '../utils/Vector2.ts';
import { Fields } from './fields.ts';

export class DistanceField extends HTMLElement {
  static tagName = 'distance-field';

  static define() {
    customElements.define(this.tagName, this);
  }

  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCtx: CanvasRenderingContext2D;
  private fields: Fields;
  private resolution: number;
  private imageSmoothing: boolean;

  // Get all geometry elements and create points for the distance field
  private geometries = document.querySelectorAll('fc-geometry');

  constructor() {
    super();

    this.resolution = 800; // default resolution
    this.imageSmoothing = true;
    this.fields = new Fields(this.resolution);

    const { ctx, offscreenCtx } = this.createCanvas(
      window.innerWidth,
      window.innerHeight,
      this.resolution,
      this.resolution
    );

    this.ctx = ctx;
    this.offscreenCtx = offscreenCtx;

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
    // Update distance field when geometries move or resize
    this.geometries.forEach((geometry) => {
      geometry.removeEventListener('move', this.handleGeometryUpdate);
      geometry.removeEventListener('resize', this.handleGeometryUpdate);
    });
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'resolution') {
      this.resolution = parseInt(newValue, 10);
      this.fields = new Fields(this.resolution);
    } else if (name === 'image-smoothing') {
      this.imageSmoothing = newValue === 'true';
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = this.imageSmoothing;
      }
    }
  }

  private renderDistanceField() {
    // Get the computed ImageData from Fields
    const imageData = this.fields.generateImageData();

    // Put the ImageData onto the offscreen canvas
    this.offscreenCtx.putImageData(imageData, 0, 0);

    // Draw scaled version to main canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.offscreenCtx.canvas,
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

  // Public methods
  reset() {
    this.fields = new Fields(this.resolution);
  }

  private transformToFieldCoordinates(point: Vector2): Vector2 {
    // Transform from screen coordinates to field coordinates (0 to resolution)
    return {
      x: (point.x / this.canvas.width) * this.resolution,
      y: (point.y / this.canvas.height) * this.resolution,
    };
  }

  addShape(points: Vector2[]) {
    // Transform each point from screen coordinates to field coordinates
    const transformedPoints = points.map((point) => this.transformToFieldCoordinates(point));
    this.fields.addShape(transformedPoints);
    this.renderDistanceField();
  }

  removeShape(index: number) {
    this.fields.removeShape(index);
    this.renderDistanceField();
  }

  private createCanvas(width: number, height: number, offScreenWidth: number, offScreenHeight: number) {
    this.canvas = document.createElement('canvas');
    const offscreenCanvas = document.createElement('canvas');

    // Set canvas styles to ensure it stays behind other elements
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
    return { ctx, offscreenCtx };
  }

  handleGeometryUpdate = (event: Event) => {
    const geometry = event.target as HTMLElement;
    // TODO: store as array from getgo
    const index = Array.from(this.geometries).indexOf(geometry as FolkGeometry);
    if (index === -1) return;

    const rect = geometry.getBoundingClientRect();
    const points = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
    ];

    if (index < this.fields.shapes.length) {
      this.fields.updateShape(index, this.transformPoints(points));
    } else {
      this.fields.addShape(this.transformPoints(points));
    }

    this.renderDistanceField();
  };

  private transformPoints(points: Vector2[]): Vector2[] {
    return points.map((point) => this.transformToFieldCoordinates(point));
  }
}
