const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const L=require('../learning.js');
const bank=JSON.parse(fs.readFileSync('questions.json','utf8'));
function rng(seed=42){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('mastery increments, caps, loses two levels and never promotes an immediate retry',()=>{
  let n=0;for(let i=0;i<5;i++)n=L.transition(n,true);assert.equal(n,3);
  n=L.transition(n,false);assert.equal(n,1);n=L.transition(n,true,false);assert.equal(n,1);
  assert.equal(L.transition(0,false),0);assert.equal(L.transition(1,false),0);assert.equal(L.transition(2,false),0);
});
test('mastery replay sorts performed times, deduplicates event IDs and consumes session eligibility on wrong answers',()=>{
  const events=[
    {eventId:'b',sessionId:'run1',time:20,answers:[{id:1,correct:true,eligible:true}]},
    {eventId:'a',sessionId:'run1',time:10,answers:[{id:1,correct:false,eligible:true}]},
    {eventId:'c',sessionId:'run2',time:30,answers:[{id:1,correct:true,eligible:true}]}
  ];
  assert.equal(L.replay({1:3},[...events,events[2]])[1],2);
  assert.equal(L.replay({1:0},[events[0],{...events[0],eventId:'d',time:21}])[1],1);
});
test('ratio adjustments always keep integer percentages 20–40 and exactly 100%',()=>{
  assert.deepEqual(L.adjust([25,25,25,25],0,40),[40,20,20,20]);
  assert.deepEqual(L.adjust([40,20,20,20],0,25),[25,25,25,25]);
  let values=[25,25,25,25];const random=rng();
  for(let i=0;i<3000;i++){
    values=L.adjust(values,Math.floor(random()*4),Math.floor(random()*100)-20);
    assert.equal(values.reduce((a,b)=>a+b),100);assert.ok(values.every(n=>Number.isInteger(n)&&n>=20&&n<=40));
  }
});
test('mixed exams honor quotas, never repeat, and unshuffled display still uses weighted selection',()=>{
  for(const size of ['10','20','50']){
    const settings={filter:'all',size,ratios:[40,20,20,20],shuffle:false};
    const questions=L.createExam(bank,settings,{},rng());
    assert.equal(questions.length,Number(size));assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
    assert.deepEqual(L.topics.map(name=>questions.filter(q=>q.section===name).length),[.4,.2,.2,.2].map(p=>p*Number(size)));
    assert.deepEqual(questions.map(q=>q.id),questions.map(q=>q.id).sort((a,b)=>a-b));
  }
  assert.deepEqual(L.allocate(10,[25,25,25,25]),[3,3,2,2]);
  assert.notDeepEqual(L.createExam(bank,{filter:'all',size:'10',ratios:[25,25,25,25],shuffle:false},{},rng(1)),L.createExam(bank,{filter:'all',size:'10',ratios:[25,25,25,25],shuffle:false},{},rng(2)));
});
test('seeded sampling frequencies follow 8/4/2/1 without excluding mastered questions',()=>{
  const pool=[0,1,2,3].map(id=>({id})),mastery={0:0,1:1,2:2,3:3},counts=[0,0,0,0],random=rng(712);
  for(let i=0;i<15000;i++)counts[L.sample(pool,1,mastery,random)[0].id]++;
  counts.forEach((count,i)=>assert.ok(Math.abs(count/15000-L.weights[i]/15)<.02,JSON.stringify(counts)));
});
test('shortages block mixed exams; whole-bank and single-topic exams preserve their own scope',()=>{
  const settings={filter:'all',size:'50',ratios:[25,25,25,25],shuffle:true};
  const tiny=L.topics.map((section,id)=>({id,section}));
  assert.match(L.blueprint(tiny,settings).error,/cần/);assert.throws(()=>L.createExam(tiny,settings),/Giảm số câu/);
  const whole=L.createExam(bank,{...settings,size:'all'},{},rng());assert.equal(whole.length,252);
  const single=L.createExam(bank,{...settings,filter:L.topics[3],size:'all'},{},rng());assert.equal(single.length,35);assert.ok(single.every(q=>q.section===L.topics[3]));
  assert.throws(()=>L.createExam(bank,{...settings,filter:L.topics[3],size:'50'}),/có 35 câu, cần 50/);
  assert.equal(L.createExam([...bank,bank[0]],{...settings,size:'all'}).length,252);
});
