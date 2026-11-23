// CPU linear-blend skinning and a minimal WebGL 1 renderer for one rig.
// Parts are drawn back to front in `order`; one draw call per character.
import type { Rig } from './rig';
import type { Skeleton } from './skeleton';

const VERTEX = `
attribute vec2 position;
attribute vec2 uv;
uniform vec4 view; // scaleX, scaleY, offsetX, offsetY in clip space
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position * view.xy + view.zw, 0.0, 1.0);
}`;
const FRAGMENT = `
precision mediump float;
uniform sampler2D atlas;
uniform float opacity;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(atlas, vUv) * opacity; // premultiplied
}`;

export interface RigView {
  /** Canvas pixel where the rig's root (ground origin) is drawn. */
  x: number;
  y: number;
  /** Canvas pixels per rig pixel. */
  scale: number;
  /** Mirror horizontally (face the other way). */
  flip?: boolean;
  opacity?: number;
}

interface PartRange {
  firstVertex: number;
  vertexCount: number;
  triangles: Uint16Array;
  visible: boolean;
}

const programs = new WeakMap<WebGLRenderingContext, WebGLProgram>();

function programFor(gl: WebGLRenderingContext): WebGLProgram {
  let program = programs.get(gl);
  if (program) return program;
  program = gl.createProgram()!;
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'position');
  gl.bindAttribLocation(program, 1, 'uv');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
  programs.set(gl, program);
  return program;
}

export class RigRenderer {
  /** Part names back to front. Reorder with `setOrder` or `swap`. */
  readonly order: string[];
  /** Skinned positions of the last `draw`, 2 floats per vertex. */
  readonly positions: Float32Array;
  private readonly gl: WebGLRenderingContext;
  private readonly rig: Rig;
  private readonly program: WebGLProgram;
  private readonly ranges: Record<string, PartRange> = {};
  private readonly bind: Float32Array;
  private readonly bones: Uint16Array;
  private readonly weights: Float32Array;
  private readonly indices: Uint16Array;
  private readonly positionBuffer: WebGLBuffer;
  private readonly uvBuffer: WebGLBuffer;
  private readonly indexBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private indexCount = 0;
  private orderDirty = true;

  constructor(gl: WebGLRenderingContext, rig: Rig) {
    this.gl = gl;
    this.rig = rig;
    this.program = programFor(gl);
    const parts = rig.data.parts,
      vertexTotal = parts.reduce((n, part) => n + part.xy.length / 2, 0),
      triangleTotal = parts.reduce((n, part) => n + part.triangles.length, 0);
    if (vertexTotal > 65535) throw new Error('rig exceeds 16-bit indices');
    this.order = parts.map((part) => part.name);
    this.positions = new Float32Array(vertexTotal * 2);
    this.bind = new Float32Array(vertexTotal * 2);
    this.bones = new Uint16Array(vertexTotal * 4);
    this.weights = new Float32Array(vertexTotal * 4);
    this.indices = new Uint16Array(triangleTotal);
    const uv = new Float32Array(vertexTotal * 2);
    let first = 0;
    for (const part of parts) {
      const count = part.xy.length / 2;
      this.bind.set(part.xy, first * 2);
      uv.set(part.uv, first * 2);
      this.bones.set(part.bones, first * 4);
      this.weights.set(part.weights, first * 4);
      this.ranges[part.name] = {
        firstVertex: first,
        vertexCount: count,
        triangles: Uint16Array.from(part.triangles, (i) => i + first),
        visible: part.visible,
      };
      first += count;
    }
    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
    this.uvBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    this.indexBuffer = gl.createBuffer()!;
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rig.image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  setVisible(part: string, visible: boolean): this {
    const range = this.range(part);
    if (range.visible !== visible) {
      range.visible = visible;
      this.orderDirty = true;
    }
    return this;
  }

  /** Show one member of a group (e.g. `show('hand', 'hand_open')`). */
  show(group: string, part: string): this {
    for (const candidate of this.rig.data.parts)
      if (candidate.group === group)
        this.setVisible(candidate.name, candidate.name === part);
    return this;
  }

  /** Replace the whole back-to-front order (must name every part once). */
  setOrder(names: readonly string[]): this {
    if (
      names.length !== this.order.length ||
      names.some((name) => !this.ranges[name]) ||
      new Set(names).size !== names.length
    )
      throw new Error('setOrder needs every part exactly once');
    this.order.splice(0, this.order.length, ...names);
    this.orderDirty = true;
    return this;
  }

  /** Exchange two parts' places in the draw order. */
  swap(a: string, b: string): this {
    const i = this.order.indexOf(a),
      j = this.order.indexOf(b);
    if (i < 0 || j < 0) throw new Error(`no part ${i < 0 ? a : b}`);
    this.order[i] = b;
    this.order[j] = a;
    this.orderDirty = true;
    return this;
  }

  /** Skin on the CPU into `positions` (root space). `draw` calls this. */
  skin(skeleton: Skeleton): void {
    const { bind, bones, weights, positions } = this,
      m = skeleton.skin;
    for (const name of this.order) {
      const range = this.ranges[name];
      if (!range.visible) continue;
      const end = range.firstVertex + range.vertexCount;
      for (let v = range.firstVertex; v < end; v++) {
        const x = bind[v * 2],
          y = bind[v * 2 + 1];
        let px = 0,
          py = 0;
        for (let k = 0; k < 4; k++) {
          const w = weights[v * 4 + k];
          if (w === 0) continue;
          const o = bones[v * 4 + k] * 6;
          px += w * (m[o] * x + m[o + 2] * y + m[o + 4]);
          py += w * (m[o + 1] * x + m[o + 3] * y + m[o + 5]);
        }
        positions[v * 2] = px;
        positions[v * 2 + 1] = py;
      }
    }
  }

  draw(skeleton: Skeleton, view: RigView): void {
    const gl = this.gl;
    this.skin(skeleton);
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    if (this.orderDirty) {
      let n = 0;
      for (const name of this.order) {
        const range = this.ranges[name];
        if (!range.visible) continue;
        this.indices.set(range.triangles, n);
        n += range.triangles.length;
      }
      this.indexCount = n;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.DYNAMIC_DRAW);
      this.orderDirty = false;
    }
    const width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight,
      sx = ((view.flip ? -1 : 1) * view.scale * 2) / width,
      sy = (-view.scale * 2) / height;
    gl.uniform4f(
      gl.getUniformLocation(this.program, 'view'),
      sx,
      sy,
      (view.x * 2) / width - 1,
      1 - (view.y * 2) / height,
    );
    gl.uniform1f(gl.getUniformLocation(this.program, 'opacity'), view.opacity ?? 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'atlas'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.uvBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteTexture(this.texture);
  }

  private range(part: string): PartRange {
    const range = this.ranges[part];
    if (!range) throw new Error(`no part ${part}`);
    return range;
  }
}
