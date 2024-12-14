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

  private texturesEven: WebGLTexture[] = [];
  private texturesOdd: WebGLTexture[] = [];

  private canvas!: HTMLCanvasElement;
  private glContext!: WebGL2RenderingContext;
  private framebuffer!: WebGLFramebuffer;
  private fullscreenQuadVAO!: WebGLVertexArrayObject;
  private shapeVAOEven!: WebGLVertexArrayObject;
  private shapeVAOOdd!: WebGLVertexArrayObject;

  private jfaProgram!: WebGLProgram; // Shader program for the Jump Flooding Algorithm
  private renderProgram!: WebGLProgram; // Shader program for final rendering
  private seedProgram!: WebGLProgram; // Shader program for rendering seed points

  private positionBufferEven: WebGLBuffer | null = null;
  private positionBufferOdd: WebGLBuffer | null = null;

  private isPingTextureEven: boolean = true;
  private isPingTextureOdd: boolean = true;

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

    // Create framebuffer object
    this.framebuffer = gl.createFramebuffer();
    if (!this.framebuffer) {
      throw new Error('Failed to create framebuffer.');
    }
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
   * Now supports separate textures for even and odd distance fields.
   */
  private initPingPongTextures() {
    // Initialize textures for even distance field
    this.texturesEven = this.createPingPongTextures();

    // Initialize textures for odd distance field
    this.texturesOdd = this.createPingPongTextures();
  }

  /**
   * Utility method to create ping-pong textures.
   */
  private createPingPongTextures(): WebGLTexture[] {
    const gl = this.glContext;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const textures: WebGLTexture[] = [];

    // Enable the EXT_color_buffer_half_float extension for high-precision floating-point textures
    const ext = gl.getExtension('EXT_color_buffer_half_float');
    if (!ext) {
      console.error('EXT_color_buffer_half_float extension is not supported.');
      return textures;
    }

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

      textures.push(texture);
    }

    return textures;
  }

  /**
   * Initializes rendering of seed points (shapes) into textures.
   * Separates seed points into even and odd groups.
   */
  private populateSeedPoints() {
    const gl = this.glContext;
    const positionsEven: number[] = [];
    const positionsOdd: number[] = [];

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
      const rectPositions = [
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
        shapeID,
      ];

      if (index % 2 === 0) {
        // Even index
        positionsEven.push(...rectPositions);
      } else {
        // Odd index
        positionsOdd.push(...rectPositions);
      }
    });

    // Initialize buffers and VAOs for even seed points
    if (!this.shapeVAOEven) {
      this.shapeVAOEven = gl.createVertexArray()!;
      gl.bindVertexArray(this.shapeVAOEven);
      this.positionBufferEven = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBufferEven);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionsEven), gl.DYNAMIC_DRAW);

      const positionLocation = gl.getAttribLocation(this.seedProgram, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBufferEven!);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positionsEven));
    }

    // Initialize buffers and VAOs for odd seed points
    if (!this.shapeVAOOdd) {
      this.shapeVAOOdd = gl.createVertexArray()!;
      gl.bindVertexArray(this.shapeVAOOdd);
      this.positionBufferOdd = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBufferOdd);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionsOdd), gl.DYNAMIC_DRAW);

      const positionLocation = gl.getAttribLocation(this.seedProgram, 'a_position');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBufferOdd!);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(positionsOdd));
    }

    // Render the seed points into the textures
    this.renderSeedPoints(positionsEven.length / 3, positionsOdd.length / 3);
  }

  /**
   * Renders the seed points (shapes) into their respective textures for both even and odd groups.
   */
  private renderSeedPoints(vertexCountEven: number, vertexCountOdd: number) {
    // Render even seed points
    this.renderSeedPointsForGroup(
      this.shapeVAOEven,
      this.texturesEven[this.isPingTextureEven ? 0 : 1],
      vertexCountEven
    );

    // Render odd seed points
    this.renderSeedPointsForGroup(this.shapeVAOOdd, this.texturesOdd[this.isPingTextureOdd ? 0 : 1], vertexCountOdd);
  }

  /**
   * Utility method to render seed points for a given group.
   */
  private renderSeedPointsForGroup(vao: WebGLVertexArrayObject, seedTexture: WebGLTexture, vertexCount: number) {
    const gl = this.glContext;

    // Bind framebuffer to render to the seed texture
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
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    gl.bindVertexArray(null);

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Executes the Jump Flooding Algorithm (JFA) separately for even and odd distance fields.
   */
  private runJumpFloodingAlgorithm() {
    // Compute initial step size
    let stepSize = 1 << Math.floor(Math.log2(Math.max(this.canvas.width, this.canvas.height)));

    // Perform passes with decreasing step sizes for even distance field
    for (let size = stepSize; size >= 1; size >>= 1) {
      this.renderPass(size, this.texturesEven, this.isPingTextureEven);
      this.isPingTextureEven = !this.isPingTextureEven;
    }

    // Perform passes with decreasing step sizes for odd distance field
    for (let size = stepSize; size >= 1; size >>= 1) {
      this.renderPass(size, this.texturesOdd, this.isPingTextureOdd);
      this.isPingTextureOdd = !this.isPingTextureOdd;
    }

    // Render the final result to the screen
    this.renderToScreen();
  }

  /**
   * Performs a single pass of the Jump Flooding Algorithm with a given step size for a specific distance field.
   */
  private renderPass(stepSize: number, textures: WebGLTexture[], isPingTexture: boolean) {
    const gl = this.glContext;

    // Swap textures for ping-pong rendering
    const inputTexture = isPingTexture ? textures[0] : textures[1];
    const outputTexture = isPingTexture ? textures[1] : textures[0];

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

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Renders the final distance field to the screen using the render shader program.
   * Combines both distance fields using a 'soft merge' function.
   */
  private renderToScreen() {
    const gl = this.glContext;

    // Unbind framebuffer to render directly to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Use the render shader program
    gl.useProgram(this.renderProgram);

    // Bind the final texture from even distance field
    const finalTextureEven = this.texturesEven[this.isPingTextureEven ? 0 : 1];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTextureEven);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_textureEven'), 0);

    // Bind the final texture from odd distance field
    const finalTextureOdd = this.texturesOdd[this.isPingTextureOdd ? 0 : 1];
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, finalTextureOdd);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_textureOdd'), 1);

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
    this.texturesEven.forEach((texture) => gl.deleteTexture(texture));
    this.texturesEven = [];
    this.texturesOdd.forEach((texture) => gl.deleteTexture(texture));
    this.texturesOdd = [];

    // Delete framebuffer
    if (this.framebuffer) {
      gl.deleteFramebuffer(this.framebuffer);
    }

    // Delete VAOs
    if (this.fullscreenQuadVAO) {
      gl.deleteVertexArray(this.fullscreenQuadVAO);
    }
    if (this.shapeVAOEven) {
      gl.deleteVertexArray(this.shapeVAOEven);
    }
    if (this.shapeVAOOdd) {
      gl.deleteVertexArray(this.shapeVAOOdd);
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

#define DEBUG_MODULO true
#define FALLOFF_FACTOR 10.0
#define SMOOTHING_FACTOR 0.1
#define MERGE_DISTANCES true

in vec2 v_texCoord;
out vec4 outColor;

uniform sampler2D u_textureEven;
uniform sampler2D u_textureOdd;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Smooth minimum function
float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  vec4 texelEven = texture(u_textureEven, v_texCoord);
  vec4 texelOdd = texture(u_textureOdd, v_texCoord);

  // Extract shape IDs and distances
  float shapeIDEven = texelEven.z;
  float distanceEven = texelEven.a;

  float shapeIDOdd = texelOdd.z;
  float distanceOdd = texelOdd.a;

  // Compute colors for both shapes first
  float hueEven = fract(shapeIDEven * 0.61803398875);
  vec3 colorEven = hsv2rgb(vec3(hueEven, 0.5, 0.95));

  float hueOdd = fract(shapeIDOdd * 0.61803398875);
  vec3 colorOdd = hsv2rgb(vec3(hueOdd, 0.5, 0.95));

  float mergedDistance;
  vec3 mergedColor;

  if (MERGE_DISTANCES) {
    // Use smooth minimum to merge distances
    mergedDistance = smoothMin(distanceEven, distanceOdd, SMOOTHING_FACTOR);
    
    // Calculate blend factor using the same smoothing parameter
    float h = clamp(0.5 + 0.5 * (distanceOdd - distanceEven) / SMOOTHING_FACTOR, 0.0, 1.0);
    
    // Interpolate between the two colors
    mergedColor = mix(colorOdd, colorEven, h);
  } else {
    // Simply use the closest distance and its corresponding color
    if (distanceEven <= distanceOdd) {
      mergedDistance = distanceEven;
      mergedColor = colorEven;
    } else {
      mergedDistance = distanceOdd;
      mergedColor = colorOdd;
    }
  }

  vec3 finalColor = mergedColor;

  if (DEBUG_MODULO) {
    // Visualize distance bands using modulo
    float bandWidth = 0.02; // Adjust this value to change the width of the bands
    float distanceBand = mod(mergedDistance, bandWidth) / bandWidth;
    
    // Create alternating black and white bands
    float bandColor = step(0.1, distanceBand);
    
    // Mix the band visualization with the merged color
    finalColor = mix(vec3(0.0), mergedColor, bandColor);
  }

  // Apply intensity-based falloff (from pre-pretty commit)
  float intensity = exp(-mergedDistance * FALLOFF_FACTOR);
  finalColor *= intensity;

  outColor = vec4(finalColor, 1.0);
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
