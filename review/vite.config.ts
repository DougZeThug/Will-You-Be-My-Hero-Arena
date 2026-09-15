import {defineConfig} from 'vite';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
export default defineConfig({root:path.resolve('review'),publicDir:path.resolve('public'),server:{host:'127.0.0.1',port:3004,strictPort:true,fs:{allow:[path.resolve('.')]}},plugins:[{name:'local-motion-review',configureServer(server){server.middlewares.use('/review-capture',async(req,res)=>{try{
 if(req.method!=='POST'||!['http://127.0.0.1:3004','http://localhost:3004'].includes(req.headers.origin??'')){res.writeHead(403).end();return;}
 const url=new URL(req.url??'/', 'http://localhost'),name=url.searchParams.get('name')??'';
 if(!/^(before|after)-[a-z-]+-[0-9]{4}\.png$/.test(name)){res.writeHead(400).end();return;}
 const chunks:Buffer[]=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4000000)throw Error('Frame too large');chunks.push(chunk);}
 const dir=path.resolve('../../work/motion-repair/posture-review');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,name),Buffer.concat(chunks));res.writeHead(200).end('Saved');
 }catch(e){res.writeHead(500).end(String(e));}});}}]});
