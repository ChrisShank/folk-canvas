import { WebGLUtils } from './common/webgl';
import {
  collisionFragmentShader,
  collisionVertexShader,
  simulationShader,
  distanceFieldInitShader,
  distanceFieldPropagationShader,
  visualizationShader,
  vertexShader,
} from './folk-sand.glsl.ts';
import { FolkShape } from './folk-shape.ts';

export class FolkSand extends HTMLElement {
  static tagName = 'folk-sand';

  private canvas!: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;

  private program!: WebGLProgram;
  private blitProgram!: WebGLProgram;
  private jfaShadowProgram!: WebGLProgram;
  private jfaInitProgram!: WebGLProgram;

  private vao!: WebGLVertexArrayObject;
  private posBuffer!: WebGLBuffer;

  private bufferWidth!: number;
  private bufferHeight!: number;

  private fbo: WebGLFramebuffer[] = [];
  private tex: WebGLTexture[] = [];

  private shadowFbo: WebGLFramebuffer[] = [];
  private shadowTexR: WebGLTexture[] = [];
  private shadowTexG: WebGLTexture[] = [];
  private shadowTexB: WebGLTexture[] = [];

  private pointer = {
    x: -1,
    y: -1,
    prevX: -1,
    prevY: -1,
    down: false,
  };

  private materialType = 4;
  private brushRadius = 5;

  private shapes: NodeListOf<FolkShape> = document.querySelectorAll('folk-shape');

  private frames = 0;
  private swap = 0;
  private shadowSwap = 0;

  private PIXELS_PER_PARTICLE = 4;
  private PIXEL_RATIO = window.devicePixelRatio || 1;

  private collisionProgram!: WebGLProgram;
  private collisionFbo!: WebGLFramebuffer;
  private collisionTex!: WebGLTexture;
  private shapeVao!: WebGLVertexArrayObject;
  private shapePositionBuffer!: WebGLBuffer;
  private shapeIndexBuffer!: WebGLBuffer;
  private shapeIndexCount = 0;

  static define() {
    if (customElements.get(this.tagName)) return;
    FolkShape.define();
    customElements.define(this.tagName, this);
  }

  connectedCallback() {
    this.setupCanvas();
    this.initializeWebGL();
    this.initializeSimulation();
    this.initializeCollisionDetection();

    // Collect all FolkShape elements
    this.shapes = document.querySelectorAll('folk-shape');

    // Attach event listeners to shapes
    this.shapes.forEach((shape) => {
      shape.addEventListener('transform', this.handleShapeTransform);
    });

    // Initialize collision texture with current shapes
    this.collectShapeData();
    this.updateCollisionTexture();

    this.attachEventListeners();
    requestAnimationFrame(this.render.bind(this));
  }

  disconnectedCallback() {
    this.detachEventListeners();

    // Remove event listeners from shapes
    this.shapes.forEach((shape) => {
      shape.removeEventListener('transform', this.handleShapeTransform);
    });
  }

  private setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'main-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.appendChild(this.canvas);
  }

  private initializeWebGL() {
    this.gl = this.canvas.getContext('webgl2')!;
    if (!this.gl) {
      console.error('WebGL2 context not available!');
    }

    if (!this.gl.getExtension('EXT_color_buffer_float')) {
      console.error('need EXT_color_buffer_float');
    }

    if (!this.gl.getExtension('OES_texture_float_linear')) {
      console.error('need OES_texture_float_linear');
    }
  }

  private initializeSimulation() {
    const gl = this.gl;

    // Create shaders and programs
    this.program = this.createProgramFromStrings({
      vertex: vertexShader,
      fragment: simulationShader,
    })!;
    this.blitProgram = this.createProgramFromStrings({
      vertex: vertexShader,
      fragment: visualizationShader,
    })!;
    this.jfaShadowProgram = this.createProgramFromStrings({
      vertex: vertexShader,
      fragment: distanceFieldPropagationShader,
    })!;
    this.jfaInitProgram = this.createProgramFromStrings({
      vertex: vertexShader,
      fragment: distanceFieldInitShader,
    })!;

    // Setup buffers and vertex arrays
    this.setupBuffers();

    // Initialize framebuffers and textures
    this.initializeFramebuffers();
  }

  private initializeCollisionDetection() {
    const gl = this.gl;

    const collisionProgram = this.createProgramFromStrings({
      vertex: collisionVertexShader,
      fragment: collisionFragmentShader,
    });

    if (!collisionProgram) {
      console.error('Failed to create collision program');
      return;
    }

    // Create collision shader program
    this.collisionProgram = collisionProgram!;

    // Create collision texture
    this.collisionTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.collisionTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create collision framebuffer
    this.collisionFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.collisionFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.collisionTex, 0);

    // Initialize shape buffers with larger initial sizes
    this.shapeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.shapeVao);

    this.shapePositionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapePositionBuffer);
    // Allocate space for up to 100 shapes (400 vertices)
    gl.bufferData(gl.ARRAY_BUFFER, 4 * 2 * 100 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

    this.shapeIndexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shapeIndexBuffer);
    // Allocate space for up to 100 shapes (600 indices)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 6 * 100 * Uint16Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

    // Set up vertex attributes
    const posAttribLoc = gl.getAttribLocation(this.collisionProgram, 'aPosition');
    gl.enableVertexAttribArray(posAttribLoc);
    gl.vertexAttribPointer(posAttribLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Initial collection and render of shape data
    this.collectShapeData();
    this.updateCollisionTexture();
  }

  private setupBuffers() {
    const gl = this.gl;
    const quad = [-1.0, -1.0, 0.0, 0.0, -1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 0.0];

    this.posBuffer = gl.createBuffer()!;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad), gl.STATIC_DRAW);

    this.vao = gl.createVertexArray()!;

    gl.bindVertexArray(this.vao);

    const posAttribLoc = gl.getAttribLocation(this.program, 'aPosition');
    const uvAttribLoc = gl.getAttribLocation(this.program, 'aUv');

    gl.vertexAttribPointer(posAttribLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(posAttribLoc);

    gl.vertexAttribPointer(uvAttribLoc, 2, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(uvAttribLoc);
  }

  private initializeFramebuffers() {
    const gl = this.gl;

    this.resizeCanvas();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    this.bufferWidth = Math.ceil(gl.canvas.width / this.PIXELS_PER_PARTICLE);
    this.bufferHeight = Math.ceil(gl.canvas.height / this.PIXELS_PER_PARTICLE);

    // Initialize framebuffers and textures for simulation
    for (let i = 0; i < 2; i++) {
      // Create textures
      this.tex[i] = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Create framebuffers
      this.fbo[i] = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex[i], 0);

      // Setup shadow textures
      this.shadowTexR[i] = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexR[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.shadowTexG[i] = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexG[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.shadowTexB[i] = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexB[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Setup shadow framebuffers
      this.shadowFbo[i] = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.shadowTexR[i], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.shadowTexG[i], 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, this.shadowTexB[i], 0);

      // Set up draw buffers for the shadow FBO
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
    }
  }

  private attachEventListeners() {
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  private detachEventListeners() {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handlePointerMove(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Update previous position before setting new position
    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;

    // Scale coordinates relative to canvas size
    this.pointer.x = (x / rect.width) * this.canvas.width;
    this.pointer.y = (y / rect.height) * this.canvas.height;
  }

  private handlePointerDown(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scale coordinates relative to canvas size
    this.pointer.x = (x / rect.width) * this.canvas.width;
    this.pointer.y = (y / rect.height) * this.canvas.height;
    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;
    this.pointer.down = true;
  }

  private handlePointerUp() {
    this.pointer.down = false;
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = parseInt(event.key);
    if (!isNaN(key)) {
      this.setMaterialType(key);
    }
  }

  private setMaterialType(type: number) {
    this.materialType = Math.min(Math.max(type, 0), 9);
  }

  private resizeCanvas() {
    const width = (this.canvas.clientWidth * this.PIXEL_RATIO) | 0;
    const height = (this.canvas.clientHeight * this.PIXEL_RATIO) | 0;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      return true;
    }
    return false;
  }

  private render(time: number) {
    if (this.resizeCanvas()) {
      this.processResize();
    }

    this.simulationPass(time);
    this.shadowPass();
    this.jfaPass();
    this.renderPass(time);

    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;

    requestAnimationFrame(this.render.bind(this));
  }

  private renderPass(time: number) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawBuffers([gl.BACK]);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.blitProgram);
    gl.bindVertexArray(this.vao);

    const timeLoc = gl.getUniformLocation(this.blitProgram, 'time');
    const resLoc = gl.getUniformLocation(this.blitProgram, 'resolution');
    const texLoc = gl.getUniformLocation(this.blitProgram, 'tex');
    const shadowTexLoc = gl.getUniformLocation(this.blitProgram, 'shadowTexR');
    const shadowTexGLoc = gl.getUniformLocation(this.blitProgram, 'shadowTexG');
    const shadowTexBLoc = gl.getUniformLocation(this.blitProgram, 'shadowTexB');
    const scaleLoc = gl.getUniformLocation(this.blitProgram, 'scale');
    const texResLoc = gl.getUniformLocation(this.blitProgram, 'texResolution');
    const texScaleLoc = gl.getUniformLocation(this.blitProgram, 'texScale');

    gl.uniform1f(timeLoc, time * 0.001);
    gl.uniform2f(resLoc, gl.canvas.width, gl.canvas.height);
    gl.uniform2f(texResLoc, this.bufferWidth, this.bufferHeight);
    gl.uniform1f(texScaleLoc, this.PIXELS_PER_PARTICLE);
    gl.uniform1f(scaleLoc, 1.0);

    gl.uniform1i(texLoc, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.swap]);

    gl.uniform1i(shadowTexLoc, 1);
    gl.uniform1i(shadowTexGLoc, 2);
    gl.uniform1i(shadowTexBLoc, 3);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexR[1 - this.shadowSwap]);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexG[1 - this.shadowSwap]);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTexB[1 - this.shadowSwap]);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.collisionTex);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
  }

  private simulationPass(time: number) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const timeLoc = gl.getUniformLocation(this.program, 'time');
    const frameLoc = gl.getUniformLocation(this.program, 'frame');
    const resLoc = gl.getUniformLocation(this.program, 'resolution');
    const texLoc = gl.getUniformLocation(this.program, 'tex');
    const mouseLoc = gl.getUniformLocation(this.program, 'mouse');
    const materialTypeLoc = gl.getUniformLocation(this.program, 'materialType');
    const brushRadiusLoc = gl.getUniformLocation(this.program, 'brushRadius');
    const collisionTexLoc = gl.getUniformLocation(this.program, 'u_collisionTex');
    if (!collisionTexLoc) {
      console.error('Could not find u_collisionTex uniform 1');
    }
    if (collisionTexLoc !== null) {
      gl.uniform1i(collisionTexLoc, 5); // Use texture unit 5
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, this.collisionTex);
    }

    let mx = (this.pointer.x / gl.canvas.width) * this.bufferWidth;
    let my = (1.0 - this.pointer.y / gl.canvas.height) * this.bufferHeight;
    let mpx = (this.pointer.prevX / gl.canvas.width) * this.bufferWidth;
    let mpy = (1.0 - this.pointer.prevY / gl.canvas.height) * this.bufferHeight;

    let pressed = false;

    gl.uniform1f(timeLoc, time * 0.001);
    gl.uniform2f(resLoc, this.bufferWidth, this.bufferHeight);
    gl.uniform1i(materialTypeLoc, this.materialType);
    gl.uniform1f(brushRadiusLoc, this.brushRadius);

    if (this.pointer.down || pressed) gl.uniform4f(mouseLoc, mx, my, mpx, mpy);
    else gl.uniform4f(mouseLoc, -mx, -my, -mpx, -mpy);

    const PASSES = 3;
    for (let i = 0; i < PASSES; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[this.swap]);
      gl.viewport(0, 0, this.bufferWidth, this.bufferHeight);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1i(frameLoc, this.frames * PASSES + i);

      gl.uniform1i(texLoc, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[1 - this.swap]);

      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

      this.swap = 1 - this.swap;
    }

    this.frames++;
  }

  private jfaPass() {
    const gl = this.gl;
    const JFA_PASSES = 5;

    gl.useProgram(this.jfaShadowProgram);

    const resLoc = gl.getUniformLocation(this.jfaShadowProgram, 'resolution');
    const texLoc = gl.getUniformLocation(this.jfaShadowProgram, 'texR');
    const texGLoc = gl.getUniformLocation(this.jfaShadowProgram, 'texG');
    const texBLoc = gl.getUniformLocation(this.jfaShadowProgram, 'texB');
    const stepSizeLoc = gl.getUniformLocation(this.jfaShadowProgram, 'stepSize');
    const passCountLoc = gl.getUniformLocation(this.jfaShadowProgram, 'passCount');
    const passIdxLoc = gl.getUniformLocation(this.jfaShadowProgram, 'passIndex');

    gl.uniform2f(resLoc, this.bufferWidth, this.bufferHeight);
    gl.uniform1i(texLoc, 0);
    gl.uniform1i(texGLoc, 1);
    gl.uniform1i(texBLoc, 2);
    gl.uniform1i(passCountLoc, JFA_PASSES);

    for (let i = 0; i < JFA_PASSES; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo[this.shadowSwap]);
      gl.viewport(0, 0, this.bufferWidth, this.bufferHeight);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const stepSize = Math.pow(2, JFA_PASSES - i - 1);

      gl.uniform1f(stepSizeLoc, stepSize);
      gl.uniform1i(passIdxLoc, i);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexR[1 - this.shadowSwap]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexG[1 - this.shadowSwap]);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexB[1 - this.shadowSwap]);

      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

      this.shadowSwap = 1 - this.shadowSwap;
    }
  }

  private shadowPass() {
    const gl = this.gl;
    this.shadowSwap = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo[this.shadowSwap]);
    gl.viewport(0, 0, this.bufferWidth, this.bufferHeight);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.jfaInitProgram);
    gl.bindVertexArray(this.vao);

    const resLoc = gl.getUniformLocation(this.jfaInitProgram, 'resolution');
    const texLoc = gl.getUniformLocation(this.jfaInitProgram, 'dataTex');

    gl.uniform2f(resLoc, this.bufferWidth, this.bufferHeight);

    gl.uniform1i(texLoc, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[this.swap]);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    this.shadowSwap = 1 - this.shadowSwap;
  }

  private processResize() {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    this.bufferWidth = Math.ceil(gl.canvas.width / this.PIXELS_PER_PARTICLE);
    this.bufferHeight = Math.ceil(gl.canvas.height / this.PIXELS_PER_PARTICLE);

    // Update collision texture size
    gl.bindTexture(gl.TEXTURE_2D, this.collisionTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Re-render collision data after resize
    this.handleShapeTransform();

    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i]);

      const newTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, newTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindTexture(gl.TEXTURE_2D, newTex);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, this.bufferWidth, this.bufferHeight);

      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, newTex, 0);

      gl.deleteTexture(this.tex[i]);
      if (!this.tex[i]) {
        throw new Error('Failed to create texture1');
      }
      if (!newTex) {
        throw new Error('Failed to create texture2');
      }
      this.tex[i] = newTex;
    }

    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexR[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);

      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexG[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);

      gl.bindTexture(gl.TEXTURE_2D, this.shadowTexB[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.FLOAT, null);
    }
  }

  private createProgramFromStrings({
    vertex,
    fragment,
  }: {
    vertex: string;
    fragment: string;
  }): WebGLProgram | undefined {
    const vertexShader = WebGLUtils.createShader(this.gl, this.gl.VERTEX_SHADER, vertex);
    const fragmentShader = WebGLUtils.createShader(this.gl, this.gl.FRAGMENT_SHADER, fragment);

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders');
      return undefined;
    }

    return WebGLUtils.createProgram(this.gl, vertexShader, fragmentShader);
  }

  private collectShapeData() {
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    this.shapes.forEach((shape) => {
      const rect = shape.getTransformDOMRect();
      if (!rect) return;

      // Get the transformed vertices in parent space
      const transformedPoints = rect.vertices().map((point) => rect.toParentSpace(point));

      // Convert the transformed points to buffer coordinates
      const bufferPoints = transformedPoints.map((point) => this.convertToBufferCoordinates(point.x, point.y));

      // Add vertices
      bufferPoints.forEach((point) => {
        positions.push(point.x, point.y);
      });

      // Add indices for two triangles
      indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3);

      vertexOffset += 4;
    });

    const gl = this.gl;

    // Update buffers with new data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.shapePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.shapeIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.DYNAMIC_DRAW);

    this.shapeIndexCount = indices.length;
  }

  private convertToBufferCoordinates(x: number, y: number) {
    return {
      x: (x / this.clientWidth) * 2 - 1,
      y: -((y / this.clientHeight) * 2 - 1), // Flip Y coordinate
    };
  }

  private updateCollisionTexture() {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.collisionFbo);
    gl.viewport(0, 0, this.bufferWidth, this.bufferHeight);

    // Clear with transparent black (no collision)
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Disable depth testing and blending
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Use collision shader program
    gl.useProgram(this.collisionProgram);
    gl.bindVertexArray(this.shapeVao);

    // Draw all shapes
    if (this.shapeIndexCount > 0) {
      gl.drawElements(gl.TRIANGLES, this.shapeIndexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private handleShapeTransform = () => {
    // Recollect and update all shape data when any shape changes
    // TODO: do this more piecemeal
    this.collectShapeData();
    this.updateCollisionTexture();
  };
}
