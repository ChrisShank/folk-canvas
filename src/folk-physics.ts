import { DOMRectTransform } from './common/DOMRectTransform.ts';
import { FolkBaseSet } from './folk-base-set.ts';
import { PropertyValues } from '@lit/reactive-element';
import * as RAPIER from '@dimforge/rapier2d';
import { FolkShape } from './folk-shape';

export class FolkPhysics extends FolkBaseSet {
  static override tagName = 'folk-physics';

  private world?: RAPIER.World;
  private bodies: Map<FolkShape, RAPIER.RigidBody> = new Map();
  private elementToRect: Map<FolkShape, DOMRectTransform> = new Map();
  private animationFrameId?: number;
  private lastTimestamp?: number;

  connectedCallback() {
    super.connectedCallback();

    // Create physics world with gravity
    this.world = new RAPIER.World({ x: 0.0, y: 9.81 });

    // Add container walls and floor
    this.createContainer();

    // Start the simulation loop
    this.startSimulation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Stop simulation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Cleanup physics resources
    this.bodies.clear();
    this.elementToRect.clear();
    this.world?.free();
  }

  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);

    if (!this.world || this.sourcesMap.size !== this.sourceElements.size) return;

    // Update physics bodies to match source elements
    this.updatePhysicsBodies();
  }

  private updatePhysicsBodies() {
    // Remove bodies for elements that no longer exist
    for (const [element, body] of this.bodies) {
      if (!this.sourceElements.has(element)) {
        this.world!.removeRigidBody(body);
        this.bodies.delete(element);
      }
    }

    // Create or update bodies for current elements
    for (const element of this.sourceElements) {
      if (!(element instanceof FolkShape)) continue;
      const rect = this.sourcesMap.get(element);
      if (!(rect instanceof DOMRectTransform)) continue;

      if (!this.bodies.has(element)) {
        // Create new rigid body matching the element's position
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(rect.x + rect.width / 2, rect.y + rect.height / 2)
          .setRotation(rect.rotation);

        const body = this.world!.createRigidBody(bodyDesc);

        // Create collider with top-left origin
        const colliderDesc = RAPIER.ColliderDesc.cuboid(rect.width / 2, rect.height / 2).setTranslation(0, 0);

        this.world!.createCollider(colliderDesc, body);
        this.bodies.set(element, body);

        // Set element's rotation origin to top-left
        rect.transformOrigin = { x: 0, y: 0 };
      }

      // Update existing body
      const body = this.bodies.get(element)!;

      if (element === document.activeElement) {
        body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
        body.setTranslation(
          {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
          },
          true
        );
        body.setRotation(rect.rotation, true);
      } else if (body.bodyType() === RAPIER.RigidBodyType.KinematicPositionBased) {
        // Update collider size when switching back to dynamic
        const collider = body.collider(0);
        if (collider) {
          this.world!.removeCollider(collider, true);
          const newColliderDesc = RAPIER.ColliderDesc.cuboid(rect.width / 2, rect.height / 2).setTranslation(0, 0);
          this.world!.createCollider(newColliderDesc, body);
        }
        body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      }
    }
  }

  private startSimulation() {
    const step = (timestamp: number) => {
      if (!this.lastTimestamp) {
        this.lastTimestamp = timestamp;
      }

      if (this.world) {
        this.world.step();

        // Update visual elements based on physics
        this.bodies.forEach((body, shape) => {
          if (shape !== document.activeElement) {
            const position = body.translation();
            // Adjust position back to top-left
            shape.x = position.x - shape.width / 2;
            shape.y = position.y - shape.height / 2;
            shape.rotation = body.rotation();
          }
        });
      }

      this.animationFrameId = requestAnimationFrame(step);
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  private createContainer() {
    if (!this.world) return;

    // Create a single rigid body for the container
    const containerDesc = RAPIER.RigidBodyDesc.fixed();
    const container = this.world.createRigidBody(containerDesc);

    // Create a single collider with all four walls as vertices
    const vertices = [
      // Floor: left to right
      { x: -1000, y: this.clientHeight },
      { x: 1000, y: this.clientHeight },
      // Right wall: bottom to top
      { x: this.clientWidth, y: this.clientHeight },
      { x: this.clientWidth, y: -1000 },
      // Ceiling: right to left
      { x: 1000, y: 0 },
      { x: -1000, y: 0 },
      // Left wall: top to bottom
      { x: 0, y: -1000 },
      { x: 0, y: this.clientHeight },
    ];

    const indices = [
      0,
      1, // Floor
      2,
      3, // Right wall
      4,
      5, // Ceiling
      6,
      7, // Left wall
    ];

    const vertexArray = new Float32Array(vertices.flatMap((v) => [v.x, v.y]));
    const indexArray = new Uint32Array(indices);

    this.world.createCollider(RAPIER.ColliderDesc.polyline(vertexArray, indexArray), container);
  }
}
