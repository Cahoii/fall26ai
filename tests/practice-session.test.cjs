const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('index.html','utf8');
const empty=()=>({known:[],wrong:[],attempts:0,correct:0,questionAttempts:{}});
function app(t,entries={},indexedDB=new IDBFactory()){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://study.test/'}),w=dom.window;
  const run=code=>vm.runInContext(code,dom.getInternalVMContext());
  w.katex=require('katex');Object.defineProperty(w,'indexedDB',{value:indexedDB});
  for(const [key,value] of Object.entries(entries))w.localStorage.setItem(key,value);
  w.fetch=async()=>({ok:false,status:401,headers:{get:()=> 'application/json'},json:async()=>({error:'offline test session'})});
  for(const file of ['math-format.js','question-revisions.js','practice-sync.js','account.js'])run(fs.readFileSync(file,'utf8'));
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('initializeAccount();',''));
  const close=()=>{run('practiceSync.stop()');dom.window.close();};t.after(close);
  const storage=()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const key=w.localStorage.key(i);return [key,w.localStorage.getItem(key)];}));
  const login=async(id,progress=empty())=>{run(`switchAccount(${JSON.stringify({user:id==null?null:{id,username:'user'+id},progress})})`);await run('syncReady');};
  return {w,run,storage,close,login};
}

test('closing and reopening restores guest position, selected answer, feedback and cumulative question count',async t=>{
  const a=app(t);a.run("navTo('practice');goToPractice(20)");
  const id=a.run('practice.pool[20].id');await a.run('selectPractice(practice.pool[20].answer)');
  assert.equal(a.w.document.querySelector('#practiceAttemptCount').textContent,'Đã trả lời 1 lần');
  const saved=a.storage();a.close();
  const b=app(t,saved);b.run("navTo('practice')");
  assert.equal(b.run('practice.index'),20);assert.equal(b.run('practice.pool[practice.index].id'),id);
  assert.equal(b.run('practice.checked'),true);assert.match(b.w.document.querySelector('.feedback').textContent,/Chính xác/);
  assert.equal(b.w.document.querySelector('#practiceAttemptCount').textContent,'Đã trả lời 1 lần');
  b.run('goToPractice(21);goToPractice(20)');assert.equal(b.run('progress.attempts'),1);assert.equal(b.run('practice.checked'),true);
});

test('next, numeric jump and lazy question grid can skip unanswered questions without creating attempts',t=>{
  const a=app(t);a.run("navTo('practice')");
  assert.equal(a.w.document.querySelector('#practiceNext').disabled,false);
  assert.equal(a.w.document.querySelectorAll('#practiceQuestionGrid button').length,0);
  a.w.document.querySelector('#practiceNext').click();assert.equal(a.run('practice.index'),1);
  a.w.document.querySelector('#practiceJump').value='100';
  a.w.document.querySelector('#practiceJumpForm').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(a.run('practice.index'),99);
  a.run('goToPractice(-1);goToPractice(99999);goToPractice(2.5)');assert.equal(a.run('practice.index'),99);
  const details=a.w.document.querySelector('#practiceMap');details.open=true;details.dispatchEvent(new a.w.Event('toggle'));
  assert.equal(a.w.document.querySelectorAll('#practiceQuestionGrid button').length,252);
  a.w.document.querySelector('[data-practice-index="5"]').click();assert.equal(a.run('practice.index'),5);
  assert.equal(a.run('progress.attempts'),0);
});

test('revisiting does not recount an answer; explicit retry increments once and restart preserves lifetime counts',async t=>{
  const a=app(t);a.run("navTo('practice')");await a.run("selectPractice('B')");
  a.run('goToPractice(1);goToPractice(0)');assert.equal(a.run('progress.questionAttempts[1]'),1);
  await a.run("selectPractice('B')");assert.equal(a.run('progress.questionAttempts[1]'),1);
  a.w.document.querySelector('#practiceRetry').click();assert.equal(a.run('practice.checked'),false);
  await a.run("selectPractice('A')");assert.equal(a.run('progress.questionAttempts[1]'),2);
  a.run('goToPractice(practice.pool.length-1);nextPractice()');
  assert.match(a.w.document.querySelector('.result-hero').textContent,/1 \/ 252/);
  a.w.document.querySelector('#practiceRestart').click();assert.equal(a.run('practice.index'),0);
  assert.equal(a.run('practice.checked'),false);assert.equal(a.run('progress.questionAttempts[1]'),2);
});

test('subject filter and position restore, while changed question content invalidates stale selected answers',async t=>{
  const a=app(t);a.run("practice.filter='Convolutional Neural Networks';resetPractice(false);goToPractice(4)");
  const id=a.run('practice.pool[practice.index].id');await a.run('selectPractice(practice.pool[practice.index].answer)');
  const saved=a.storage(),bank=JSON.parse(a.run('JSON.stringify(questions)'));
  bank.find(q=>q.id===id).question='Updated question content';saved['dpl302-study-custom-dataset-v1']=JSON.stringify(bank);
  const b=app(t,saved);b.run("navTo('practice')");
  assert.equal(b.run('practice.filter'),'Convolutional Neural Networks');assert.equal(b.run('practice.index'),4);
  assert.equal(b.run('practice.checked'),false);assert.equal(b.w.document.querySelector('.feedback'),null);
  assert.equal(b.run(`progress.questionAttempts[${id}]`),1);
});

test('positions remain separate for guest and each signed-in account',async t=>{
  const a=app(t);a.run("navTo('practice');goToPractice(3)");
  await a.login(1);a.run("navTo('practice');goToPractice(50)");
  await a.login(2);a.run("navTo('practice');goToPractice(80)");
  await a.login(1);assert.equal(a.run('practice.index'),50);
  await a.login(2);assert.equal(a.run('practice.index'),80);
  await a.login(null);assert.equal(a.run('practice.index'),3);
});

test('a signed-in pending answer restores from durable session and counts once before server acknowledgement',async t=>{
  const idb=new IDBFactory(),a=app(t,{},idb);await a.login(1);a.run("navTo('practice');goToPractice(65)");
  await a.run("selectPractice('B')");
  assert.equal(a.run('progress.questionAttempts[66]'),1);assert.equal(a.run('syncState.pending'),1);
  const saved=a.storage();a.close();
  const b=app(t,saved,idb);await b.login(1);b.run("navTo('practice')");
  assert.equal(b.run('practice.index'),65);assert.equal(b.run('practice.checked'),true);
  assert.equal(b.run('progress.questionAttempts[66]'),1);assert.equal(b.run('syncState.pending'),1);
  assert.equal(b.w.document.querySelector('#practiceAttemptCount').textContent,'Đã trả lời 1 lần');
});

test('invalid saved data falls back safely and saved positions never jump out of the current question bank',t=>{
  const a=app(t,{'dpl302-practice-session-v1':'broken json'});assert.equal(a.run('practice.index'),0);
  const b=app(t,{'dpl302-practice-session-v1':JSON.stringify({version:1,filter:'missing section',questionId:99999,index:99999,responses:{bad:{selected:'X'}}})});
  assert.equal(b.run('practice.filter'),'all');assert.equal(b.run('practice.index'),251);assert.equal(b.run('practice.checked'),false);
});
