import { frag, vert } from '../utils/tags.ts';

/** Previously used a CPU-based implementation. https://github.com/folk-canvas/folk-canvas/commit/fdd7fb9d84d93ad665875cad25783c232fd17bcc */
export class DistanceFieldGPU extends HTMLElement {
  static tagName = 'distance-field-gpu';

  static define() {
    customElements.define(this.tagName, this);
  }

  private geometries: NodeListOf<Element>;
  private textures: WebGLTexture[] = [];
  private pingPongIndex: number = 0;

  private offsets!: Float32Array;
  private canvas!: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private displayProgram!: WebGLProgram;
  private seedProgram!: WebGLProgram;
  private framebuffer!: WebGLFramebuffer;
  private fullscreenQuadVAO!: WebGLVertexArrayObject;
  private shapeVAO!: WebGLVertexArrayObject;

  constructor() {
    super();

    this.geometries = document.querySelectorAll('fc-geometry');

    const { gl } = this.createWebGLCanvas(window.innerWidth, window.innerHeight);

    if (!gl) {
      return;
    }
    this.gl = gl;

    // Initialize shaders
    this.initShaders();

    // Initialize textures and framebuffer for ping-pong rendering
    this.initPingPongTextures();

    // Initialize seed point rendering
    this.initSeedPointRendering();

    // Start the JFA process
    this.runJFA();
  }

  // Lifecycle hooks
  connectedCallback() {
    // Update distance field when geometries move or resize
    this.geometries.forEach((geometry) => {
      geometry.addEventListener('move', this.handleGeometryUpdate);
      geometry.addEventListener('resize', this.handleGeometryUpdate);
    });
  }

  disconnectedCallback() {
    // Remove event listeners
    this.geometries.forEach((geometry) => {
      geometry.removeEventListener('move', this.handleGeometryUpdate);
      geometry.removeEventListener('resize', this.handleGeometryUpdate);
    });
  }

  // Handle updates from geometries
  private handleGeometryUpdate = () => {
    console.log('handleGeometryUpdate');
    // Re-render seed points and rerun JFA
    this.initSeedPointRendering();
    this.runJFA();
  };

  private createWebGLCanvas(width: number, height: number) {
    this.canvas = document.createElement('canvas');

    // Set canvas styles
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '-1';

    this.canvas.width = width;
    this.canvas.height = height;

    // Initialize WebGL2 context
    const gl = this.canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 is not available.');
      return {};
    }

    this.appendChild(this.canvas);
    return { gl };
  }

  private initShaders() {
    const gl = this.gl;

    // Shader sources
    const vertexShaderSource = vert`#version 300 es
    precision highp float;
    in vec2 a_position;
    out vec2 v_texCoord;

    void main() {
      v_texCoord = a_position * 0.5 + 0.5; // Transform to [0, 1] range
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

    const fragmentShaderSource = frag`#version 300 es
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

    const displayVertexShaderSource = vert`#version 300 es
    in vec2 a_position;
    out vec2 v_texCoord;

    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

    const displayFragmentShaderSource = frag`#version 300 es
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

    // Compute offsets on the CPU
    const offsets = [];
    for (let y = -1; y <= 1; y++) {
      for (let x = -1; x <= 1; x++) {
        offsets.push(x, y);
      }
    }

    this.offsets = new Float32Array(offsets);

    // Compile JFA shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = this.createProgram(vertexShader, fragmentShader);

    // Compile display shaders
    const displayVertexShader = this.createShader(gl.VERTEX_SHADER, displayVertexShaderSource);
    const displayFragmentShader = this.createShader(gl.FRAGMENT_SHADER, displayFragmentShaderSource);
    this.displayProgram = this.createProgram(displayVertexShader, displayFragmentShader);
  }

  private createShader(type: GLenum, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!success) {
      console.error('Could not compile shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error('Shader compilation failed');
    }
    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const gl = this.gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
      console.error('Program failed to link:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      throw new Error('Program linking failed');
    }
    return program;
  }

  private initPingPongTextures() {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

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

    // Create framebuffer
    this.framebuffer = gl.createFramebuffer()!;
  }

  private initSeedPointRendering() {
    const gl = this.gl;

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
    uniform vec2 u_resolution;

    out vec4 outColor;

    void main() {
      vec2 seedCoord = gl_FragCoord.xy / u_resolution;
      outColor = vec4(seedCoord, v_shapeID, 0.0);  // Seed coords, shape ID, initial distance 0
    }`;

    // Compile seed shaders
    const seedVertexShader = this.createShader(gl.VERTEX_SHADER, seedVertexShaderSource);
    const seedFragmentShader = this.createShader(gl.FRAGMENT_SHADER, seedFragmentShaderSource);
    this.seedProgram = this.createProgram(seedVertexShader, seedFragmentShader);

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

    const positionLocation = gl.getAttribLocation(this.seedProgram, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Render the seed points into the texture
    this.renderSeedPoints();
  }

  private renderSeedPoints() {
    const gl = this.gl;

    // Bind framebuffer to render to the seed texture
    const seedTexture = this.textures[this.pingPongIndex % 2];
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, seedTexture, 0);

    // Clear the texture with a large initial distance
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 99999.0); // Max initial distance
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use seed shader program
    gl.useProgram(this.seedProgram);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(this.seedProgram, 'u_resolution'), this.canvas.width, this.canvas.height);

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
    const gl = this.gl;

    // Swap textures for ping-pong rendering
    const inputTexture = this.textures[this.pingPongIndex % 2];
    const outputTexture = this.textures[(this.pingPongIndex + 1) % 2];

    // Bind framebuffer to output texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('Framebuffer is incomplete:', status.toString(16));
      return;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Use shader program
    gl.useProgram(this.program);

    // Adjust offsets based on step size and resolution
    const adjustedOffsets = [];
    for (let i = 0; i < this.offsets.length; i += 2) {
      const offsetX = (this.offsets[i] * stepSize) / this.canvas.width;
      const offsetY = (this.offsets[i + 1] * stepSize) / this.canvas.height;
      adjustedOffsets.push(offsetX, offsetY);
    }

    // Set the offsets uniform
    const offsetsLocation = gl.getUniformLocation(this.program, 'u_offsets');
    gl.uniform2fv(offsetsLocation, new Float32Array(adjustedOffsets));

    // Bind input texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_previousTexture'), 0);

    // Draw a fullscreen quad
    this.drawFullscreenQuad();

    // Swap ping-pong index
    this.pingPongIndex++;
  }

  private renderToScreen() {
    const gl = this.gl;

    // Unbind framebuffer to render to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Use display shader program
    gl.useProgram(this.displayProgram);

    // Bind the final texture
    const finalTexture = this.textures[this.pingPongIndex % 2];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTexture);
    gl.uniform1i(gl.getUniformLocation(this.displayProgram, 'u_texture'), 0);

    // Draw a fullscreen quad
    this.drawFullscreenQuad();
  }

  private drawFullscreenQuad() {
    const gl = this.gl;

    // Initialize VAO if not already done
    if (!this.fullscreenQuadVAO) {
      this.initFullscreenQuad();
    }

    gl.bindVertexArray(this.fullscreenQuadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  private initFullscreenQuad() {
    const gl = this.gl;

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

    this.fullscreenQuadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.fullscreenQuadVAO);

    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(this.program, 'a_position');
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
}
