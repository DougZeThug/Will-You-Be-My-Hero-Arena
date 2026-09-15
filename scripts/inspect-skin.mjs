import fs from 'node:fs/promises';
for(const who of ['dan','doug']){
const d=JSON.parse(await fs.readFile(`lab/loongbones/assets/cornhole-motion-v2/${who}_ske.json`));const a=d.armature[0],m=a.skin[0].slot[0].display[0];const entries=[];let p=0;for(let i=0;i<m.vertices.length/2;i++){const n=m.weights[p++],w=[];for(let j=0;j<n;j++)w.push([a.bone[m.weights[p++]].name,m.weights[p++]]);entries.push(w);}
console.log(who,'range',Math.min(...m.vertices.filter((_,i)=>i%2===0)),Math.max(...m.vertices.filter((_,i)=>i%2===0)),a.bone.find(b=>b.name==='upper_arm_L'));
if(who==='dan')for(const [x,y]of [[150,600],[150,700],[180,740],[200,770],[200,800],[140,800],[180,900],[200,1100]]){let nearest=0,min=1e9;for(let i=0;i<entries.length;i++){const e=Math.hypot(m.vertices[i*2]+404-x,m.vertices[i*2+1]+1918-y);if(e<min){min=e;nearest=i;}}console.log({x,y,index:nearest,d:min,weights:entries[nearest]});}
}
