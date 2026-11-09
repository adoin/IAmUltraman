import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv.includes('--dist') ? 'dist' : '.');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.task':'application/octet-stream','.svg':'image/svg+xml'};
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Invalid path');
    if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
    let body = await readFile(file);
    // Local review only: enter a quiet practice scene without adding a product flow.
    if(url.pathname==='/'&&url.searchParams.get('preview')==='skills')body=Buffer.from(body.toString().replace('</body>',`<script type="module">
      import {battle} from '/src/main.js';
      await battle.ready;
      while(document.querySelector('#start-keyboard').disabled)await new Promise(r=>setTimeout(r,100));
      await document.querySelector('#start-keyboard').onclick();
      battle.practice=true; battle.nextAttack=100000;
    </script></body>`));
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
