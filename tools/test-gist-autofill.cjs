// Isolated browser integration checks: no real accounts, credentials, or GitHub calls.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const DIR = process.env.GIST_TEST_DIR || (fs.existsSync(path.join(__dirname,'index.html')) ? __dirname : path.dirname(__dirname));
const ID = 'a'.repeat(32), ID2 = 'b'.repeat(32), TOKEN = 'test-only-not-a-real-token';
const fixture = { categories: [{id:'test',name:'연습곡',icon:'♪',pieces:[{title:'Test piece',composer:'Test'}]}],state:{pieces:{'Test piece':{status:'연습중',memo:'',performances:[],duration:60}},collapsed:{}} };
const gist = data => ({id:ID,files:{guitar_repertory_json:null,'guitar_repertory.json':{content:JSON.stringify(data),truncated:false}}});
const server = http.createServer((req,res) => {
  const file = new URL(req.url,'http://localhost').pathname === '/gist-auth.js' ? 'gist-auth.js' : 'index.html';
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(DIR,file)));
});
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const results=[];
  async function run(name, options, check) {
    const context = await browser.newContext();
    const calls=[], errors=[];
    await context.addInitScript(({legacy,credential,autofillPaused}) => {
      window.__stored=[];window.__pause=0;
      window.PasswordCredential = class {constructor(v){Object.assign(this,v);this.type='password';}};
      Object.defineProperty(navigator,'credentials',{value:{
        async get(){return credential||null;},async store(value){window.__stored.push({id:value.id,password:value.password});return value;},
        async preventSilentAccess(){window.__pause++;}
      }});
      if (legacy) localStorage.setItem('guitar_gist_config',JSON.stringify(legacy));
      if (autofillPaused) localStorage.setItem('guitar_gist_config',JSON.stringify({autofillPaused:true}));
    },options);
    await context.route('**/*',async route => {
      const request=route.request(), u=new URL(request.url());
      if(u.origin===url) return route.continue();
      if(u.origin!=='https://api.github.com') return route.abort();
      calls.push({method:request.method(),path:u.pathname,query:u.search,body:request.postData(),authorization:request.headers().authorization});
      const list=options.matches ?? [{id:ID,description:'Test',files:{'guitar_repertory.json':{}}}];
      const body=u.pathname==='/gists' && request.method()==='GET' ? list : (options.badFile ? {id:ID,files:{'unrelated.json':{content:'{}'}}} : gist(options.data||fixture));
      await route.fulfill({status:options.fail?401:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    const page=await context.newPage(); page.on('pageerror',err=>errors.push(err.message));
    await page.goto(url); await page.waitForFunction(()=>typeof GistAuth==='object' && !!document.querySelector('.category-section'));
    await page.evaluate(()=>initializeGistSync());
    await check(page,calls);
    const stored=await page.evaluate(()=>JSON.stringify({...localStorage}));
    assert(!stored.includes(TOKEN),'PAT leaked into app storage');
    assert(!calls.some(c=>(c.body||'').includes(TOKEN)||c.path.includes(TOKEN)||c.query.includes(TOKEN)),'PAT leaked into payload or URL');
    assert.deepEqual(errors,[]); results.push(name); await context.close();
  }
  try {
    await run('legacy migration removes plaintext; startup is GET-only',{legacy:{token:TOKEN,gistId:ID}},async(p,c)=>{
      await p.waitForFunction(()=>isGistConnected());
      assert(c.every(x=>x.method==='GET'));
      const cfg=await p.evaluate(()=>JSON.parse(localStorage.getItem('guitar_gist_config')));
      assert.equal(cfg.gistId,ID); assert(!('token' in cfg));
    });
    await run('manual connect discovers ID and stores pair only in password manager',{},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);
      await p.evaluate(()=>connectGist());
      assert.equal(await p.evaluate(()=>gistConfig.gistId),ID);
      assert.equal(await p.evaluate(()=>__stored.length),1);
      assert.equal(await p.evaluate(()=>__stored[0].id),'c-repo-gist:'+ID);
      assert(c.every(x=>x.method==='GET'));
    });
    await run('fresh device restores both values; no password rewrite',{credential:{type:'password',id:'c-repo-gist:'+ID,password:TOKEN}},async(p,c)=>{
      await p.waitForFunction(()=>isGistConnected());
      assert.equal(await p.evaluate(()=>gistConfig.gistId),ID);
      assert.equal(await p.evaluate(()=>__stored.length),0);assert(c.every(x=>x.method==='GET'));
    });
    await run('unrelated saved password never sent to GitHub',{credential:{type:'password',id:'another-app',password:TOKEN}},async(p,c)=>{assert.equal(c.length,0);});
    await run('no match never creates silently',{matches:[]},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.evaluate(()=>connectGist());
      assert(!await p.evaluate(()=>isGistConnected()));assert(c.every(x=>x.method==='GET'));
    });
    await run('new Gist requires explicit opt-in and excludes credentials',{matches:[]},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.locator('#gistCreateNew').check();
      await p.locator('#gistRemember').uncheck();await p.evaluate(()=>connectGist());
      assert.equal(c.filter(x=>x.method==='POST').length,1);assert.equal(await p.evaluate(()=>__stored.length),0);
      const body=JSON.parse(c.find(x=>x.method==='POST').body);assert.equal(body.public,false);
      assert.deepEqual(Object.keys(JSON.parse(body.files['guitar_repertory.json'].content)).sort(),['categories','state']);
    });
    await run('empty remote stays empty instead of uploading local defaults',{data:{categories:[],state:{pieces:{},collapsed:{}}}},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.locator('#gistId').fill(ID);await p.evaluate(()=>connectGist());
      assert.equal(await p.evaluate(()=>Object.keys(state.pieces).length),0);assert(c.every(x=>x.method==='GET'));
    });
    await run('multiple matches require selection',{matches:[ID,ID2].map(id=>({id,description:'<img src=x onerror=alert(1)>',files:{'guitar_repertory.json':{}}}))},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.evaluate(()=>connectGist());
      assert.equal(await p.locator('#gistCandidates button').count(),2);assert.equal(await p.locator('#gistCandidates img').count(),0);
      assert(!await p.evaluate(()=>isGistConnected()));assert.equal(await p.evaluate(()=>__stored.length),0);
    });
    await run('invalid credential is never saved',{fail:true},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.locator('#gistId').fill(ID);await p.evaluate(()=>connectGist());
      assert(!await p.evaluate(()=>isGistConnected()));assert.equal(await p.evaluate(()=>__stored.length),0);
    });
    await run('unrelated Gist cannot become an upload target',{badFile:true},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.locator('#gistId').fill(ID);await p.evaluate(()=>connectGist());
      assert(!await p.evaluate(()=>isGistConnected()));assert(c.every(x=>x.method==='GET'));
    });
    await run('disconnect clears memory and blocks silent restoration',{legacy:{token:TOKEN,gistId:ID}},async(p,c)=>{
      await p.evaluate(()=>{disconnectGist();confirmCallback();});
      assert(!await p.evaluate(()=>isGistConnected()));assert.equal(await p.evaluate(()=>__pause),1);
      assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('guitar_gist_config')).autofillPaused),true);
    });
    const attack='<img src=x onerror="window.__injected=1">';
    const hostile=JSON.parse(JSON.stringify(fixture));
    hostile.categories[0].name=attack;hostile.categories[0].icon=attack;
    hostile.categories[0].id="x');window.__injected=1;//";
    hostile.categories[0].pieces[0]={title:attack,composer:attack};
    hostile.state.pieces={[attack]:{status:'연습중',memo:attack,scoreLink:'javascript:window.__injected=1',performances:[],duration:60}};
    await run('Gist text and URLs cannot inject HTML into repertoire',{data:hostile},async(p,c)=>{
      await p.evaluate(()=>openGistModal());await p.locator('#gistToken').fill(TOKEN);await p.locator('#gistId').fill(ID);await p.evaluate(()=>connectGist());
      assert(await p.evaluate(()=>isGistConnected()));assert.equal(await p.evaluate(()=>window.__injected),undefined);
      assert.equal(await p.locator('#categoriesContainer img, #rotationList img').count(),0);
      assert.equal(await p.locator('a[href^="javascript:"]').count(),0);
    });
    await run('mobile dialog layout and labels',{},async(p,c)=>{
      await p.setViewportSize({width:390,height:844});await p.evaluate(()=>openGistModal());
      await p.locator('#gistModal').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished)));
      assert.equal(await p.locator('#gistToken').getAttribute('autocomplete'),'current-password');
      assert.equal(await p.locator('#gistId').getAttribute('autocomplete'),'username');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      if (process.env.GIST_TEST_ARTIFACTS) await p.screenshot({path:path.join(process.env.GIST_TEST_ARTIFACTS,'gist-mobile.png'),fullPage:false});
    });
    console.log(JSON.stringify({passed:results.length,tests:results},null,2));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
