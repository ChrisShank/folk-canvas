import { frag, vert } from '../utils/tags.ts';

export class DistanceFieldGPU extends HTMLElement {
  static tagName = 'distance-field-gpu';

  static define() {
    customElements.define(this.tagName, this);
  }

  private canvas!: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private displayProgram: WebGLProgram;
  private framebuffer: WebGLFramebuffer;
  private textures: WebGLTexture[] = [];
  private pingPongIndex: number = 0;
  private fullscreenQuadVAO: WebGLVertexArrayObject;

  // Get all geometry elements
  private geometries: NodeListOf<Element>;

  private seedData: Float32Array;
  private offsets: Float32Array;

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

    // Initialize seed points from geometries
    this.initSeedPoints();

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
    // Re-initialize seed points and rerun JFA
    this.initSeedPoints();
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
    uniform float u_stepSize;
    uniform vec2 u_resolution;
    uniform vec2 u_offsets[9];

    void main() {
      // Start with the current texel's nearest seed point and distance
      vec4 nearest = texture(u_previousTexture, v_texCoord);
      
      // Calculate the distance from the current texel to its nearest seed point
      float minDist = length(nearest.xy - v_texCoord);

      for (int i = 0; i < 9; ++i) {
        vec2 sampleCoord = v_texCoord + u_offsets[i];

        // Optionally clamp sampleCoord if outside [0, 1] range (if wrap mode is not CLAMP_TO_EDGE)
        // sampleCoord = clamp(sampleCoord, vec2(0.0), vec2(1.0));

        vec4 sampled = texture(u_previousTexture, sampleCoord);

        // Compute distance to the seed point stored in this neighbor
        float dist = length(sampled.xy - v_texCoord);

        if (dist < minDist) {
          nearest = sampled;
          minDist = dist;
        }
      }

      // Update the distance in the alpha channel
      nearest.a = minDist;

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
        
        // Debug visualization:
        // Red channel: x coordinate
        // Green channel: y coordinate
        // Blue channel: the value we set to 1.0 for seed points
        // Alpha channel: distance value
        outColor = vec4(texel.rgb, 1.0);
        
        // If this is a seed point (distance == 0), make it bright yellow
        if (texel.a == 0.0) {
            outColor = vec4(1.0, 1.0, 0.0, 1.0);
        }
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

      // Use gl.RGBA16F and gl.FLOAT
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F, // Internal format
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

  private initSeedPoints() {
    const gl = this.gl;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Initialize the data array once
    if (!this.seedData || this.seedData.length !== width * height * 4) {
      this.seedData = new Float32Array(width * height * 4);
    }

    const data = this.seedData;

    // Initialize all pixels to a default seed point far away
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 0] = 0.0; // Seed point x (set to a placeholder value)
      data[i * 4 + 1] = 0.0; // Seed point y (set to a placeholder value)
      data[i * 4 + 2] = 0.0; // Unused
      data[i * 4 + 3] = 99999.0; // Large initial distance
    }

    // Initialize seed points from geometries
    this.geometries.forEach((geometry) => {
      const rect = geometry.getBoundingClientRect();

      // Transform to texture coordinate space
      const x = (rect.x + rect.width / 2) / window.innerWidth;
      const y = 1.0 - (rect.y + rect.height / 2) / window.innerHeight;

      // Calculate pixel indices
      const pixelX = Math.floor(x * width);
      const pixelY = Math.floor(y * height);

      const index = (pixelY * width + pixelX) * 4;
      data[index + 0] = x; // Seed point x
      data[index + 1] = y; // Seed point y
      data[index + 2] = 0.0; // Unused
      data[index + 3] = 0.0; // Distance is zero at seed points
    });

    // Upload data to the input texture only
    const inputTexture = this.textures[this.pingPongIndex % 2];
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
  }

  private runJFA() {
    let stepSize = Math.pow(2, Math.floor(Math.log2(Math.max(this.canvas.width, this.canvas.height))));

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

    // Set uniforms
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_stepSize'), stepSize);
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_resolution'), this.canvas.width, this.canvas.height);

    // Adjust offsets based on step size and resolution
    const adjustedOffsets = this.offsets.map((v, index) => {
      const isX = index % 2 === 0; // Even index: x offset, Odd index: y offset
      const resolution = isX ? this.canvas.width : this.canvas.height;
      return (v * stepSize) / resolution;
    });

    // Set the offsets uniform
    const offsetsLocation = gl.getUniformLocation(this.program, 'u_offsets');
    gl.uniform2fv(offsetsLocation, adjustedOffsets);

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
