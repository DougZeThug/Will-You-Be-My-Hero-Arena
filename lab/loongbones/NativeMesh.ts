import * as Phaser from 'phaser';

/** Native Phaser 3.90 WebGL mesh; coordinates are already projected by DragonBones. */
export class NativeMesh extends Phaser.GameObjects.Mesh {
  local: number[] = [];
  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, '__WHITE');
    this.hideCCW = false;
  }
  preUpdate() {} // The proof's single game clock owns the evaluated vertices.
  configure(
    key: string,
    positions: number[],
    uvs: number[],
    indices: number[],
  ) {
    this.setTexture(key);
    this.local = positions;
    this.vertices = positions
      .filter((_, i) => i % 2 === 0)
      .map(
        (_, i) =>
          new Phaser.Geom.Mesh.Vertex(
            0,
            0,
            0,
            uvs[i * 2],
            uvs[i * 2 + 1],
            0xffffff,
          ),
      );
    this.faces = [];
    for (let i = 0; i < indices.length; i += 3) {
      this.faces.push(
        new Phaser.Geom.Mesh.Face(
          ...(indices.slice(i, i + 3).map((j) => this.vertices[j]) as [
            Phaser.Geom.Mesh.Vertex,
            Phaser.Geom.Mesh.Vertex,
            Phaser.Geom.Mesh.Vertex,
          ]),
        ),
      );
    }
  }
  point(index: number, x: number, y: number) {
    const v = this.vertices[index];
    v.vx = x;
    v.vy = y;
    v.vz = 0;
  }
}
