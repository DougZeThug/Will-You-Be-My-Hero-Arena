export interface FootContact {x:number;y:number;radius:number}
// Bottom alpha in each half of a registered stance locates the actual soles.
// Older packs need no new metadata, and all six poses retain their saved palms.
export function footContacts(width:number,height:number,rgba:ArrayLike<number>,origin:[number,number],scale:number):[FootContact,FootContact]{
 const split=Math.max(1,Math.min(width-1,Math.round(origin[0])));
 return [[0,split],[split,width]].map(([left,right])=>{
  let bottom=-1,min=right,max=left;
  for(let y=height-1;y>=height*.62;y--){let count=0;for(let x=left;x<right;x++)if(rgba[(y*width+x)*4+3]>160)count++;if(count>=3){bottom=y;break;}}
  if(bottom>=0)for(let y=Math.max(0,bottom-8);y<=bottom;y++)for(let x=left;x<right;x++)if(rgba[(y*width+x)*4+3]>160){min=Math.min(min,x);max=Math.max(max,x);}
  if(bottom<0)return {x:((left+right)/2-origin[0])*scale,y:0,radius:16};
  return {x:((min+max)/2-origin[0])*scale,y:(bottom+1-origin[1])*scale,radius:Math.max(9,(max-min)*scale*.48)};
 }) as [FootContact,FootContact];
}
export const CARD_PRESENTATION_SCALE=.86;
export function cardPresentation(base:{x:number;y:number}){return {x:base.x-130,y:base.y-24,scale:CARD_PRESENTATION_SCALE};}
