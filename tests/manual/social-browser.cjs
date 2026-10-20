const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const width of [1440,390])for(const theme of ['light','dark']){
      const page=await browser.newPage({viewport:{width,height:900}}),errors=[],messages=[];
      let visible=true;
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/atlas-api/v1/**',async route=>{
        const req=route.request(),url=new URL(req.url()),body=req.postDataJSON?.()||{};
        let data={ok:true};
        if(url.pathname.endsWith('/presence')){if(typeof body.visible==='boolean')visible=body.visible;data={visible};}
        if(url.pathname.endsWith('/people'))data={people:[{id:'b',name:'Pessoa Teste',title:'Analista',status:'online',unread:0},{id:'c',name:'Outra Pessoa',title:'Gestor',status:'away',unread:0}]};
        if(url.pathname.endsWith('/conversations'))data={id:'test-chat'};
        if(url.pathname.endsWith('/messages')){
          if(req.method()==='POST')messages.push({id:String(messages.length+1),sender_id:'a',body:body.text,attachments:[],created_at:new Date().toISOString()});
          data=req.method()==='POST'?{message:messages.at(-1)}:{messages,peerRead:'0'};
        }
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/?atlasTest=1`);
      await page.waitForSelector('.atlas-v2-home-shell');
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.AtlasSocial.start({getToken:()=> 'test',getUser:()=>({id:'a'}),notify:()=>{}});},theme);
      await page.locator('#atlas-social-toggle').click();
      await page.waitForSelector('[data-person="b"]');
      await page.locator('.atlas-social-online input').check();
      assert.equal(await page.locator('.atlas-social-people button').count(),1);
      await page.locator('.atlas-social-online input').uncheck();
      await page.locator('[data-social="visibility"]').selectOption('false');
      await page.waitForTimeout(100);assert.equal(visible,false);
      await page.locator('[data-person="b"]').click();
      await page.waitForSelector('.atlas-social-compose:not([hidden])');
      await page.locator('.atlas-social-compose textarea').fill('Ola <script>teste</script>');
      await page.locator('.atlas-social-compose [type="submit"]').click();
      await page.waitForSelector('.atlas-social-message');
      assert.equal(await page.locator('.atlas-social-message p').innerText(),'Ola <script>teste</script>');
      assert.equal(await page.locator('.atlas-social-message script').count(),0);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(__dirname,`social-${width}-${theme}.png`)});
      await page.evaluate(()=>window.AtlasSocial.stop());
      assert.equal(await page.locator('#atlas-social').count(),0);
      assert.deepEqual(errors,[]);await page.close();
    }
    console.log('Social UI: pessoas, filtro online, invisibilidade, envio, escape, logout e desktop/mobile aprovados.');
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
