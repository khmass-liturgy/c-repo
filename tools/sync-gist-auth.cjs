// Keep the single-file HTML usable without an adjacent JS download or a network request.
const fs = require('node:fs');
const path = require('node:path');
const root = fs.existsSync(path.join(__dirname,'index.html')) ? __dirname : path.dirname(__dirname);
const source = fs.readFileSync(path.join(root,'gist-auth.js'),'utf8').trim();
if (/<\/script/i.test(source)) throw new Error('Embedded script contains an HTML closing tag');
const file = path.join(root,'index.html');
const html = fs.readFileSync(file,'utf8');
const pattern = /<script src="gist-auth\.js"><\/script>|<script id="gist-auth-runtime">[\s\S]*?<\/script>/;
if (!pattern.test(html)) throw new Error('Gist runtime insertion point missing');
fs.writeFileSync(file,html.replace(pattern,()=>'<script id="gist-auth-runtime">\n'+source+'\n</script>'));
