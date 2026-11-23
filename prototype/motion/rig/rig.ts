// Rig data as written by prototype/motion/prep/build.mjs (rig.json), and its
// loader. Coordinates are root-space pixels of the source sheet, y down, with
// the root at the character's ground origin.

export interface RigBone {
  name: string;
  parent: string | null;
  /** Bind-pose joint position (root space). */
  x: number;
  y: number;
  /** Bind-pose direction of the bone, radians, 0 = +x, positive = clockwise. */
  rotation: number;
  length: number;
}

export interface RigSocket {
  name: string;
  bone: string;
  x: number;
  y: number;
}

export interface RigPart {
  name: string;
  /** Drawn by default. Alternates of one `group` (the hands) start hidden. */
  visible: boolean;
  group?: string;
  /** Bind positions, 2 per vertex. */
  xy: number[];
  /** Atlas coordinates 0..1, 2 per vertex. */
  uv: number[];
  /** Bone indices, 4 per vertex. */
  bones: number[];
  /** Bone weights, 4 per vertex, summing to 1. */
  weights: number[];
  triangles: number[];
}

export interface RigData {
  format: 'arena-cutout-rig';
  version: 1;
  meta: {
    id: string;
    generator: string;
    derived: true;
    /** +1 when the bind pose faces +x. */
    facing: number;
    heightPx: number;
    sheetOrigin: [number, number];
    inputs: { path: string; sha256: string; rect?: number[] }[];
    [key: string]: unknown;
  };
  atlas: { image: string; width: number; height: number };
  /** Parents always precede children. */
  bones: RigBone[];
  sockets: RigSocket[];
  /** Back to front. */
  parts: RigPart[];
}

export interface Rig {
  data: RigData;
  image: HTMLImageElement;
  boneIndex: Record<string, number>;
  socketIndex: Record<string, number>;
  partIndex: Record<string, number>;
}

const indexByName = (list: { name: string }[]) => {
  const out: Record<string, number> = {};
  list.forEach((item, i) => (out[item.name] = i));
  return out;
};

/** Load `rig.json` and the atlas that sits next to it. */
export async function loadRig(url: string): Promise<Rig> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`rig ${url}: HTTP ${response.status}`);
  const data = (await response.json()) as RigData;
  if (data.format !== 'arena-cutout-rig' || data.version !== 1)
    throw new Error(`rig ${url}: unsupported format`);
  const image = new Image();
  image.src = new URL(data.atlas.image, new URL(url, location.href)).href;
  await image.decode();
  return {
    data,
    image,
    boneIndex: indexByName(data.bones),
    socketIndex: indexByName(data.sockets),
    partIndex: indexByName(data.parts),
  };
}
