const {test}=require('node:test');
const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const {IndexedQueue,PracticeSync,addAnswers}=require('../practice-sync.js');
const base=()=>({known:[],wrong:[],attempts:0,correct:0});
const payload=(n,selected='A')=>({eventId:'test-event-'+String(n).padStart(16,'0'),mode:'practice',answers:[{question:{id:n,question:'Question '+n,section:'Test',options:{A:'yes',B:'no',C:'c',D:'d'},answer:'A'},selected}]});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<1000;i++){if(check())return;await tick();}assert.fail('Condition did not settle');}
function harness({store=new IndexedQueue(new IDBFactory()),send,locks,timers}={}){
  let view;
  const engine=new PracticeSync({store,send:send|| (async p=>({progress:addAnswers(base(),p)})),locks,timers,onChange:s=>{view=s;}});
  return {engine,store,get view(){return view;}};
}

test('rapid answers are durable and optimistic before the first response, then reconcile once',async()=>{
  const first=deferred();let calls=0;let remote=base();
  const h=harness({send:async p=>{calls++;if(calls===1)await first.promise;remote=addAnswers(remote,p);return {progress:remote};}});
  await h.engine.start(1,base());await h.engine.enqueue(payload(1));await h.engine.enqueue(payload(2,'B'));await h.engine.enqueue(payload(3));
  assert.equal(h.view.progress.attempts,3);assert.equal(h.view.progress.correct,2);assert.equal(h.view.pending,3);
  first.resolve();await until(()=>h.view.pending===0);assert.equal(calls,3);assert.equal(h.view.progress.attempts,3);assert.equal(h.view.progress.correct,2);h.engine.stop();
});

test('a response lost after server commit survives reload and retries the same event without double counting',async()=>{
  const idb=new IDBFactory();const store=new IndexedQueue(idb);const timers={set:()=>1,clear:()=>{}};
  let remote=base();const seen=new Set();let lose=true;
  const send=async p=>{if(!seen.has(p.eventId)){remote=addAnswers(remote,p);seen.add(p.eventId);}if(lose)throw new Error('lost response');return {progress:remote};};
  const h=harness({store,send,timers});await h.engine.start(1,base());await h.engine.enqueue(payload(1));
  await until(()=>h.view.status==='error');assert.equal(remote.attempts,1);h.engine.stop();lose=false;
  const retry=harness({store:new IndexedQueue(idb),send});await retry.engine.start(1,remote);
  assert.equal(retry.view.progress.attempts,1);await until(()=>retry.view.pending===0);
  assert.equal(seen.size,1);assert.equal(retry.view.progress.attempts,1);retry.engine.stop();
});

test('account switch ignores an old response and retains that account queue for its next login',async()=>{
  const response=deferred();let sent=0;
  const h=harness({send:async()=>{sent++;return response.promise;}});
  await h.engine.start(1,base());await h.engine.enqueue(payload(1));await until(()=>sent===1);
  await h.engine.start(2,base());response.resolve({progress:{...base(),attempts:1,correct:1}});await tick();
  assert.equal(h.view.userId,2);assert.equal(h.view.progress.attempts,0);
  assert.equal((await h.store.update(1)).entries.length,1);h.engine.stop();
});

test('401 pauses until reauthentication, while invalid 400 stays blocked until manual retry',async()=>{
  for(const status of [401,400]){
    let calls=0;let reject=true;
    const h=harness({send:async p=>{calls++;if(reject)throw Object.assign(new Error('rejected'),{status});return {progress:addAnswers(base(),p)};}});
    await h.engine.start(1,base());await h.engine.enqueue(payload(status));await until(()=>h.view.status==='error');
    assert.equal(h.view.authRequired,status===401);await until(()=>!h.engine.session.running);
    await h.engine.retry();await tick();assert.equal(calls,1);
    reject=false;
    if(status===401)await h.engine.start(1,base());else await h.engine.retry(true);
    await until(()=>h.view.pending===0);assert.equal(calls,2);h.engine.stop();
  }
});

test('transient failures use exponential backoff capped at 30 seconds',async()=>{
  let task;const delays=[];
  const h=harness({send:async()=>{throw new Error('offline');},timers:{set:(fn,ms)=>{task=fn;delays.push(ms);return 1;},clear:()=>{}}});
  await h.engine.start(1,base());await h.engine.enqueue(payload(1));
  for(let n=1;n<=7;n++){await until(()=>delays.length===n&&!h.engine.session.running);if(n<7){task();}}
  assert.deepEqual(delays,[1000,2000,4000,8000,16000,30000,30000]);assert.equal(h.view.pending,1);h.engine.stop();
});

test('multiple tabs without Web Locks may resend but cannot inflate optimistic totals or regress progress',async()=>{
  const idb=new IDBFactory();const seen=new Set();let remote=base();let calls=0;const gate=deferred();
  const send=async p=>{calls++;await gate.promise;if(!seen.has(p.eventId)){seen.add(p.eventId);remote=addAnswers(remote,p);}return {progress:structuredClone(remote)};};
  const a=harness({store:new IndexedQueue(idb),send}),b=harness({store:new IndexedQueue(idb),send});
  await a.engine.start(1,base());await b.engine.start(1,base());await a.engine.enqueue(payload(1));
  await b.engine.refresh();b.engine.pump();await until(()=>calls===2);gate.resolve();await until(()=>a.view.pending===0&&b.view.pending===0);
  assert.equal(remote.attempts,1);assert.equal(a.view.progress.attempts,1);assert.equal(b.view.progress.attempts,1);
  await a.engine.confirm(base());assert.equal(a.view.progress.attempts,1);a.engine.stop();b.engine.stop();
});

test('Web Locks serialize workers across tabs and maintain question order',async()=>{
  let tail=Promise.resolve();let active=0,maxActive=0;const order=[];let remote=base();
  const locks={request:(name,options,fn)=>{const work=tail.then(fn);tail=work.catch(()=>{});return work;}};
  const idb=new IDBFactory();
  const send=async p=>{active++;maxActive=Math.max(maxActive,active);await tick();order.push(p.answers[0].question.id);remote=addAnswers(remote,p);active--;return {progress:structuredClone(remote)};};
  const a=harness({store:new IndexedQueue(idb),send,locks}),b=harness({store:new IndexedQueue(idb),send,locks});
  await a.engine.start(1,base());await b.engine.start(1,base());await a.engine.enqueue(payload(1));await b.engine.enqueue(payload(2));
  await until(()=>remote.attempts===2);assert.deepEqual(order,[1,2]);assert.equal(maxActive,1);a.engine.stop();b.engine.stop();
});

test('foreground test submissions and flashcards preserve pending practice totals and known status',async()=>{
  const gate=deferred();const h=harness({send:()=>gate.promise});await h.engine.start(1,base());await h.engine.enqueue(payload(1));
  const testPayload={...payload(2),mode:'test'};
  await h.engine.confirm({...base(),attempts:2,correct:2},testPayload);
  await h.engine.confirm({...base(),attempts:2,correct:2},testPayload); // Idempotent foreground retry.
  await h.engine.confirm({...base(),known:[5],attempts:1,correct:1},null,true);
  assert.equal(h.view.progress.attempts,2);assert.deepEqual(h.view.progress.known,[5]);
  gate.resolve({progress:{...base(),attempts:2,correct:2}});await until(()=>h.view.pending===0);
  assert.equal(h.view.progress.attempts,2);assert.deepEqual(h.view.progress.known,[5]);h.engine.stop();
});

test('unavailable IndexedDB requests foreground fallback instead of dropping the answer',async()=>{
  const h=harness({store:new IndexedQueue(undefined)});await h.engine.start(1,base());
  assert.equal(h.view.status,'unavailable');await assert.rejects(()=>h.engine.enqueue(payload(1)));
  await h.engine.confirm({ ...base(),attempts:1,correct:1},payload(1));assert.equal(h.view.progress.attempts,1);h.engine.stop();
});

test('a local storage failure after successful foreground save does not fail that submission',async()=>{
  const store=new IndexedQueue(new IDBFactory());const h=harness({store});await h.engine.start(1,base());
  store.confirm=async()=>{throw new Error('Quota exceeded');};
  await h.engine.confirm({...base(),attempts:1,correct:1},payload(1));
  assert.equal(h.view.progress.attempts,1);assert.match(h.view.error,/Đã lưu lượt này/);h.engine.stop();
});

test('question snapshots cannot change while queued, and other accounts cannot drain them',async()=>{
  const store=new IndexedQueue(new IDBFactory());const h=harness({store,send:async()=>{throw Object.assign(new Error('auth'),{status:401});}});
  await h.engine.start(1,base());const p=payload(1);await h.engine.enqueue(p);p.answers[0].question.answer='B';
  await until(()=>h.view.authRequired);h.engine.stop();
  assert.equal((await store.update(1)).entries[0].payload.answers[0].question.answer,'A');
  let sends=0;const other=harness({store,send:async()=>{sends++;}});await other.engine.start(2,base());await tick();
  assert.equal(other.view.pending,0);assert.equal(sends,0);other.engine.stop();
});

test('per-question counts include queued answers exactly once and skip unanswered test items',async()=>{
  const gate=deferred();const initial={...base(),attempts:5,correct:5,questionAttempts:{1:5}};
  const h=harness({send:()=>gate.promise});await h.engine.start(1,initial);await h.engine.enqueue(payload(1));
  assert.equal(h.view.progress.questionAttempts[1],6);
  gate.resolve({progress:{...initial,attempts:6,correct:6,questionAttempts:{1:6}}});
  await until(()=>h.view.pending===0);assert.equal(h.view.progress.questionAttempts[1],6);h.engine.stop();
  assert.deepEqual(addAnswers({...base(),questionAttempts:{}},payload(2,null)).questionAttempts,{});
});

test('an older outbox without question counters waits for reconciliation instead of showing incomplete historical totals',async()=>{
  const store=new IndexedQueue(new IDBFactory());
  await store.attach(1,base());await store.enqueue(1,payload(1));
  const gate=deferred(),h=harness({store,send:()=>gate.promise});
  await h.engine.start(1,{...base(),attempts:8,questionAttempts:{1:8}});
  assert.equal(h.view.questionCountsReady,false);
  gate.resolve({progress:{...base(),attempts:9,correct:1,questionAttempts:{1:9}}});
  await until(()=>h.view.pending===0);
  assert.equal(h.view.questionCountsReady,true);assert.equal(h.view.progress.questionAttempts[1],9);h.engine.stop();
});
