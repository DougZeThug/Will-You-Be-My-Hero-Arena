import type * as Phaser from 'phaser';
import type { NativeArmature } from '../NativeFactory';
import { NativeMesh } from '../NativeMesh';
import type { DanRigScene } from './DanRigScene';
export function drawRig(actor: NativeArmature, g: Phaser.GameObjects.Graphics) {
  for (const bone of actor.armature.getBones()) {
    const p = actor.socket(bone.name),
      target = bone.name.startsWith('foot_target');
    if (bone.parent && !target && bone.name !== 'pelvis') {
      const q = actor.socket(bone.parent.name);
      g.lineStyle(1.5, 0x177f8e, 0.8).lineBetween(p.x, p.y, q.x, q.y);
    }
    g.fillStyle(target ? 0xf2a222 : 0x147888, 0.95).fillCircle(
      p.x,
      p.y,
      target ? 5 : 3,
    );
  }
}
export function snapshotRig(s: DanRigScene) {
  const times = [...s.frameTimes].sort((a, b) => a - b);
  const meshes = s.actor.list.filter(
    (o): o is NativeMesh => o instanceof NativeMesh,
  );
  const socket = (name: string) => {
    const p = s.actor.socket(name);
    return { x: p.x, y: p.y };
  };
  return {
    ready: s.ready,
    character: 'dan',
    rig: 'dan_weighted_v1',
    runtime: 'DragonBones 5.7.000',
    phaser: '3.90.0',
    authoredBy: 'Astra; editor sample exported by LoongBones 1.2.3',
    sample: s.sample,
    assetIdentityVerified: s.assetIdentityVerified,
    editorExportReceived: s.sample !== 'authored',
    compatibilityRestored: s.sample === 'restored',
    editorRoundTripVerified: false,
    productionInstalled: false,
    seconds: s.seconds,
    playing: s.playing,
    clip: s.clipName,
    clipTime: s.seconds - s.clipStart,
    view: {
      overlay: s.overlay,
      silhouette: s.silhouette,
      mirrored: s.mirrored,
      court: s.court,
    },
    root: {
      x: s.actor.x,
      y: s.actor.y,
      scaleX: s.actor.scaleX,
      scaleY: s.actor.scaleY,
    },
    animations: [...s.actor.animation.animationNames],
    tracks: s.actor.animation.getStates().map((t) => ({
      name: t.name,
      time: t.currentTime,
      completed: t.isCompleted,
      playTimes: t.playTimes,
      weight: t.weight,
    })),
    bones: s.actor.armature.getBones().map((b) => ({
      name: b.name,
      parent: b.parent?.name ?? null,
      ...socket(b.name),
      matrix: { ...b.globalTransformMatrix },
    })),
    meshes: meshes.map((m) => ({
      name: m.name,
      vertices: m.vertices.map((v) => [v.vx, v.vy]),
      triangles: m.faces.length,
    })),
    sockets: Object.fromEntries(
      [
        'throwing_hand',
        'off_hand',
        'heel_L',
        'toe_L',
        'heel_R',
        'toe_R',
        'foot_target_L',
        'foot_target_R',
      ].map((n) => [n, socket(n)]),
    ),
    markers: s.markers.map((m) => ({ ...m })),
    release: s.release ? { ...s.release } : null,
    bag: {
      x: s.bag.x,
      y: s.bag.y,
      visible: s.bag.visible,
      attached: !s.release,
    },
    performance: {
      samples: times.length,
      p95Ms: times[Math.floor(times.length * 0.95)] ?? null,
      meshes: meshes.length,
      vertices: meshes.reduce((n, m) => n + m.vertices.length, 0),
      triangles: meshes.reduce((n, m) => n + m.faces.length, 0),
      textures: s.textures.getTextureKeys().length,
    },
  };
}
