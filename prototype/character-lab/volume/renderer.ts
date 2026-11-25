// Drawing on volume, run time half 2: WebGL 1, no libraries.
//   pass 1  the skinned surfaces, unlit texture, DEPTH TEST (no draw-order list)
//   pass 2  the same geometry again as (depth, part id)
//   pass 3  composite: the ink line where depth breaks (the nearer surface carries
//           it, as a drawn contour does), then a constant-width sticker border around
//           the union silhouette. Nothing of either is baked in the texture.
//   pass 4  supersample resolve to the canvas (premultiplied alpha)
// The only projection is core/camera.ts project(), applied on the CPU.
import { project, type Camera } from '../core/camera';
import type { VolumeRig } from './rig';

const MESH_VS = `
attribute vec3 position; // canvas px x, y (down); depth in metres (+ = nearer)
attribute vec2 uv;
uniform vec2 canvas;
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vDepth = position.z;
  gl_Position = vec4(position.x / canvas.x * 2.0 - 1.0, 1.0 - position.y / canvas.y * 2.0, -position.z * 0.25, 1.0);
}`;
const COLOUR_FS = `
precision mediump float;
uniform sampler2D atlas;
varying vec2 vUv;
varying float vDepth;
void main() { gl_FragColor = vec4(texture2D(atlas, vUv).rgb, 1.0); }`;
const INFO_FS = `
precision highp float;
uniform float part;
varying vec2 vUv;
varying float vDepth;
void main() {
  float d = clamp(vDepth * 0.125 + 0.5, 0.0, 1.0) * 65535.0;
  float hi = floor(d / 256.0);
  gl_FragColor = vec4(hi / 255.0, (d - hi * 256.0) / 255.0, part / 255.0, 1.0);
}`;
const QUAD_VS = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
const COMPOSITE_FS = `
precision highp float;
uniform sampler2D colour;
uniform sampler2D info;
uniform vec2 texel;
uniform float inkRadius;
uniform float borderRadius;
uniform vec3 inkColour;
uniform vec3 borderColour;
uniform float stepSame;
uniform float stepOther;
uniform float inkOn;
varying vec2 vUv;
float depthOf(vec4 i) { return (i.r * 255.0 * 256.0 + i.g * 255.0) / 65535.0 * 8.0 - 4.0; }
void main() {
  vec4 here = texture2D(info, vUv);
  if (here.a > 0.5) {
    float d0 = depthOf(here);
    float ink = 0.0;
    for (int k = 0; k < 12; k++) {
      float a = 6.2831853 * (float(k) + 0.5) / 12.0;
      vec2 dir = vec2(cos(a), sin(a)) * texel;
      for (int ring = 1; ring <= 2; ring++) {
        vec2 offset = dir * inkRadius * float(ring) * 0.5;
        vec4 there = texture2D(info, vUv + offset);
        if (there.a < 0.5) { ink = 1.0; continue; }
        // A surface that is simply turning away is not an edge: allow for its slope,
        // read from the opposite side.
        vec4 back = texture2D(info, vUv - offset);
        float slope = back.a > 0.5 ? clamp(depthOf(back) - d0, 0.0, 0.03) : 0.0;
        float limit = abs(there.b - here.b) > 0.002 ? stepOther : stepSame;
        if (d0 - depthOf(there) > limit + 1.5 * slope) ink = 1.0;
      }
    }
    gl_FragColor = vec4(mix(texture2D(colour, vUv).rgb, inkColour, ink * inkOn), 1.0);
    return;
  }
  float reach = 0.0;
  for (int k = 0; k < 16; k++) {
    float a = 6.2831853 * float(k) / 16.0;
    vec2 dir = vec2(cos(a), sin(a)) * texel * borderRadius;
    reach = max(reach, max(texture2D(info, vUv + dir).a, max(texture2D(info, vUv + dir * 0.66).a, texture2D(info, vUv + dir * 0.33).a)));
  }
  gl_FragColor = reach > 0.5 ? vec4(borderColour, 1.0) : vec4(0.0);
}`;
const RESOLVE_FS = `
precision mediump float;
uniform sampler2D source;
uniform vec2 texel;
uniform float taps; // 1 = one bilinear tap (2x), 2 = four (4x)
varying vec2 vUv;
void main() {
  if (taps < 1.5) { gl_FragColor = texture2D(source, vUv); return; }
  gl_FragColor = 0.25 * (texture2D(source, vUv + texel * vec2(-1.0, -1.0)) + texture2D(source, vUv + texel * vec2(1.0, -1.0)) + texture2D(source, vUv + texel * vec2(-1.0, 1.0)) + texture2D(source, vUv + texel * vec2(1.0, 1.0)));
}`;

function compile(gl: WebGLRenderingContext, vs: string, fs: string, attributes: string[]): WebGLProgram {
  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    gl.attachShader(program, shader);
  }
  attributes.forEach((name, i) => gl.bindAttribLocation(program, i, name));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  return program;
}

interface Target {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  depth: WebGLRenderbuffer | null;
}

export interface Placement {
  /** Canvas pixel of the world origin's ground point. */
  x: number;
  y: number;
  /** Pixels per metre. */
  scale: number;
}

export const RENDER = {
  supersample: 2 as 2 | 4,
  /** Depth steps (m) that count as a contour: within one surface, and between two surfaces. */
  stepSame: 0.03,
  stepOther: 0.012,
  ink: true,
  border: true,
};

interface PartBuffers {
  position: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
  projected: Float32Array;
  /** [first index, count] per subset. */
  ranges: Record<Subset, [number, number]>;
}

/** Head/neck share of a trunk triangle: above `headFrom` it is in the head block, below `bodyTo` in the body block. */
export const BLOCKS = { headFrom: 0.3, bodyTo: 0.9 };

/** GPU side of the programs and targets, shared by every rig drawn into one context. */
export class VolumeStage {
  readonly gl: WebGLRenderingContext;
  readonly meshColour: WebGLProgram;
  readonly meshInfo: WebGLProgram;
  readonly composite: WebGLProgram;
  readonly resolve: WebGLProgram;
  readonly quad: WebGLBuffer;
  private targets: { colour: Target; info: Target; out: Target } | null = null;
  private size = [0, 0];

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.meshColour = compile(gl, MESH_VS, COLOUR_FS, ['position', 'uv']);
    this.meshInfo = compile(gl, MESH_VS, INFO_FS, ['position', 'uv']);
    this.composite = compile(gl, QUAD_VS, COMPOSITE_FS, ['position']);
    this.resolve = compile(gl, QUAD_VS, RESOLVE_FS, ['position']);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  }

  private target(width: number, height: number, withDepth: boolean, filter: number): Target {
    const gl = this.gl,
      texture = gl.createTexture()!,
      framebuffer = gl.createFramebuffer()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    let depth: WebGLRenderbuffer | null = null;
    if (withDepth) {
      depth = gl.createRenderbuffer()!;
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('volume renderer: framebuffer incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { framebuffer, texture, depth };
  }

  /** Offscreen targets at `supersample` times the canvas. */
  ensure(width: number, height: number): { colour: Target; info: Target; out: Target } {
    const gl = this.gl;
    if (!this.targets || this.size[0] !== width || this.size[1] !== height) {
      if (this.targets)
        for (const t of Object.values(this.targets)) {
          gl.deleteFramebuffer(t.framebuffer);
          gl.deleteTexture(t.texture);
          if (t.depth) gl.deleteRenderbuffer(t.depth);
        }
      this.targets = { colour: this.target(width, height, true, gl.NEAREST), info: this.target(width, height, true, gl.NEAREST), out: this.target(width, height, false, gl.LINEAR) };
      this.size = [width, height];
    }
    return this.targets;
  }

  /**
   * Draws any number of volumes (or blocks of them) into ONE depth buffer, then the
   * ink and the sticker border once over the union. `place` and the size are canvas pixels.
   */
  render(items: RenderItem[], camera: Camera, place: Placement, width: number, height: number): void {
    const gl = this.gl,
      ss = RENDER.supersample,
      w = width * ss,
      h = height * ss,
      targets = this.ensure(w, h);
    for (const item of items) item.layers.project(item.world, camera, place);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    for (const [program, target] of [[this.meshColour, targets.colour], [this.meshInfo, targets.info]] as const) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(gl.getUniformLocation(program, 'canvas'), width, height);
      items.forEach((item, k) => item.layers.geometry(program, program === this.meshInfo, item.subset, k, item.hide, item.only));
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disableVertexAttribArray(1);
    // Composite: ink and sticker border from the depth/part image.
    const data = items[0].layers.rig.data,
      quad = () => {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets.out.framebuffer);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.composite);
    const U = (name: string) => gl.getUniformLocation(this.composite, name);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.colour.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, targets.info.texture);
    gl.uniform1i(U('colour'), 0);
    gl.uniform1i(U('info'), 1);
    gl.uniform2f(U('texel'), 1 / w, 1 / h);
    gl.uniform1f(U('inkRadius'), Math.max(1.2, data.inkWidth * place.scale * ss));
    gl.uniform1f(U('borderRadius'), RENDER.border ? Math.max(1.5, data.stickerWidth * place.scale * ss) : 0);
    gl.uniform3f(U('inkColour'), data.inkColour[0] / 255, data.inkColour[1] / 255, data.inkColour[2] / 255);
    gl.uniform3f(U('borderColour'), data.stickerColour[0] / 255, data.stickerColour[1] / 255, data.stickerColour[2] / 255);
    gl.uniform1f(U('stepSame'), RENDER.stepSame);
    gl.uniform1f(U('stepOther'), RENDER.stepOther);
    gl.uniform1f(U('inkOn'), RENDER.ink ? 1 : 0);
    quad();
    // Resolve to the canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.resolve);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.out.texture);
    gl.uniform1i(gl.getUniformLocation(this.resolve, 'source'), 0);
    gl.uniform2f(gl.getUniformLocation(this.resolve, 'texel'), 1 / w, 1 / h);
    gl.uniform1f(gl.getUniformLocation(this.resolve, 'taps'), ss === 4 ? 2 : 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    quad();
  }
}

/** Which block of a volume to draw: everything, only the head and neck, or everything but them. */
export type Subset = 'all' | 'head' | 'body';
export interface RenderItem {
  layers: VolumeLayers;
  world: Float32Array[];
  subset: Subset;
  /** Part names not to draw (a corrective piece replaces them). */
  hide?: string[];
  /** When given, only these parts are drawn. */
  only?: string[];
}

/** One volume rig on the GPU. */
export class VolumeLayers {
  readonly rig: VolumeRig;
  private readonly stage: VolumeStage;
  private readonly atlas: WebGLTexture;
  private readonly buffers: PartBuffers[];

  constructor(stage: VolumeStage, rig: VolumeRig) {
    const gl = stage.gl;
    this.stage = stage;
    this.rig = rig;
    this.atlas = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, rig.atlas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
    if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    const headBones = new Set(['head', 'neck'].map((name) => rig.data.bones.indexOf(name)));
    this.buffers = rig.parts.map((part) => {
      const b: PartBuffers = { position: gl.createBuffer()!, uv: gl.createBuffer()!, index: gl.createBuffer()!, projected: new Float32Array(part.vertexCount * 3), ranges: { all: [0, part.indexCount], head: [0, 0], body: [0, part.indexCount] } };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
      gl.bufferData(gl.ARRAY_BUFFER, part.uvs, gl.STATIC_DRAW);
      let indices = part.indices;
      if (part.name === 'trunk') {
        // The same triangles again, sorted into "head and neck" and "the rest". The two
        // blocks overlap through the neck, so a head from one drawing sits INSIDE the
        // collar of another and the depth buffer joins them.
        const share = (v: number) => {
          let sum = 0;
          for (let k = 0; k < 4; k++) if (headBones.has(part.bones[v * 4 + k])) sum += part.weights[v * 4 + k];
          return sum;
        };
        const head: number[] = [],
          body: number[] = [];
        for (let i = 0; i < part.indexCount; i += 3) {
          const tri = [part.indices[i], part.indices[i + 1], part.indices[i + 2]],
            mean = (share(tri[0]) + share(tri[1]) + share(tri[2])) / 3;
          if (mean > BLOCKS.headFrom) head.push(...tri);
          if (mean < BLOCKS.bodyTo) body.push(...tri);
        }
        indices = Uint16Array.from([...part.indices, ...head, ...body]);
        b.ranges.head = [part.indexCount, head.length];
        b.ranges.body = [part.indexCount + head.length, body.length];
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
      return b;
    });
  }

  /** World positions -> canvas px + depth, with the one shared projection. */
  project(world: Float32Array[], camera: Camera, place: Placement): void {
    const gl = this.stage.gl,
      point = { x: 0, y: 0, z: 0 };
    this.rig.parts.forEach((part, k) => {
      const source = world[k],
        out = this.buffers[k].projected;
      for (let v = 0; v < part.vertexCount; v++) {
        point.x = source[v * 3];
        point.y = source[v * 3 + 1];
        point.z = source[v * 3 + 2];
        const q = project(point, camera);
        out[v * 3] = place.x + q.x * place.scale;
        out[v * 3 + 1] = place.y - q.y * place.scale;
        out[v * 3 + 2] = q.depth;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers[k].position);
      gl.bufferData(gl.ARRAY_BUFFER, out, gl.DYNAMIC_DRAW);
    });
  }

  geometry(program: WebGLProgram, info: boolean, subset: Subset, item: number, hide?: string[], only?: string[]): void {
    const gl = this.stage.gl;
    if (!info) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlas);
      gl.uniform1i(gl.getUniformLocation(program, 'atlas'), 0);
    }
    this.rig.parts.forEach((part, k) => {
      const b = this.buffers[k],
        [first, count] = b.ranges[subset];
      if (!count || hide?.includes(part.name) || (only && !only.includes(part.name))) return;
      // Part ids differ between volumes too, so a head from another drawing gets its contour.
      if (info) gl.uniform1f(gl.getUniformLocation(program, 'part'), part.id * 20 + item * 7);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.position);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.uv);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.index);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, first * 2);
    });
  }
}
