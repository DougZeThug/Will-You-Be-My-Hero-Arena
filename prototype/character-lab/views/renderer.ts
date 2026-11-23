// WebGL 1 layer renderer for the 2.5D poser: draws single parts of several
// cut-out rigs in any order, each skinned on the CPU with its own bone matrix
// set and opacity, plus flat-colour polygons (contact shadow, props).
// Positions are canvas pixels (y down).
import type { Rig } from '../../motion/rig/rig';

const TEXTURED_VS = `
attribute vec2 position;
attribute vec2 uv;
uniform vec2 canvas;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.x / canvas.x * 2.0 - 1.0, 1.0 - position.y / canvas.y * 2.0, 0.0, 1.0);
}`;
const TEXTURED_FS = `
precision mediump float;
uniform sampler2D atlas;
uniform float opacity;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(atlas, vUv) * opacity; }`;
const FLAT_VS = `
attribute vec2 position;
attribute vec4 colour;
uniform vec2 canvas;
varying vec4 vColour;
void main() {
  vColour = colour;
  gl_Position = vec4(position.x / canvas.x * 2.0 - 1.0, 1.0 - position.y / canvas.y * 2.0, 0.0, 1.0);
}`;
const FLAT_FS = `
precision mediump float;
varying vec4 vColour;
void main() { gl_FragColor = vec4(vColour.rgb * vColour.a, vColour.a); }`;

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

interface Programs {
  textured: WebGLProgram;
  flat: WebGLProgram;
  flatBuffer: WebGLBuffer;
}
const cache = new WeakMap<WebGLRenderingContext, Programs>();
function programs(gl: WebGLRenderingContext): Programs {
  let p = cache.get(gl);
  if (!p) {
    p = {
      textured: compile(gl, TEXTURED_VS, TEXTURED_FS, ['position', 'uv']),
      flat: compile(gl, FLAT_VS, FLAT_FS, ['position', 'colour']),
      flatBuffer: gl.createBuffer()!,
    };
    cache.set(gl, p);
  }
  return p;
}

interface PartMesh {
  count: number;
  bind: Float32Array;
  bones: Uint16Array;
  weights: Float32Array;
  positions: Float32Array;
  positionBuffer: WebGLBuffer;
  uvBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  indexCount: number;
}

/** One rig's parts on the GPU. */
export class RigLayers {
  readonly rig: Rig;
  private readonly gl: WebGLRenderingContext;
  private readonly texture: WebGLTexture;
  private readonly parts: Record<string, PartMesh> = {};

  constructor(gl: WebGLRenderingContext, rig: Rig) {
    this.gl = gl;
    this.rig = rig;
    for (const part of rig.data.parts) {
      const count = part.xy.length / 2,
        mesh: PartMesh = {
          count,
          bind: Float32Array.from(part.xy),
          bones: Uint16Array.from(part.bones),
          weights: Float32Array.from(part.weights),
          positions: new Float32Array(count * 2),
          positionBuffer: gl.createBuffer()!,
          uvBuffer: gl.createBuffer()!,
          indexBuffer: gl.createBuffer()!,
          indexCount: part.triangles.length,
        };
      // rig.json rounds weights to 4 decimals; renormalise so a blended vertex
      // is not pulled toward the origin by the rounding (0.1 px at 800 px).
      for (let v = 0; v < count; v++) {
        const sum = mesh.weights[v * 4] + mesh.weights[v * 4 + 1] + mesh.weights[v * 4 + 2] + mesh.weights[v * 4 + 3];
        if (sum > 0) for (let k = 0; k < 4; k++) mesh.weights[v * 4 + k] /= sum;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(part.uv), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(part.triangles), gl.STATIC_DRAW);
      this.parts[part.name] = mesh;
    }
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

  has(part: string): boolean {
    return part in this.parts;
  }

  /** `skin`: 6 floats per bone (canvas px = skin * bind px). */
  drawPart(name: string, skin: Float32Array, opacity: number): void {
    const gl = this.gl,
      mesh = this.parts[name];
    if (!mesh || opacity <= 0) return;
    const { bind, bones, weights, positions } = mesh;
    for (let v = 0; v < mesh.count; v++) {
      const x = bind[v * 2],
        y = bind[v * 2 + 1];
      let px = 0,
        py = 0;
      for (let k = 0; k < 4; k++) {
        const w = weights[v * 4 + k];
        if (w === 0) continue;
        const o = bones[v * 4 + k] * 6;
        px += w * (skin[o] * x + skin[o + 2] * y + skin[o + 4]);
        py += w * (skin[o + 1] * x + skin[o + 3] * y + skin[o + 5]);
      }
      positions[v * 2] = px;
      positions[v * 2 + 1] = py;
    }
    const program = programs(gl).textured;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.uniform2f(gl.getUniformLocation(program, 'canvas'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(gl.getUniformLocation(program, 'opacity'), opacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(program, 'atlas'), 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }
}

/** Triangle fan of flat-coloured vertices: [x, y, r, g, b, a] each, canvas px, 0..1 colour. */
export function drawFan(gl: WebGLRenderingContext, vertices: number[]): void {
  const p = programs(gl);
  gl.useProgram(p.flat);
  gl.bindBuffer(gl.ARRAY_BUFFER, p.flatBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  gl.uniform2f(gl.getUniformLocation(p.flat, 'canvas'), gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 6);
}
