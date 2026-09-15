import * as Phaser from 'phaser';
/** Phaser's native mesh batching with already projected 2D vertices. Skips the
 * 3D projection pass; no Pixi renderer, canvas texture uploads, or CSS joints. */
export class PaperMesh extends Phaser.GameObjects.Mesh {
 constructor(scene:Phaser.Scene,key:string,rect:[number,number,number,number],nx:number,ny:number,indices?:number[]){
  super(scene,0,0,key);this.hideCCW=false;
  const texture=scene.textures.get(key).getSourceImage() as HTMLImageElement;
  this.vertices=[];
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)this.vertices.push(new Phaser.Geom.Mesh.Vertex(0,0,0,(rect[0]+x/(nx-1)*rect[2])/texture.width,(rect[1]+y/(ny-1)*rect[3])/texture.height,0xfff2df));
  if(!indices){indices=[];for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){const i=y*nx+x;indices.push(i,i+1,i+nx,i+1,i+nx+1,i+nx);}}
  this.faces=[];for(let i=0;i<indices.length;i+=3)this.faces.push(new Phaser.Geom.Mesh.Face(this.vertices[indices[i]],this.vertices[indices[i+1]],this.vertices[indices[i+2]]));
  scene.add.existing(this);
 }
 preUpdate(){} // Vertices are sampled once by CharacterController at game time.
 point(i:number,x:number,y:number){const v=this.vertices[i];v.vx=x;v.vy=y;v.vz=0;}
}
