import type { Vector2 } from '../utils/Vector2.ts';
import { computeCPT } from './cpt.ts';

type ColorFunc = (d: number) => { r: number; g: number; b: number };

export class Fields {
  private edt: Float32Array[] = [];
  private cpt: Vector2[][] = [];
  private colorField: Float32Array[] = [];
  private xcoords: Float32Array[] = [];
  private ycoords: Float32Array[] = [];
  private resolution: number;
  shapes: Array<{
    points: Vector2[];
    color: number;
  }> = [];

  constructor(resolution: number) {
    this.resolution = resolution + 1;
    this.initializeArrays();
    this.updateFields();
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

  addShape(points: Vector2[], color?: number) {
    const shapeColor = color ?? Math.floor(Math.random() * 255);
    this.shapes.push({ points, color: shapeColor });
    this.updateFields();
  }

  removeShape(index: number) {
    this.shapes.splice(index, 1);
    this.updateFields();
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

  boolifyFields(distanceField: Float32Array[], colorField: Float32Array[]): void {
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

    for (const shape of this.shapes) {
      const { points, color } = shape;

      for (let i = 0; i < points.length; i++) {
        const start = points[i];
        const end = points[(i + 1) % points.length];
        drawLine(start, end, color);
      }
    }
  }

  updateShape(index: number, points: Vector2[]) {
    if (index >= 0 && index < this.shapes.length) {
      const existingColor = this.shapes[index].color;
      this.shapes[index] = { points, color: existingColor };
      this.updateFields();
    }
  }

  private renderEDT(colorFunc: ColorFunc): ImageData {
    const imageData = new ImageData(this.resolution, this.resolution);
    for (let row = 0; row < this.resolution; row++) {
      for (let col = 0; col < this.resolution; col++) {
        const index = (col * this.resolution + row) * 4;
        const distance = this.edt[row][col];
        const color = colorFunc(distance);
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = 255;
      }
    }
    return imageData;
  }

  private renderCPT(): ImageData {
    const imageData = new ImageData(this.resolution, this.resolution);

    for (let row = 0; row < this.resolution; row++) {
      for (let col = 0; col < this.resolution; col++) {
        const { x, y } = this.cpt[row][col];
        const shapeColor = this.colorField[x][y];
        const color = {
          r: (shapeColor * 7) % 150,
          g: (shapeColor * 13) % 200,
          b: (shapeColor * 19) % 250,
        };
        const index = (col * this.resolution + row) * 4;
        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = 255;
      }
    }
    return imageData;
  }

  private renderCombined(): ImageData {
    const imageData = new ImageData(this.resolution, this.resolution);

    for (let row = 0; row < this.resolution; row++) {
      for (let col = 0; col < this.resolution; col++) {
        const index = (col * this.resolution + row) * 4;
        const distance = this.edt[row][col];
        const { x, y } = this.cpt[row][col];
        const shapeColor = this.colorField[x][y] % 200;

        const maxDistance = 10;
        const normalizedDistance = Math.sqrt(distance) / maxDistance;
        const baseColor = {
          r: (shapeColor * 7) % 256,
          g: (shapeColor * 13) % 256,
          b: (shapeColor * 19) % 256,
        };
        const color = {
          r: baseColor.r * (1 - normalizedDistance),
          g: baseColor.g * (1 - normalizedDistance),
          b: baseColor.b * (1 - normalizedDistance),
        };

        imageData.data[index] = color.r;
        imageData.data[index + 1] = color.g;
        imageData.data[index + 2] = color.b;
        imageData.data[index + 3] = 255;
      }
    }
    return imageData;
  }

  public generateImageData(): ImageData {
    return this.renderCombined();
    // return this.renderCPT();
    // return this.renderEDT(Color.rainbowColorFunc);
  }
}

const Color = {
  simpleColorFunc: (d: number) => {
    return { r: 250 - d * 2, g: 250 - d * 5, b: 250 - d * 3 };
  },
  simpleModuloColorFunc: (d: number) => {
    const period = 18;
    const modulo = d % period;
    return { r: modulo * period, g: (modulo * period) / 3, b: (modulo * period) / 2 };
  },
  moduloColorFunc: (d: number) => {
    const dPeriod = d % 15;
    return { r: dPeriod * 10, g: dPeriod * 20, b: dPeriod * 30 };
  },
  grayscaleColorFunc: (d: number) => {
    const value = 255 - Math.abs(d) * 10;
    return { r: value, g: value, b: value };
  },
  heatmapColorFunc: (d: number) => {
    const value = Math.min(255, Math.max(0, 255 - Math.abs(d) * 10));
    return { r: value, g: 0, b: 255 - value };
  },
  invertedColorFunc: (d: number) => {
    const value = Math.abs(d) % 255;
    return { r: 255 - value, g: 255 - value, b: 255 - value };
  },
  rainbowColorFunc: (d: number) => {
    const value = Math.abs(d) % 255;
    return { r: (value * 5) % 255, g: (value * 3) % 255, b: (value * 7) % 255 };
  },
};
