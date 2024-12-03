export type Point = { x: number; y: number };

export type RotatedDOMRect = DOMRect & {
  /** in radians */
  rotation: number;

  /** Returns the center point in worldspace coordinates */
  center(): Point;

  /** Returns the four corners in worldspace coordinates, in clockwise order starting from the top left */
  corners(): [Point, Point, Point, Point];

  /** Returns all the vertices in worldspace coordinates */
  vertices(): Point[];
};
