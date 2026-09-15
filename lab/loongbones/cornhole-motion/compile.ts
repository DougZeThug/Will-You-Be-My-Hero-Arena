import { cornholeThrow, throwStyles } from './throws';
const interpolate = (points: number[][], y: number) => {
  for (let i = 1; i < points.length; i++)
    if (y < points[i][0])
      return (
        points[i - 1][1] +
        (points[i][1] - points[i - 1][1]) *
          Math.max(
            0,
            Math.min(
              1,
              (y - points[i - 1][0]) / (points[i][0] - points[i - 1][0]),
            ),
          )
      );
  return points.at(-1)![1];
};
/** Derived motion export. Source editor/foundation bytes remain untouched. */
export function compileCornholeMotion(
  input: any,
  character: 'dan' | 'doug',
  skinPixel?: (u: number, v: number) => boolean,
) {
  const data = structuredClone(input),
    arm = data.armature[0];
  const throwing = arm.bone.find((b: any) => b.name === 'throwing_hand'),
    off = arm.bone.find((b: any) => b.name === 'off_hand');
  const oldThrow = {
    parent: throwing.parent,
    transform: structuredClone(throwing.transform),
  };
  throwing.parent = off.parent;
  throwing.transform = structuredClone(off.transform);
  off.parent = oldThrow.parent;
  off.transform = oldThrow.transform;
  arm.animation = arm.animation.filter((a: any) => !a.name.startsWith('throw'));
  if (character === 'doug')
    for (const clip of arm.animation)
      if (
        [
          'bag_squeeze',
          'enter_lockin',
          'celebrate_open_hand',
          'inspect_hand',
        ].includes(clip.name)
      )
        for (const bone of clip.bone ?? [])
          if (/^(upper_arm|forearm|hand|clavicle)_[LR]$/.test(bone.name))
            bone.name = bone.name.replace(/_(L|R)$/, (_: string, s: string) =>
              s === 'L' ? '_R' : '_L',
            );
  arm.animation.push(
    ...throwStyles.map((style) => cornholeThrow(character, style)),
  );
  // Occlusion follows SOURCE material, not bone weight. A shirt triangle may
  // share arm weights for a continuous shoulder but must still sit behind skin.
  const origin = character === 'dan' ? [404, 1918] : [129, 585];
  const edge =
    character === 'dan'
      ? [
          [430, 245],
          [600, 225],
          [700, 208],
          [800, 210],
          [900, 196],
          [950, 192],
          [1000, 209],
          [1050, 222],
          [1100, 233],
          [1160, 216],
          [1170, 215],
        ]
      : [
          [135, 64],
          [194, 58],
          [235, 54],
          [285, 45],
          [357, 45],
        ];
  for (const skin of arm.skin)
    for (const slot of skin.slot)
      for (const mesh of slot.display) {
        if (!mesh.weights || !mesh.triangles) continue;
        const influences: number[][] = [];
        let cursor = 0;
        while (cursor < mesh.weights.length) {
          const count = mesh.weights[cursor++];
          influences.push(mesh.weights.slice(cursor, cursor + count * 2));
          cursor += count * 2;
        }
        const triangles = [];
        for (let i = 0; i < mesh.triangles.length; i += 3)
          triangles.push(mesh.triangles.slice(i, i + 3));
        const material = (face: number[]) => {
          const x =
              face.reduce((n, i) => n + mesh.vertices[i * 2], 0) / 3 +
              origin[0],
            y =
              face.reduce((n, i) => n + mesh.vertices[i * 2 + 1], 0) / 3 +
              origin[1];
          const near =
            y > edge[0][0] &&
            y < edge.at(-1)![0] &&
            x <
              interpolate(edge, y) +
                (character === 'dan' ? (y > 980 ? 10 : 0) : 15);
          return {
            near,
            x,
            y,
            skin:
              near &&
              (y < (character === 'dan' ? 990 : 193) ||
                !skinPixel ||
                skinPixel(
                  face.reduce((n, i) => n + mesh.uvs[i * 2], 0) / 3,
                  face.reduce((n, i) => n + mesh.uvs[i * 2 + 1], 0) / 3,
                )),
          };
        };
        if (character === 'dan') {
          // Source skin must move as a complete arm cross-section. The old
          // lateral torso blend pinned the inner biceps to the chest, while
          // duplicated grid ownership changed abruptly below the elbow.
          const clones = new Map<number, number>();
          const ease = (a: number, b: number, y: number) => {
            const t = Math.max(0, Math.min(1, (y - a) / (b - a)));
            return t * t * (3 - 2 * t);
          };
          for (const face of triangles) {
            const m = material(face);
            if (!m.skin || m.y < 560) continue;
            for (let j = 0; j < 3; j++) {
              const i = face[j];
              let clone = clones.get(i);
              if (clone === undefined) {
                const y = mesh.vertices[i * 2 + 1] + origin[1];
                const elbow = ease(710, 845, y),
                  wrist = ease(955, 1040, y);
                const armWeight = new Map<number, number>([
                  [
                    arm.bone.findIndex((b: any) => b.name === 'upper_arm_L'),
                    (1 - elbow) * (1 - wrist),
                  ],
                  [
                    arm.bone.findIndex((b: any) => b.name === 'forearm_L'),
                    elbow * (1 - wrist),
                  ],
                  [arm.bone.findIndex((b: any) => b.name === 'hand_L'), wrist],
                ]);
                const blend = ease(560, 625, y),
                  mixed = new Map<number, number>();
                for (let k = 0; k < influences[i].length; k += 2)
                  mixed.set(
                    influences[i][k],
                    influences[i][k + 1] * (1 - blend),
                  );
                for (const [bone, weight] of armWeight)
                  mixed.set(bone, (mixed.get(bone) ?? 0) + weight * blend);
                clone = mesh.vertices.length / 2;
                mesh.vertices.push(
                  mesh.vertices[i * 2],
                  mesh.vertices[i * 2 + 1],
                );
                mesh.uvs.push(mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]);
                influences.push([...mixed].filter(([, w]) => w > 1e-8).flat());
                clones.set(i, clone);
              }
              face[j] = clone;
            }
          }
        }
        const bodyClones = new Map<string, number>();
        for (const face of triangles) {
          const m = material(face);
          if (
            !m.near ||
            m.skin ||
            (character === 'doug' && m.y >= 330 && m.x < 50) ||
            m.x < interpolate(edge, m.y) - (character === 'dan' ? 14 : 5) ||
            m.y < (character === 'dan' ? 680 : 213)
          )
            continue;
          for (let j = 0; j < 3; j++) {
            const i = face[j],
              entries = influences[i];
            if (
              !entries.some(
                (v, k) =>
                  k % 2 === 0 &&
                  /^(upper_arm|forearm|hand)_L$/.test(arm.bone[v].name),
              )
            )
              continue;
            const bone =
              character === 'dan'
                ? m.y > 950
                  ? 'pelvis'
                  : m.y > 850
                    ? 'spine_mid'
                    : 'chest'
                : m.y > 305
                  ? 'pelvis'
                  : m.y > 269
                    ? 'spine_lower'
                    : m.y > 238
                      ? 'spine_mid'
                      : 'chest';
            const key = i + ':' + bone;
            let clone = bodyClones.get(key);
            if (clone === undefined) {
              clone = mesh.vertices.length / 2;
              mesh.vertices.push(
                mesh.vertices[i * 2],
                mesh.vertices[i * 2 + 1],
              );
              mesh.uvs.push(mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]);
              influences.push([
                arm.bone.findIndex((b: any) => b.name === bone),
                1,
              ]);
              bodyClones.set(key, clone);
            }
            face[j] = clone;
          }
        }
        if (character === 'doug') {
          const clones = new Map<number, number>();
          for (const face of triangles) {
            const m = material(face);
            if (m.x >= 50 || m.y < 345 || m.y > 370) continue;
            for (let j = 0; j < 3; j++) {
              const i = face[j];
              let clone = clones.get(i);
              if (clone === undefined) {
                clone = mesh.vertices.length / 2;
                mesh.vertices.push(
                  mesh.vertices[i * 2],
                  mesh.vertices[i * 2 + 1],
                );
                mesh.uvs.push(mesh.uvs[i * 2], mesh.uvs[i * 2 + 1]);
                influences.push([
                  arm.bone.findIndex((b: any) => b.name === 'hand_L'),
                  1,
                ]);
                clones.set(i, clone);
              }
              face[j] = clone;
            }
          }
        }
        triangles.sort(
          (a: number[], b: number[]) =>
            Number(material(a).skin) - Number(material(b).skin),
        );
        if (character === 'dan') {
          // A narrow fabric underlap supplies the shorts edge previously covered
          // by the resting hand. Reuse adjacent ORIGINAL fabric texels; no face,
          // logo, source pixels or external silhouette is redrawn.
          const strips = [
            [1000, 1080, 205, 201],
            [1080, 1170, 201, 192],
            [1170, 1200, 192, 191],
          ];
          for (const [top, bottom, leftTop, leftBottom] of strips) {
            const start = mesh.vertices.length / 2;
            for (const [x, y, u] of [
              [leftTop, top, 249],
              [252, top, 275],
              [leftBottom, bottom, 249],
              [252, bottom, 275],
            ]) {
              mesh.vertices.push(x - 404, y - 1918);
              mesh.uvs.push(u / 808, y / 1947);
              influences.push([
                arm.bone.findIndex((b: any) => b.name === 'pelvis'),
                1,
              ]);
            }
            triangles.unshift(
              [start, start + 1, start + 2],
              [start + 1, start + 3, start + 2],
            );
          }
        }
        mesh.triangles = triangles.flat();
        mesh.weights = influences.flatMap((p) => [p.length / 2, ...p]);
        // Rebuild editor outline indices after material-boundary vertex splits.
        const edges = new Map<string, { count: number; pair: number[] }>();
        for (const face of triangles)
          for (let j = 0; j < 3; j++) {
            const a = face[j],
              b = face[(j + 1) % 3],
              key = Math.min(a, b) + ':' + Math.max(a, b),
              e = edges.get(key);
            if (e) e.count++;
            else edges.set(key, { count: 1, pair: [a, b] });
          }
        mesh.edges = [...edges.values()]
          .filter((e) => e.count === 1)
          .flatMap((e) => e.pair);
      }
  return data;
}
