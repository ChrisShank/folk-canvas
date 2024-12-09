import { DOMRectTransform } from './common/DOMRectTransform.ts';
import { Point } from './common/types.ts';
import { glsl } from './common/tags.ts';
import { WebGLUtils } from './common/webgl.ts';
import { FolkBaseSet } from './folk-base-set.ts';
import { PropertyValues } from '@lit/reactive-element';

/**
 * The DistanceField class calculates a distance field using the Jump Flooding Algorithm (JFA) in WebGL.
 * It renders shapes as seed points and computes the distance from each pixel to the nearest seed point.
 * Previous CPU-based implementation: github.com/folk-canvas/folk-canvas/commit/fdd7fb9d84d93ad665875cad25783c232fd17bcc
 */
export class FolkDistanceField extends FolkBaseSet {
  static override tagName = 'folk-distance-field';

  static readonly MAX_DISTANCE = 99999.0;

  private textures: WebGLTexture[] = [];

  private canvas!: HTMLCanvasElement;
  private glContext!: WebGL2RenderingContext;
  private framebuffer!: WebGLFramebuffer;
  private fullscreenQuadVAO!: WebGLVertexArrayObject;
  private shapeVAO!: WebGLVertexArrayObject;

  private jfaProgram!: WebGLProgram; // Shader program for the Jump Flooding Algorithm
  private renderProgram!: WebGLProgram; // Shader program for final rendering
  private seedProgram!: WebGLProgram; // Shader program for rendering seed points

  private positionBuffer: WebGLBuffer | null = null;

  private isPingTexture: boolean = true;

  connectedCallback() {
    super.connectedCallback();

    this.initWebGL();
    this.initShaders();
    this.initPingPongTextures();

    window.addEventListener('resize', this.handleResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener('resize', this.handleResize);

    this.cleanupWebGLResources();
  }

  private initWebGL() {
    const { gl, canvas } = WebGLUtils.createWebGLCanvas(this.clientWidth, this.clientHeight);

    if (!gl || !canvas) {
      throw new Error('Failed to initialize WebGL context.');
    }

    this.canvas = canvas;
    this.renderRoot.prepend(canvas);
    this.glContext = gl;
  }

  /**
   * Handles updates to geometry elements by re-initializing seed points and rerunning the JFA.
   */
  override update(changedProperties: PropertyValues<this>) {
    super.update(changedProperties);

    if (this.sourcesMap.size !== this.sourceElements.size) return;

    this.populateSeedPoints();
    this.runJumpFloodingAlgorithm();
  }

  /**
   * Initializes all shader programs used in rendering.
   */
  private initShaders() {
    this.jfaProgram = WebGLUtils.createShaderProgram(this.glContext, commonVertShader, jfaFragShader);
    this.renderProgram = WebGLUtils.createShaderProgram(this.glContext, commonVertShader, renderFragShader);
    this.seedProgram = WebGLUtils.createShaderProgram(this.glContext, seedVertShader, seedFragShader);
  }

  /**
   * Initializes textures and framebuffer for ping-pong rendering.
   * Ping-pong textures are used to alternate between reading and writing textures in multi-pass algorithms.
   */
  private initPingPongTextures() {
    const gl = this.glContext;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Delete existing textures to prevent memory leaks
    for (const texture of this.textures) {
      gl.deleteTexture(texture);
    }
    this.textures = [];

    // Enable the EXT_color_buffer_half_float extension for high-precision floating-point textures
    const ext = gl.getExtension('EXT_color_buffer_half_float');
    if (!ext) {
      console.error('EXT_color_buffer_half_float extension is not supported.');
      return;
    }

    // Create two textures for ping-pong rendering
    for (let i = 0; i < 2; i++) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // Set texture parameters
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Use high-precision format for accurate distance calculations
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);

      this.textures.push(texture);
    }

    // Create or reuse the framebuffer
    if (!this.framebuffer) {
      this.framebuffer = gl.createFramebuffer()!;
    }

    // Check if framebuffer is complete
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is not complete:', status);
      return;
    }
  }

  /**
   * Initializes rendering of seed points (shapes) into a texture.
   * Seed points are the starting locations for distance calculations.
   */
  private populateSeedPoints() {
    const gl = this.glContext;
    const positions: number[] = [];

    const containerWidth = this.clientWidth;
    const containerHeight = this.clientHeight;

    // Collect positions and assign unique IDs to all shapes
    this.sourceRects.forEach((rect, index) => {
      let topLeftParent: Point;
      let topRightParent: Point;
      let bottomLeftParent: Point;
      let bottomRightParent: Point;

      if (rect instanceof DOMRectTransform) {
        topLeftParent = rect.toParentSpace(rect.topLeft);
        topRightParent = rect.toParentSpace(rect.topRight);
        bottomLeftParent = rect.toParentSpace(rect.bottomLeft);
        bottomRightParent = rect.toParentSpace(rect.bottomRight);
      } else {
        topLeftParent = { x: rect.left, y: rect.top };
        topRightParent = { x: rect.right, y: rect.top };
        bottomLeftParent = { x: rect.left, y: rect.bottom };
        bottomRightParent = { x: rect.right, y: rect.bottom };
      }

      // Convert rotated coordinates to NDC using container dimensions
      const x1 = (topLeftParent.x / containerWidth) * 2 - 1;
      const y1 = -((topLeftParent.y / containerHeight) * 2 - 1);
      const x2 = (topRightParent.x / containerWidth) * 2 - 1;
      const y2 = -((topRightParent.y / containerHeight) * 2 - 1);
      const x3 = (bottomLeftParent.x / containerWidth) * 2 - 1;
      const y3 = -((bottomLeftParent.y / containerHeight) * 2 - 1);
      const x4 = (bottomRightParent.x / containerWidth) * 2 - 1;
      const y4 = -((bottomRightParent.y / containerHeight) * 2 - 1);

      const shapeID = index + 1; // Avoid zero to prevent hash function issues

      // Represent each rectangle as two triangles, including shapeID as the z component
      positions.push(
        x1,
        y1,
        shapeID,
        x2,
        y2,
        shapeID,
        x3,
        y3,
        shapeID,

        x3,
        y3,
        shapeID,
        x2,
        y2,
        shapeID,
        x4,
        y4,
        shapeID
      );
    });

    if (!this.shapeVAO) {
      this.shapeVAO = gl.createVertexArray()!;
      gl.bindVertexArray(this.shapeVAO);
      this.positionBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

      const positionLocation = gl.getAttribLocation(this.seedProgram, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer!);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positions));
    }

    // Render the seed points into the texture
    this.renderSeedPoints();
  }

  /**
   * Renders the seed points (shapes) into one of the ping-pong textures.
   * This serves as the initial state for the Jump Flooding Algorithm.
   */
  private renderSeedPoints() {
    const gl = this.glContext;

    // Bind framebuffer to render to the seed texture
    const seedTexture = this.textures[this.isPingTexture ? 0 : 1];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, seedTexture, 0);

    // Clear the texture with a large initial distance
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, FolkDistanceField.MAX_DISTANCE);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the seed shader program
    gl.useProgram(this.seedProgram);

    // Set the canvas size uniform
    const canvasSizeLocation = gl.getUniformLocation(this.seedProgram, 'u_canvasSize');
    gl.uniform2f(canvasSizeLocation, this.canvas.width, this.canvas.height);

    // Bind VAO and draw shapes
    gl.bindVertexArray(this.shapeVAO);
    gl.drawArrays(gl.TRIANGLES, 0, this.sourcesMap.size * 6);

    // Unbind VAO and framebuffer
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Executes the Jump Flooding Algorithm (JFA) to compute the distance field.
   * It progressively reduces step sizes to refine the distance calculations.
   */
  private runJumpFloodingAlgorithm() {
    let stepSize = 1 << Math.floor(Math.log2(Math.max(this.canvas.width, this.canvas.height)));

    // Perform passes with decreasing step sizes
    for (; stepSize >= 1; stepSize >>= 1) {
      this.renderPass(stepSize);
    }

    // Render the final result to the screen
    this.renderToScreen();
  }

  /**
   * Performs a single pass of the Jump Flooding Algorithm with a given step size.
   * This involves sampling neighboring pixels at the current step size.
   * @param stepSize The current step size for this pass.
   */
  private renderPass(stepSize: number) {
    const gl = this.glContext;

    // Swap textures for ping-pong rendering
    const inputTexture = this.isPingTexture ? this.textures[0] : this.textures[1];
    const outputTexture = this.isPingTexture ? this.textures[1] : this.textures[0];

    // Bind framebuffer to output texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);

    // Use the JFA shader program
    gl.useProgram(this.jfaProgram);

    // Compute and set the offsets uniform for neighboring pixels
    const offsets = this.computeOffsets(stepSize);
    const offsetsLocation = gl.getUniformLocation(this.jfaProgram, 'u_offsets');
    gl.uniform2fv(offsetsLocation, offsets);

    // Bind input texture containing the previous step's results
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(gl.getUniformLocation(this.jfaProgram, 'u_previousTexture'), 0);

    // Draw a fullscreen quad to process all pixels
    this.drawFullscreenQuad();

    // Toggle the flag
    this.isPingTexture = !this.isPingTexture;
  }

  /**
   * Renders the final distance field to the screen using the render shader program.
   */
  private renderToScreen() {
    const gl = this.glContext;

    // Unbind framebuffer to render directly to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Use the render shader program
    gl.useProgram(this.renderProgram);

    // Bind the final texture containing the computed distance field
    const finalTexture = this.textures[this.isPingTexture ? 0 : 1];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTexture);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_texture'), 0);

    // Draw a fullscreen quad to display the result
    this.drawFullscreenQuad();
  }

  /**
   * Draws a fullscreen quad to cover the entire canvas.
   * This is used in shader passes where every pixel needs to be processed.
   */
  private drawFullscreenQuad() {
    const gl = this.glContext;

    // Initialize the quad geometry if it hasn't been done yet
    if (!this.fullscreenQuadVAO) {
      this.initFullscreenQuad();
    }

    gl.bindVertexArray(this.fullscreenQuadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * Initializes the geometry and buffers for the fullscreen quad.
   */
  private initFullscreenQuad() {
    const gl = this.glContext;

    // Define positions for a quad covering the entire screen
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    this.fullscreenQuadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.fullscreenQuadVAO);

    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(this.jfaProgram, 'a_position');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
      positionAttributeLocation,
      2, // size (x, y)
      gl.FLOAT, // type
      false, // normalize
      0, // stride
      0 // offset
    );

    gl.bindVertexArray(null);
  }

  /**
   * Handles window resize events by updating canvas size, re-initializing textures and seed points,
   * and rerunning the Jump Flooding Algorithm.
   */
  private handleResize = () => {
    const gl = this.glContext;

    // Update canvas size to match the container instead of window
    this.canvas.width = this.clientWidth;
    this.canvas.height = this.clientHeight;

    // Update the viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Re-initialize textures with the new dimensions
    this.initPingPongTextures();

    // Re-initialize seed point rendering to update positions
    this.populateSeedPoints();

    // Rerun the Jump Flooding Algorithm with the new sizes
    this.runJumpFloodingAlgorithm();
  };

  /**
   * Computes the offsets to sample neighboring pixels based on the current step size.
   * These offsets are used in the JFA shader to determine where to look for potential nearer seed points.
   * @param stepSize The current step size for neighbor sampling.
   * @returns A Float32Array of offsets.
   */
  private computeOffsets(stepSize: number): Float32Array {
    const aspectRatio = this.canvas.width / this.canvas.height;
    const offsets: number[] = [];
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        // Adjust x offset by aspect ratio to maintain uniform distances
        offsets.push((x * stepSize * aspectRatio) / this.canvas.width, (y * stepSize) / this.canvas.height);
      }
    }
    return new Float32Array(offsets);
  }

  /**
   * Cleans up WebGL resources to prevent memory leaks.
   * This is called when the element is disconnected from the DOM.
   */
  private cleanupWebGLResources() {
    const gl = this.glContext;

    // Delete textures
    this.textures.forEach((texture) => gl.deleteTexture(texture));
    this.textures = [];

    // Delete framebuffer
    if (this.framebuffer) {
      gl.deleteFramebuffer(this.framebuffer);
    }

    // Delete VAOs
    if (this.fullscreenQuadVAO) {
      gl.deleteVertexArray(this.fullscreenQuadVAO);
    }
    if (this.shapeVAO) {
      gl.deleteVertexArray(this.shapeVAO);
    }

    // Delete shader programs
    if (this.jfaProgram) {
      gl.deleteProgram(this.jfaProgram);
    }
    if (this.renderProgram) {
      gl.deleteProgram(this.renderProgram);
    }
    if (this.seedProgram) {
      gl.deleteProgram(this.seedProgram);
    }
  }
}

/**
 * Vertex shader shared by multiple programs.
 * Transforms vertices to normalized device coordinates and passes texture coordinates to the fragment shader.
 */
const commonVertShader = glsl`#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5; // Transform to [0, 1] range
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

/**
 * Fragment shader for the Jump Flooding Algorithm.
 * Updates the nearest seed point and distance for each pixel by examining neighboring pixels.
 */
const jfaFragShader = glsl`#version 300 es
precision mediump float;
precision mediump int;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_previousTexture;
uniform vec2 u_offsets[9];

void main() {
    vec4 nearest = texture(u_previousTexture, v_texCoord);
    float minDist = nearest.a;

    float aspectRatio = float(textureSize(u_previousTexture, 0).x) / float(textureSize(u_previousTexture, 0).y);
    
    for (int i = 0; i < 9; ++i) {
        vec2 sampleCoord = v_texCoord + u_offsets[i];
        sampleCoord = clamp(sampleCoord, vec2(0.0), vec2(1.0));
        vec4 sampled = texture(u_previousTexture, sampleCoord);

        if (sampled.z == 0.0) {
            continue;
        }

        // Adjust x coordinate by aspect ratio when calculating distance
        vec2 adjustedCoord = vec2(v_texCoord.x * aspectRatio, v_texCoord.y);
        vec2 adjustedSampledCoord = vec2(sampled.x * aspectRatio, sampled.y);
        float dist = distance(adjustedSampledCoord, adjustedCoord);

        if (dist < minDist) {
            nearest = sampled;
            nearest.a = dist;
            minDist = dist;
        }
    }

    outColor = nearest;
}`;

/**
 * Fragment shader for rendering the final distance field.
 * Converts distances to colors for visualization.
 */
const renderFragShader = glsl`#version 300 es
precision mediump float;

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_texture;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 texel = texture(u_texture, v_texCoord);

    // Extract shape ID and distance
    float shapeID = texel.z;
    float distance = texel.a;

    float hue = fract(shapeID * 0.61803398875); // Golden ratio conjugate
    vec3 shapeColor = hsv2rgb(vec3(hue, 0.5, 0.95));
 

    // Visualize distance as intensity
    float intensity = exp(-distance * 10.0);

    outColor = vec4(shapeColor * intensity, 1.0);
}`;

/**
 * Vertex shader for rendering seed points.
 * Outputs the shape ID to the fragment shader.
 */
const seedVertShader = glsl`#version 300 es
precision mediump float;

in vec3 a_position; // x, y position and shapeID as z
flat out float v_shapeID;

void main() {
  gl_Position = vec4(a_position.xy, 0.0, 1.0);
  v_shapeID = a_position.z; // Pass shape ID to fragment shader
}`;

/**
 * Fragment shader for rendering seed points.
 * Initializes the texture with seed point positions and shape IDs.
 */
const seedFragShader = glsl`#version 300 es
precision mediump float;

flat in float v_shapeID;
uniform vec2 u_canvasSize;

out vec4 outColor;

void main() {
  vec2 seedCoord = gl_FragCoord.xy / u_canvasSize;
  outColor = vec4(seedCoord, v_shapeID, 0.0);  // Seed coords (x, y), shape ID (z), initial distance (a)
}`;
