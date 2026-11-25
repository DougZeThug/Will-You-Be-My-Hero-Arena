// Dynamic sticker border. The character is drawn into an offscreen target; the
// border is then built from the alpha of that UNION silhouette (a disc
// dilation of constant width) and drawn under it. Nothing white is baked into
// the layers any more, so the border can neither stretch with a mesh nor end
// up inside the figure where an arm crosses the torso.
const VS = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
// 4 rings x 16 directions. The outer ring alone would leave gaps for wide
// borders; the inner rings fill them. One-pixel soft edge.
const FS = `
precision mediump float;
uniform sampler2D source;
uniform vec2 texel;
uniform float radius;
uniform vec3 colour;
varying vec2 vUv;
void main() {
  vec4 figure = texture2D(source, vUv);
  float reach = 0.0;
  for (int ring = 1; ring <= 4; ring++) {
    float r = radius * float(ring) / 4.0;
    for (int k = 0; k < 16; k++) {
      float a = 6.2831853 * (float(k) + 0.5 * float(ring)) / 16.0;
      reach = max(reach, texture2D(source, vUv + vec2(cos(a), sin(a)) * r * texel).a);
    }
  }
  float border = smoothstep(0.35, 0.65, reach) * (1.0 - figure.a);
  gl_FragColor = figure + vec4(colour * border, border);
}`;

export interface OutlineSpec {
  /** Border width in metres of the character. */
  width: number;
  /** 0..255 */
  colour: [number, number, number];
}

export class OutlineTarget {
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly quad: WebGLBuffer;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly texture: WebGLTexture;
  private width = 0;
  private height = 0;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'outline shader');
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, 'position');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'outline link');
    this.program = program;
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.framebuffer = gl.createFramebuffer()!;
    this.texture = gl.createTexture()!;
  }

  /** Redirect drawing into the offscreen target (cleared, canvas-sized). */
  begin(): void {
    const gl = this.gl,
      w = gl.drawingBufferWidth,
      h = gl.drawingBufferHeight;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Composite the target, with its border, over the canvas. `radius` in canvas px. */
  end(radius: number, colour: [number, number, number]): void {
    const gl = this.gl,
      program = this.program;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disableVertexAttribArray(1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(program, 'source'), 0);
    gl.uniform2f(gl.getUniformLocation(program, 'texel'), 1 / this.width, 1 / this.height);
    gl.uniform1f(gl.getUniformLocation(program, 'radius'), radius);
    gl.uniform3f(gl.getUniformLocation(program, 'colour'), colour[0] / 255, colour[1] / 255, colour[2] / 255);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
