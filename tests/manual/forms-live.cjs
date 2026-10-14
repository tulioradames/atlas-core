'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let chromium;
try{({chromium}=require('playwright'));}catch(_){({chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));}
(async()=>{
  const target=process.env.ATLAS_PUBLIC_FORM_TEST_URL;
  const appTarget=process.env.ATLAS_BROWSER_TARGET;
  if(!target||!appTarget)throw new Error('Informe ATLAS_PUBLIC_FORM_TEST_URL e ATLAS_BROWSER_TARGET para o ambiente isolado de teste.');
  const targetUrl=new URL(target);
  const appUrl=new URL(appTarget);
  if(targetUrl.protocol!=='https:'||appUrl.protocol!=='https:')throw new Error('Os alvos manuais precisam usar HTTPS.');
  const root=path.resolve(__dirname,'../..');
  const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
  const browser=await chromium.launch({headless:true,executablePath});
  const errors=[];
  try{
    for(const width of process.env.ATLAS_REALTIME_ONLY ? [] : [320,390,1440]){
      const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',error=>errors.push(error.message));
      await page.goto(target);await page.locator('#form-content').waitFor({state:'visible'});
      const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(metrics.scroll<=metrics.width+1);
      await page.getByLabel('Cidade ou nome da solicitacao').fill(`Navegador ${width} - V2.4.5`);
      await page.getByLabel('Descreva a solicitacao').fill('Resposta sintetica enviada pelo navegador no ambiente isolado.');
      await page.getByLabel('Quantidade').fill('25.5');await page.getByLabel('Prioridade').selectOption('Normal');
      await page.screenshot({path:path.join(root,`tests/forms-live-${width}.png`),fullPage:true});
      await page.locator('#form-submit').click();await page.locator('#form-success').waitFor({state:'visible'});
      await page.close();
    }
    const page=await browser.newPage();
    page.on('websocket',socket=>socket.on('socketerror',message=>console.log('WS diagnostic:',String(message).replace(/apikey=[^&\s]+/g,'apikey=[redacted]'))));
    await page.goto(appUrl.href);
    await page.waitForFunction(()=>window.ATNX_CONFIG&&window.supabase);
    const realtime=await page.evaluate(async()=>{
      const client=window.supabase.createClient(ATNX_CONFIG.SUPABASE_URL,ATNX_CONFIG.SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const channel=client.channel('atlas-v245-validation-only',{config:{private:false}});
      const status=await new Promise(resolve=>{const timer=setTimeout(()=>resolve({state:'TIMEOUT'}),15000);channel.subscribe((state,error)=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(state)){clearTimeout(timer);resolve({state,error:String(error?.message||error||'')});}});});
      await client.removeChannel(channel);
      const denied=client.channel('atlas-v2-board:d2450000-0000-4000-8000-000000000003',{config:{private:true}});
      const privateStatus=await new Promise(resolve=>{const timer=setTimeout(()=>resolve('TIMEOUT'),15000);denied.subscribe(state=>{if(['SUBSCRIBED','CHANNEL_ERROR','TIMED_OUT'].includes(state)){clearTimeout(timer);resolve(state);}});});
      await client.removeChannel(denied);return {public:status,privateAnonymous:privateStatus};
    });
    console.log('Realtime public diagnostic channel:',realtime);
    assert.equal(realtime.public.state,'SUBSCRIBED');assert.equal(realtime.privateAnonymous,'CHANNEL_ERROR');
    assert.deepEqual(errors,[]);if(!process.env.ATLAS_REALTIME_ONLY)console.log('PASS live forms: real anonymous submissions at 320/390/1440px');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
