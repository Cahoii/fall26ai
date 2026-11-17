const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync('index.html','utf8');
const empty=()=>({known:[],wrong:[],attempts:0,correct:0,questionAttempts:{}});

test('retry wrong exam includes blanks, clears answers, creates a new session and updates mastery only on submission',async t=>{
  const a=app(t);
  a.run(`test={active:true,pool:questions.slice(0,3),index:0,answers:{},submitted:false,
    eventId:newEventId(),learningSessionId:newEventId()};
    test.answers[test.pool[0].id]=test.pool[0].answer;
    test.answers[test.pool[1].id]=Object.keys(test.pool[1].options).find(k=>k!==test.pool[1].answer);
    navTo('test');`);
  await a.run('submitTest()');
  const oldEvent=a.run('test.eventId'),oldSession=a.run('test.learningSessionId');
  assert.match(a.w.document.querySelector('#testRetryWrong').textContent,/\(2\)/);
  a.w.document.querySelector('#testRetryWrong').click();
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(test.pool.map(q=>q.id))')),[2,3]);
  assert.equal(a.run('Object.keys(test.answers).length'),0);
  assert.equal(a.run('test.index'),0);assert.equal(a.run('test.submitted'),false);
  assert.notEqual(a.run('test.eventId'),oldEvent);assert.notEqual(a.run('test.learningSessionId'),oldSession);
  assert.equal(a.run('test.answeredAt'),null);assert.equal(a.run('progress.attempts'),3);
  assert.match(a.w.document.querySelector('.page-title').textContent,/Làm lại câu sai/);
  assert.equal(a.w.document.querySelector('.feedback'),null);
  a.run('test.answers[test.pool[0].id]=test.pool[0].answer');
  await a.run('submitTest()');
  assert.equal(a.run('progress.attempts'),5);assert.equal(a.run('progress.mastery[2]'),1);
  assert.equal(a.run('progress.mastery[3]'),0);
  a.w.document.querySelector('#testRetryWrong').click();
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(test.pool.map(q=>q.id))')),[3]);
  a.run('test.answers[test.pool[0].id]=test.pool[0].answer');await a.run('submitTest()');
  assert.equal(a.w.document.querySelector('#testRetryWrong'),null);
  assert.ok(a.w.document.querySelector('#testAgain'));
  assert.equal(a.run('progress.mastery[3]'),1);assert.equal(a.run('progress.attempts'),6);
});

function app(t,entries={},indexedDB=new IDBFactory()){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://study.test/'}),w=dom.window;
  const run=code=>vm.runInContext(code,dom.getInternalVMContext());
  w.katex=require('katex');Object.defineProperty(w,'indexedDB',{value:indexedDB});
  for(const [key,value] of Object.entries(entries))w.localStorage.setItem(key,value);
  w.fetch=async()=>({ok:false,status:401,headers:{get:()=> 'application/json'},json:async()=>({error:'offline test session'})});
  for(const file of ['learning.js','math-format.js','question-revisions.js','practice-sync.js','account.js'])run(fs.readFileSync(file,'utf8'));
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

test('mastery tags reflect promotion, same-session retry protection, minus-two penalties and new practice sessions',async t=>{
  const a=app(t);a.run("progress.mastery={1:2};navTo('practice')");
  assert.equal(a.w.document.querySelector('[data-mastery-question="1"]').textContent,'Nhớ');
  const original=a.run('practice.learningSessionId');
  await a.run("selectPractice('B')");assert.equal(a.run('progress.mastery[1]'),3);
  a.run('retryPracticeQuestion()');await a.run("selectPractice('B')");assert.equal(a.run('progress.mastery[1]'),3);
  a.run('retryPracticeQuestion()');await a.run("selectPractice('A')");assert.equal(a.run('progress.mastery[1]'),1);
  a.run('retryPracticeQuestion()');await a.run("selectPractice('B')");assert.equal(a.run('progress.mastery[1]'),1);
  const saved=a.storage();const b=app(t,saved);assert.equal(b.run('practice.learningSessionId'),original);assert.equal(b.run('practice.masterySeen[1]'),true);
  a.run('resetPractice()');assert.notEqual(a.run('practice.learningSessionId'),original);
  await a.run("selectPractice('B')");assert.equal(a.run('progress.mastery[1]'),2);
  assert.equal(a.w.document.querySelector('[data-mastery-question="1"]').textContent,'Nhớ');
});

test('ratio setup auto-balances, previews actual counts and scores blanks only when an exam is submitted',async t=>{
  const a=app(t);a.run("navTo('test')");
  const first=a.w.document.querySelector('[data-topic-ratio="0"]');first.value='40';first.dispatchEvent(new a.w.Event('change'));
  assert.deepEqual(Array.from(a.w.document.querySelectorAll('[data-topic-ratio]'),input=>Number(input.value)),[40,20,20,20]);
  a.w.document.querySelector('#testSize').value='10';a.w.document.querySelector('#testSize').dispatchEvent(new a.w.Event('change'));
  a.w.document.querySelector('#startTest').click();
  assert.deepEqual(JSON.parse(a.run('JSON.stringify(Learning.topics.map(s=>test.pool.filter(q=>q.section===s).length))')),[4,2,2,2]);
  a.run('progress.mastery=Object.fromEntries(test.pool.map(q=>[q.id,3]));test.answers[test.pool[0].id]=test.pool[0].answer;');
  await a.run('submitTest()');
  assert.equal(a.run('progress.mastery[test.pool[0].id]'),3);assert.equal(a.run('progress.mastery[test.pool[1].id]'),1);
  assert.equal(a.run('progress.questionAttempts[test.pool[1].id]'),undefined);
});

test('ratio preferences are account-scoped and whole-bank or shortage previews communicate constraints',async t=>{
  const a=app(t);await a.login(1);a.run("navTo('test')");
  const first=a.w.document.querySelector('[data-topic-ratio="0"]');first.value='40';first.dispatchEvent(new a.w.Event('change'));
  await a.login(2);a.run("navTo('test')");assert.equal(a.w.document.querySelector('[data-topic-ratio="0"]').value,'25');
  await a.login(1);a.run("navTo('test')");assert.equal(a.w.document.querySelector('[data-topic-ratio="0"]').value,'40');
  a.w.document.querySelector('#testSize').value='all';a.w.document.querySelector('#testSize').dispatchEvent(new a.w.Event('change'));
  assert.equal(a.w.document.querySelector('[data-topic-ratio="0"]').disabled,true);assert.match(a.w.document.querySelector('#examPreview').textContent,/tỷ lệ thực tế/);
  a.run("questions=Learning.topics.map((section,id)=>({id,section}));writeJSON(personalKey(STORAGE.exam),{filter:'all',size:'50',ratios:[25,25,25,25]});renderView()");
  assert.equal(a.w.document.querySelector('#startTest').disabled,true);assert.match(a.w.document.querySelector('#examPreview').textContent,/cần/);
});
