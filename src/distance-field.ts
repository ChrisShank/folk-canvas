import { frag, vert } from './utils/tags.ts';
import { WebGLUtils } from './utils/webgl.ts';

/** Previously used a CPU-based implementation. https://github.com/folk-canvas/folk-canvas/commit/fdd7fb9d84d93ad665875cad25783c232fd17bcc */
export class DistanceField extends HTMLElement {
  static tagName = 'distance-field';

  private geometries: NodeListOf<Element>;
  private textures: WebGLTexture[] = [];
  private pingPongIndex: number = 0;

  private canvas!: HTMLCanvasElement;
  private glContext!: WebGL2RenderingContext;
  private framebuffer!: WebGLFramebuffer;
  private fullscreenQuadVAO!: WebGLVertexArrayObject;
  private shapeVAO!: WebGLVertexArrayObject;

  private jfaProgram!: WebGLProgram; // Jump Flooding Algorithm shader program
  private renderProgram!: WebGLProgram; // Final rendering shader program
  private seedProgram!: WebGLProgram; // Seed point shader program

  private static readonly MAX_DISTANCE = 99999.0;

  constructor() {
    super();

    this.geometries = document.querySelectorAll('fc-geometry');

    const { gl, canvas } = WebGLUtils.createWebGLCanvas(window.innerWidth, window.innerHeight, this);

    if (!gl || !canvas) {
      console.error('Failed to initialize WebGL context.');
      return;
    }

    this.canvas = canvas;
    this.glContext = gl;

    // Initialize shaders
    this.initShaders();

    // Initialize textures and framebuffer for ping-pong rendering
    this.initPingPongTextures();

    // Initialize seed point rendering
    this.initSeedPointRendering();

    // Start the JFA process
    this.runJFA();
  }

  static define() {
    customElements.define(this.tagName, this);
  }

  connectedCallback() {
    window.addEventListener('resize', this.handleResize);
    this.geometries.forEach((geometry) => {
      geometry.addEventListener('move', this.handleGeometryUpdate);
      geometry.addEventListener('resize', this.handleGeometryUpdate);
    });
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.handleResize);
    this.geometries.forEach((geometry) => {
      geometry.removeEventListener('move', this.handleGeometryUpdate);
      geometry.removeEventListener('resize', this.handleGeometryUpdate);
    });
    this.cleanupWebGLResources();
  }

  private handleGeometryUpdate = () => {
    this.initSeedPointRendering();
    this.runJFA();
  };

  private initShaders() {
    this.jfaProgram = WebGLUtils.createShaderProgram(this.glContext, jfaVertShader, jfaFragShader);
    this.seedProgram = WebGLUtils.createShaderProgram(this.glContext, seedVertexShaderSource, seedFragmentShaderSource);
    this.renderProgram = WebGLUtils.createShaderProgram(this.glContext, renderVertShader, renderFragShader);
  }

  private initPingPongTextures() {
    const gl = this.glContext;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Delete existing textures to prevent memory leaks
    for (const texture of this.textures) {
      gl.deleteTexture(texture);
    }
    this.textures = [];

    // Enable the EXT_color_buffer_float extension
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.error('EXT_color_buffer_float extension is not supported.');
      return;
    }

    for (let i = 0; i < 2; i++) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // Set texture parameters
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Use gl.RGBA32F and gl.FLOAT for higher precision
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F, // Internal format
        width,
        height,
        0,
        gl.RGBA, // Format
        gl.FLOAT, // Type
        null
      );

      this.textures.push(texture);
    }

    // Reuse existing framebuffer
    if (!this.framebuffer) {
      this.framebuffer = gl.createFramebuffer()!;
    }
  }

  private initSeedPointRendering() {
    const gl = this.glContext;

    // Set up VAO and buffer for shapes
    this.shapeVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.shapeVAO);
    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Collect positions and shape IDs for all shapes
    const positions: number[] = [];
    this.geometries.forEach((geometry, index) => {
      const rect = geometry.getBoundingClientRect();

      // Convert to Normalized Device Coordinates (NDC)
      const x1 = (rect.left / window.innerWidth) * 2 - 1;
      const y1 = -((rect.top / window.innerHeight) * 2 - 1);
      const x2 = (rect.right / window.innerWidth) * 2 - 1;
      const y2 = -((rect.bottom / window.innerHeight) * 2 - 1);

      const shapeID = index + 1; // Avoid zero to prevent hash function issues

      // Two triangles per rectangle, include shapeID as z component
      positions.push(
        x1,
        y1,
        shapeID,
        x2,
        y1,
        shapeID,
        x1,
        y2,
        shapeID,

        x1,
        y2,
        shapeID,
        x2,
        y1,
        shapeID,
        x2,
        y2,
        shapeID
      );
    });

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.useProgram(this.seedProgram);
    const positionLocation = gl.getAttribLocation(this.seedProgram, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Render the seed points into the texture
    this.renderSeedPoints();
  }

  private renderSeedPoints() {
    const gl = this.glContext;

    // Bind framebuffer to render to the seed texture
    const seedTexture = this.textures[this.pingPongIndex % 2];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, seedTexture, 0);

    // Clear the texture with a large initial distance
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, DistanceField.MAX_DISTANCE);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use seed shader program
    gl.useProgram(this.seedProgram);

    // Set the canvas size uniform
    const canvasSizeLocation = gl.getUniformLocation(this.seedProgram, 'u_canvasSize');
    gl.uniform2f(canvasSizeLocation, this.canvas.width, this.canvas.height);

    // Bind VAO and draw shapes
    gl.bindVertexArray(this.shapeVAO);
    gl.drawArrays(gl.TRIANGLES, 0, this.geometries.length * 6);

    // Unbind VAO and framebuffer
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private runJFA() {
    const maxDimension = Math.max(this.canvas.width, this.canvas.height);
    let stepSize = Math.pow(2, Math.floor(Math.log2(maxDimension)));

    const minStepSize = 1;

    while (stepSize >= minStepSize) {
      this.renderPass(stepSize);
      stepSize = Math.floor(stepSize / 2);
    }

    this.renderToScreen();
  }

  private renderPass(stepSize: number) {
    const gl = this.glContext;

    // Swap textures for ping-pong rendering
    const inputTexture = this.textures[this.pingPongIndex % 2];
    const outputTexture = this.textures[(this.pingPongIndex + 1) % 2];

    // Bind framebuffer to output texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);

    // Use shader program
    gl.useProgram(this.jfaProgram);

    // Compute and set the offsets uniform
    const offsets = this.computeOffsets(stepSize);
    const offsetsLocation = gl.getUniformLocation(this.jfaProgram, 'u_offsets');
    gl.uniform2fv(offsetsLocation, offsets);

    // Bind input texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(gl.getUniformLocation(this.jfaProgram, 'u_previousTexture'), 0);

    this.drawFullscreenQuad();

    // Swap ping-pong index
    this.pingPongIndex++;
  }

  private renderToScreen() {
    const gl = this.glContext;

    // Unbind framebuffer to render to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Use display shader program
    gl.useProgram(this.renderProgram);

    // Bind the final texture
    const finalTexture = this.textures[this.pingPongIndex % 2];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTexture);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, 'u_texture'), 0);

    // Draw a fullscreen quad
    this.drawFullscreenQuad();
  }

  private drawFullscreenQuad() {
    const gl = this.glContext;

    if (!this.fullscreenQuadVAO) {
      this.initFullscreenQuad();
    }

    gl.bindVertexArray(this.fullscreenQuadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private initFullscreenQuad() {
    const gl = this.glContext;

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
      2, // size
      gl.FLOAT, // type
      false, // normalize
      0, // stride
      0 // offset
    );

    gl.bindVertexArray(null);
  }

  // Handle window resize
  private handleResize = () => {
    const gl = this.glContext;

    // Update canvas size
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Update the viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Re-initialize textures with the new dimensions
    this.initPingPongTextures();

    // Re-initialize seed point rendering to update positions
    this.initSeedPointRendering();

    // Rerun JFA
    this.runJFA();
  };

  private computeOffsets(stepSize: number): Float32Array {
    const offsets = [];
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        offsets.push((x * stepSize) / this.canvas.width, (y * stepSize) / this.canvas.height);
      }
    }
    return new Float32Array(offsets);
  }

  private cleanupWebGLResources() {
    const gl = this.glContext;

    // Delete textures
    this.textures.forEach((texture) => gl.deleteTexture(texture));
    this.textures = [];

    // Delete framebuffers
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

    if (this.jfaProgram) {
      gl.deleteProgram(this.jfaProgram);
    }
    if (this.renderProgram) {
      gl.deleteProgram(this.renderProgram);
    }
    if (this.seedProgram) {
      gl.deleteProgram(this.seedProgram);
    }

    // Clear other references
    this.geometries = null!;
  }
}

const jfaVertShader = vert`#version 300 es
    precision highp float;
    in vec2 a_position;
    out vec2 v_texCoord;

    void main() {
      v_texCoord = a_position * 0.5 + 0.5; // Transform to [0, 1] range
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

const jfaFragShader = frag`#version 300 es
    precision highp float;
    precision mediump int;

    in vec2 v_texCoord;
    out vec4 outColor;

    uniform sampler2D u_previousTexture;
    uniform vec2 u_offsets[9];

    void main() {
      // Start with the current texel's nearest seed point and distance
      vec4 nearest = texture(u_previousTexture, v_texCoord);

      // Initialize minDist with the current distance
      float minDist = nearest.a;

      // Loop through neighbor offsets
      for (int i = 0; i < 9; ++i) {
        vec2 sampleCoord = v_texCoord + u_offsets[i];

        // Clamp sampleCoord to [0, 1] to prevent sampling outside texture
        sampleCoord = clamp(sampleCoord, vec2(0.0), vec2(1.0));

        vec4 sampled = texture(u_previousTexture, sampleCoord);

        if (sampled.z == 0.0) {
          continue; // Skip background pixels
        }

        // Compute distance to the seed point stored in this neighbor
        float dist = distance(sampled.xy, v_texCoord);

        if (dist < minDist) {
          nearest = sampled;
          nearest.a = dist;
          minDist = dist;
        }
      }

      // Output the nearest seed point and updated distance
      outColor = nearest;
    }`;

const renderVertShader = vert`#version 300 es
    in vec2 a_position;
    out vec2 v_texCoord;

    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

const renderFragShader = frag`#version 300 es
    precision highp float;

    in vec2 v_texCoord;
    out vec4 outColor;

    uniform sampler2D u_texture;

    void main() {
        vec4 texel = texture(u_texture, v_texCoord);

        // Extract shape ID and distance
        float shapeID = texel.z;
        float distance = texel.a;

        // Hash-based color for shape
        vec3 shapeColor = vec3(
          fract(sin(shapeID * 12.9898) * 43758.5453),
          fract(sin(shapeID * 78.233) * 43758.5453),
          fract(sin(shapeID * 93.433) * 43758.5453)
        );

        // Visualize distance (e.g., as intensity)
        float intensity = exp(-distance * 10.0);

        outColor = vec4(shapeColor * intensity, 1.0);
    }`;

// Shader sources for seed point rendering
const seedVertexShaderSource = vert`#version 300 es
    precision highp float;

    in vec3 a_position; // x, y, shapeID
    flat out float v_shapeID;

    void main() {
      gl_Position = vec4(a_position.xy, 0.0, 1.0);
      v_shapeID = a_position.z; // Pass shape ID to fragment shader
    }`;

const seedFragmentShaderSource = frag`#version 300 es
    precision highp float;

    flat in float v_shapeID;
    uniform vec2 u_canvasSize;

    out vec4 outColor;

    void main() {
      vec2 seedCoord = gl_FragCoord.xy / u_canvasSize;
      outColor = vec4(seedCoord, v_shapeID, 0.0);  // Seed coords, shape ID, initial distance 0
    }`;
