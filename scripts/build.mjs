import {rm,access} from 'node:fs/promises';
import path from 'node:path';
process.env.NODE_ENV='production';
const {createBuilder}=await import('vite');
const {runPrerender}=await import('vinext/internal/build/run-prerender');

// Use the same build and export APIs as vinext's CLI, but allow native worker
// handles to finish naturally. Forced process.exit in the CLI crashes libuv
// during worker shutdown on the bundled Windows Node runtime.
const root=process.cwd();
await rm(path.join(root,'dist'),{recursive:true,force:true});
const builder=await createBuilder({root,mode:'production'});
await builder.buildApp();
const result=await runPrerender({root});
if(!result)throw new Error('Static export did not run.');
await access(path.join(root,'dist/client/index.html'));
console.log('Arena static build and prerender finished.');
