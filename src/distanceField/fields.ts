import type { Vector2 } from '../utils/Vector2.ts';
import { computeCPT } from './cpt.ts';

interface Shape {
  id: string;
  points: Vector2[];
  color: number;
}

export class Fields {
  private edt: Float32Array[] = [];
  private cpt: Vector2[][] = [];
  private colorField: Float32Array[] = [];
  private xcoords: Float32Array[] = [];
  private ycoords: Float32Array[] = [];
  private resolution: number;
  private shapes: Map<string, Shape> = new Map();

  constructor(resolution: number) {
    this.resolution = resolution + 1;
    this.initializeArrays();
  }

  private initializeArrays() {
    this.edt = new Array(this.resolution).fill(Infinity).map(() => new Float32Array(this.resolution).fill(Infinity));
    this.colorField = new Array(this.resolution).fill(0).map(() => new Float32Array(this.resolution).fill(0));
    this.xcoords = Array.from({ length: this.resolution }, () => new Float32Array(this.resolution).fill(0));
    this.ycoords = Array.from({ length: this.resolution }, () => new Float32Array(this.resolution).fill(0));
    this.cpt = Array.from({ length: this.resolution }, () =>
      Array.from({ length: this.resolution }, () => ({ x: 0, y: 0 }))
    );
  }

  // Public getters for field data
  getDistance(row: number, col: number): number {
    return this.edt[row][col];
  }

  getColor(row: number, col: number): number {
    const { x, y } = this.cpt[row][col];
    return this.colorField[x][y];
  }

  addShape(id: string, points: Vector2[], color?: number) {
    const shapeColor = color ?? Math.floor(Math.random() * 255);
    this.shapes.set(id, { id, points, color: shapeColor });
    this.updateFields();
  }

  removeShape(id: string) {
    if (this.shapes.delete(id)) {
      this.updateFields();
    }
  }

  updateShape(id: string, points: Vector2[]) {
    const shape = this.shapes.get(id);
    if (shape) {
      shape.points = points;
      this.updateFields();
    }
  }

  updateFields() {
    this.boolifyFields(this.edt, this.colorField);
    this.cpt = computeCPT(this.edt, this.cpt, this.xcoords, this.ycoords);
    this.deriveEDTfromCPT();
  }

  deriveEDTfromCPT() {
    for (let x = 0; x < this.resolution; x++) {
      for (let y = 0; y < this.resolution; y++) {
        const { x: closestX, y: closestY } = this.cpt[y][x];
        const distance = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
        this.edt[y][x] = distance;
      }
    }
  }

  private boolifyFields(distanceField: Float32Array[], colorField: Float32Array[]): void {
    const LARGE_NUMBER = 1000000000000;
    const size = distanceField.length;
    const cellSize = 1;

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        distanceField[x][y] = LARGE_NUMBER;
        colorField[y][x] = 0;
      }
    }

    const drawLine = (start: Vector2, end: Vector2, color: number) => {
      const startCell = {
        x: Math.floor(start.x / cellSize),
        y: Math.floor(start.y / cellSize),
      };
      const endCell = {
        x: Math.floor(end.x / cellSize),
        y: Math.floor(end.y / cellSize),
      };
      if (startCell.x < 0 || startCell.x >= size || startCell.y < 0 || startCell.y >= size) {
        return;
      }
      if (endCell.x < 0 || endCell.x >= size || endCell.y < 0 || endCell.y >= size) {
        return;
      }
      if (startCell.x === endCell.x && startCell.y === endCell.y) {
        distanceField[startCell.x][startCell.y] = 0;
        colorField[startCell.y][startCell.x] = color;
        return;
      }

      let x0 = startCell.x;
      let y0 = startCell.y;
      const x1 = endCell.x;
      const y1 = endCell.y;

      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        distanceField[x0][y0] = 0;
        colorField[y0][x0] = color;
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x0 += sx;
        }
        if (e2 < dx) {
          err += dx;
          y0 += sy;
        }
      }
    };

    for (const shape of this.shapes.values()) {
      const { points, color } = shape;
      for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length];
        drawLine(start, end, color);
      }
    }
  }

  public generateImageData(): ImageData {
    const imageData = new ImageData(this.resolution, this.resolution);
    const data = imageData.data;
    const resolution = this.resolution;
    const edt = this.edt;
    const cpt = this.cpt;
    const colorField = this.colorField;

    // Pre-calculate color lookup table
    const colorLookup = new Float32Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      colorLookup[i * 3] = (i * 7) % 256; // r
      colorLookup[i * 3 + 1] = (i * 13) % 256; // g
      colorLookup[i * 3 + 2] = (i * 19) % 256; // b
    }

    // Unrolled inner loop with direct calculations
    const len = resolution * resolution;
    for (let i = 0; i < len; i++) {
      const row = i % resolution;
      const col = (i / resolution) | 0;
      const index = i * 4;

      const distance = edt[row][col];
      const { x: closestX, y: closestY } = cpt[row][col];
      const shapeColor = colorField[closestX][closestY];

      // Direct color calculation without function call
      const normalizedDistance = Math.sqrt(distance) / 10;
      const colorIndex = shapeColor * 3;
      const factor = 1 - normalizedDistance;

      data[index] = colorLookup[colorIndex] * factor; // r
      data[index + 1] = colorLookup[colorIndex + 1] * factor; // g
      data[index + 2] = colorLookup[colorIndex + 2] * factor; // b
      data[index + 3] = 255;
    }

    return imageData;
  }
}

const ColorMap = {
  simple: (d: number) => {
    return { r: 250 - d * 2, g: 250 - d * 5, b: 250 - d * 3 };
  },
  modulo: (d: number) => {
    const period = 18;
    const modulo = d % period;
    return { r: modulo * period, g: (modulo * period) / 3, b: (modulo * period) / 2 };
  },
  grayscale: (d: number) => {
    const value = 255 - Math.abs(d) * 10;
    return { r: value, g: value, b: value };
  },
  heatmap: (d: number) => {
    const value = Math.min(255, Math.max(0, 255 - Math.abs(d) * 10));
    return { r: value, g: 0, b: 255 - value };
  },
  inverted: (d: number) => {
    const value = Math.abs(d) % 255;
    return { r: 255 - value, g: 255 - value, b: 255 - value };
  },
  rainbow: (d: number) => {
    const value = Math.abs(d) % 255;
    return { r: (value * 5) % 255, g: (value * 3) % 255, b: (value * 7) % 255 };
  },
};