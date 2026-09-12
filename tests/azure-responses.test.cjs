const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function setup() {
 const memory = new Map();
 const context = vm.createContext({console: {log(){},warn(){},error(){}}, URL, AbortController, TextDecoder, setTimeout, clearTimeout,
 document: {querySelector: () => null}, location: {protocol:'http:'},
 localStorage: {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
 CryptoHelper: {getInstance: {encrypt:v=>'encrypted:'+v,isEncrypted:v=>typeof v==='string'&&v.startsWith('encrypted:'),decrypt:v=>v.slice(10)}}});
 context.window=context;
 for(const file of ['config.js','storage.js','tools/toolExecutor.js','responsesApi.js','api.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/public/js/core',file),'utf8'),context);
 for (const name of ['Storage','ResponsesAPI','AIAPI','ToolExecutor']) context[name]=vm.runInContext(name,context);
 context.model=context.CONFIG.MODELS.OPENAI[0];
 context.apiSettings={apiType:'azure',azureApiKey:'dummy-key',azureResponsesEndpoint:'https://example.azure-api.net/service-apı-sweden/openai/responses?api-version=2025-04-01-preview',azureDeployments:{[context.model]:'deployment-custom'},azureEndpoints:{[context.model]:'https://old.example/openai/deployments/legacy/chat/completions?api-version=old'}};
 context.calls=[];
 context.fetch=async (url,init)=>{context.calls.push({url,...init,body:JSON.parse(init.body)});return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]})}};
 return context;
}
const messages=[{role:'system',content:'instructions'},{role:'user',content:'hello'},{role:'assistant',content:'hi'},{role:'user',content:'again'}];
test('common endpoint routes ordinary chat, preserves path/query and deployment; settings round trip',async()=>{
 const c=setup(); c.Storage.getInstance.saveApiSettings(c.apiSettings); c.apiSettings=c.Storage.getInstance.loadApiSettings();
 assert.equal(c.apiSettings.azureDeployments[c.model],'deployment-custom');
 assert.equal(await c.AIAPI.getInstance.callAIAPI(messages,c.model,[],{enableWebSearch:false}),'OK');
 const req=c.calls[0];assert.equal(req.url,'/azure-openai');assert.equal(req.body.targetUrl,c.apiSettings.azureResponsesEndpoint);assert.equal(req.body.body.model,'deployment-custom');assert.equal(req.body.body.instructions,'instructions');assert.equal(req.body.body.input.length,3);assert.deepEqual(req.body.body.tools,[]);
});
test('URL normalization and invalid or missing settings fail before fetch',async()=>{
 const c=setup(), api=c.ResponsesAPI.getInstance;
 assert.equal(api.normalizeAzureEndpoint('  '+c.apiSettings.azureResponsesEndpoint.replace('/openai','\n/openai')+'  '),c.apiSettings.azureResponsesEndpoint);
 for(const url of ['abc','ftp://a/responses','https://a/chat/completions','https://a/responses#x']) assert.throws(()=>api.normalizeAzureEndpoint(url));
 c.apiSettings.azureDeployments={};await assert.rejects(api.callResponsesAPI(messages,c.model),/デプロイ名/);assert.equal(c.calls.length,0);
 c.apiSettings.azureApiKey='';await assert.rejects(api.callResponsesAPI(messages,c.model),/APIキー/);
});
test('OpenAI selection does not use saved Azure; legacy chat route remains',async()=>{
 const c=setup();c.apiSettings.apiType='openai';c.apiSettings.openaiApiKey='openai-dummy';
 await c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model);
 assert.equal(c.calls[0].url,c.CONFIG.AIAPI.ENDPOINTS.RESPONSES);assert.equal(c.calls[0].headers.Authorization,'Bearer openai-dummy');
 c.apiSettings.apiType='azure';c.apiSettings.azureResponsesEndpoint='';c.OpenAIAPI={getInstance:{callOpenAIAPI:async()=>'legacy'}};
 assert.equal(await c.AIAPI.getInstance.callAIAPI(messages,c.model),'legacy');
 await c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model);assert.equal(c.calls[1].body.body.model,'legacy');
});
test('image request and non-stream function call result',async()=>{
 const c=setup(), calls=[]; c.fetch=async(url,init)=>{c.calls.push(JSON.parse(init.body));return {ok:true,json:async()=>({output:[{type:'function_call',call_id:'call1',name:'echo',arguments:'{"value":1}'}]})}};
 await c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model,[{type:'image',data:'data:image/png;base64,AA=='}],{enableTools:true,tools:[{type:'function',function:{name:'echo',parameters:{type:'object'}}}],onToolCall:r=>calls.push(r)});
 assert.equal(c.calls[0].body.input[2].content[0].type,'input_text');assert.equal(c.calls[0].body.input[2].content[1].type,'input_image');assert.equal(c.calls[0].body.tools[0].name,'echo');assert.equal(calls[0].toolCall.arguments.value,1);
});
function sse(c,events) {
 const bytes=new TextEncoder().encode(events.map(e=>'data: '+JSON.stringify(e)+'\r\n\r\n').join('').trimEnd());
 let at=0;c.fetch=async()=>({ok:true,body:{getReader:()=>({read:async()=>at<bytes.length?{value:bytes.slice(at,at+=3),done:false}:{done:true}})}});
}
test('split UTF-8 SSE preserves repeated deltas, completion once and final unterminated data',async()=>{
 const c=setup();sse(c,[{type:'response.output_text.delta',delta:'あ'},{type:'response.output_text.delta',delta:'あ'},{type:'response.output_text.done',text:'ああ'},{type:'response.completed',response:{status:'completed'}}]);
 let text='',complete=[];await c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model,[],{stream:true,onChunk:x=>text+=x,onComplete:x=>complete.push(x)});
 assert.equal(text,'ああ');assert.deepEqual(complete,['ああ']);
});
test('failed SSE and HTTP errors surface; aborted signal reaches fetch',async()=>{
 for(const type of ['error','response.failed','response.incomplete']){const c=setup();sse(c,[{type}]);await assert.rejects(c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model,[],{stream:true}));}
 for(const status of [401,404,429]){const c=setup();c.fetch=async()=>({ok:false,status,text:async()=>'denied'});await assert.rejects(c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model),new RegExp(String(status)));}
 const c=setup(),abort=new AbortController();abort.abort();c.fetch=async(u,i)=>{assert.equal(i.signal.aborted,true);throw new DOMException('aborted','AbortError')};await assert.rejects(c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model,[],{signal:abort.signal}),{name:'AbortError'});
});
test('stream tool completion feeds an ordinary user tool result into next turn',async()=>{
 const c=setup(), found=[];sse(c,[{type:'response.output_item.added',item:{type:'function_call',call_id:'round1',name:'echo'}},{type:'response.function_call_arguments.done',call_id:'round1',arguments:'{"value":7}'},{type:'response.output_item.done',item:{type:'function_call',call_id:'round1',name:'echo',arguments:'{"value":7}'}}]);
 await c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model,[],{stream:true,onToolCall:e=>{if(e.type==='complete')found.push(e.toolCall)}});assert.equal(found.length,1);
 c.fetch=async(u,i)=>{c.calls.push(JSON.parse(i.body));return {ok:true,json:async()=>({output:[]})}};
 await c.ResponsesAPI.getInstance.callResponsesAPI([...messages,{role:'user',content:'<tool_result>7</tool_result>'}],c.model);assert.equal(c.calls[0].body.input.at(-1).content,'<tool_result>7</tool_result>');
});
test('mid-stream cancellation preserves partial text once and releases fetch signal',async()=>{
 const c=setup(),abort=new AbortController();let complete=[],reads=0;
 c.fetch=async(u,i)=>({ok:true,body:{getReader:()=>({read:async()=>{
  if(reads++===0)return {done:false,value:new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')};
  if(i.signal.aborted)throw new DOMException('aborted','AbortError');
  throw Error('Expected cancellation');
 }})}});
 await assert.rejects(c.ResponsesAPI.getInstance.callResponsesAPI(messages,c.model,[],{stream:true,signal:abort.signal,onChunk:()=>abort.abort(),onComplete:t=>complete.push(t)}),{name:'AbortError'});
 assert.deepEqual(complete,['partial']);
});
