import {build} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
await build({configFile:'vite.icon-bundle.config.mjs'});
const dir=resolve('art/icon-bundle/site');let html=await readFile(dir+'/icon-bundle-review.html','utf8');
for(const match of [...html.matchAll(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)]){
 const js=await readFile(resolve(dir,match[1]),'utf8');
 html=html.replace(match[0],()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>');
}
for(const match of [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]){const css=await readFile(resolve(dir,match[1]),'utf8');html=html.replace(match[0],()=>'<style>'+css+'</style>');}
if(/(?:src|href)="\.\/assets\//.test(html))throw Error('Review still needs an external file');
await writeFile('art/icon-bundle/Jim-Bundle-Review.html',html);
console.log('Saved standalone bundle review: '+(Buffer.byteLength(html)/1048576).toFixed(1)+' MiB. No deployment performed.');
