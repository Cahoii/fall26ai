const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {performance}=require('node:perf_hooks');
const {JSDOM}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('index.html','utf8');
async function setup(indexedDB=new IDBFactory()){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://study.test/'});
  const w=dom.window;
  w.eval=code=>vm.runInContext(code,dom.getInternalVMContext());
  Object.defineProperty(w,'indexedDB',{value:indexedDB});
  w.katex=require('katex');
  w.eval(fs.readFileSync('math-format.js','utf8'));
  w.eval(fs.readFileSync('question-revisions.js','utf8'));
  w.eval(fs.readFileSync('learning.js','utf8'));
  w.eval(fs.readFileSync('practice-sync.js','utf8'));
  w.eval(fs.readFileSync('account.js','utf8'));
  w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('initializeAccount();',''));
  w.eval("switchAccount({user:{id:1,username:'test'},progress:{known:[],wrong:[],attempts:0,correct:0}})");
  await w.eval('syncReady');w.eval("navTo('practice')");
  return {dom,w};
}
test('actual practice UI displays feedback under 100ms with a 2-second API delay and ignores double-clicks',async t=>{
  const {dom,w}=await setup();t.after(()=>{w.eval('practiceSync.stop()');dom.window.close();});
  let responses=0;
  w.eval("practice.pool=[questions.find(q=>q.id===66),questions.find(q=>q.id===102)];practice.index=0;renderView()");
  w.fetch=async()=>{await new Promise(r=>setTimeout(r,2000));responses++;return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({progress:{known:[],wrong:[],attempts:1,correct:1},answers:{1:'B'}})};};
  const start=performance.now();
  const done=w.eval("selectPractice('B')");
  assert.match(w.document.querySelector('.feedback').textContent,/Chính xác/);
  const elapsed=performance.now()-start;
  assert.ok(elapsed<100,`Feedback took ${elapsed.toFixed(1)}ms`);
  await w.eval("selectPractice('B')");await done;
  assert.equal(responses,0);assert.equal(w.document.querySelector('#practiceNext').disabled,false);
  assert.equal(w.eval('syncState.pending'),1);w.eval('nextPractice()');assert.equal(w.eval('practice.index'),1);
  await new Promise(r=>setTimeout(r,2100));assert.equal(responses,1);assert.equal(w.eval('progress.attempts'),1);
  console.log(`Practice feedback: ${elapsed.toFixed(1)}ms with API delayed 2000ms`);
});

test('IndexedDB failure still shows feedback immediately, but next stays disabled until foreground save succeeds',async t=>{
  const {dom,w}=await setup(undefined);t.after(()=>{w.eval('practiceSync.stop()');dom.window.close();});
  // Force unavailable storage explicitly (default function argument creates a factory).
  w.eval('practiceSync.session.storageError=true');
  let release;w.fetch=()=>new Promise(resolve=>{release=()=>resolve({ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({progress:{known:[],wrong:[],attempts:1,correct:1},answers:{1:'B'}})});});
  const done=w.eval("selectPractice('B')");
  assert.match(w.document.querySelector('.feedback').textContent,/Chính xác/);
  await new Promise(r=>setImmediate(r));assert.equal(w.document.querySelector('#practiceNext').disabled,true);
  release();await done;assert.equal(w.document.querySelector('#practiceNext').disabled,false);assert.equal(w.eval('progress.attempts'),1);
});
