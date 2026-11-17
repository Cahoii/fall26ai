const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const katex=require('katex');
const {JSDOM}=require('jsdom');
globalThis.katex=katex;
const {formatContent}=require('../math-format.js');
const {applyQuestionRevisions,revisions}=require('../question-revisions.js');
const questions=JSON.parse(fs.readFileSync('questions.json','utf8'));
const html=fs.readFileSync('index.html','utf8');

test('all corrected questions have valid LaTeX, preserve source answers, and agree across data files',()=>{
  const embedded=JSON.parse(html.match(/const DEFAULT_QUESTIONS = (.*);\r?\n/)[1]);
  assert.deepEqual(embedded,questions);
  assert.deepEqual(revisions.map(r=>[r.after.id,r.after.answer]),[
    [66,'B'],[102,'A'],[113,'C'],[115,'D'],[128,'D'],
    [203,'B'],[209,'A'],[210,'D'],[211,'B'],[229,'C'],[231,'A'],[237,'A'],[248,'A'],[173,'A']
  ]);
  for(const {after} of revisions){
    const q=questions.find(q=>q.id===after.id);assert.deepEqual(q,after);
    assert.equal(q.correctText,q.options[q.answer]);
    for(const text of [q.question,...Object.values(q.options),q.correctText]){
      for(const match of text.matchAll(/\\\(([\s\S]*?)\\\)/g))assert.doesNotThrow(()=>katex.renderToString(match[1],{throwOnError:true,trust:false}));
      assert.doesNotMatch(formatContent(text),/katex-error/);
    }
  }
  const loss=formatContent(questions.find(q=>q.id===66).options.B);
  assert.match(loss,/<mover\b/);assert.match(loss,/<msub>/);assert.match(loss,/∑/);
  assert.match(questions.find(q=>q.id===128).options.D,/where "\?" means don't care/);
});

test('November 17 source corrections restore transpose, Hadamard product, layer indices and Greek symbols',()=>{
  const q=id=>questions.find(question=>question.id===id);
  assert.match(q(203).options.B,/\\mathsf\{T\}/);assert.match(q(203).options.B,/\\odot/);assert.match(q(203).options.B,/g\^\{\(1\)\\prime\}/);
  assert.match(q(210).options.B,/n\^\{\(l-1\)\}/);assert.notEqual(q(210).options.B,q(210).options.D);
  assert.match(q(229).options.C,/\\frac\{\\alpha\\lambda\}\{m\}/);
  assert.match(q(231).question,/\\lambda/);assert.match(q(248).question,/\\beta=0\.9/);
  for(const key of ['A','B','D']){assert.match(q(237).options[key],/\\mu/);assert.match(q(237).options[key],/\\sigma/);}
  assert.equal(revisions.length,14);
});

test('renderer escapes prose and refuses executable links/HTML while keeping MathML',()=>{
  const result=formatContent('<img src=x onerror=alert(1)> '+String.raw`\(\frac{1}{n_c^{(l)}}\)`);
  assert.match(result,/&lt;img/);assert.doesNotMatch(result,/<img/);assert.match(result,/<math/);assert.match(result,/<mfrac>/);
  const hostile=formatContent(String.raw`\(\href{javascript:alert(1)}{click}\)`);
  assert.doesNotMatch(hostile,/<a\s|href="javascript/);
  assert.doesNotThrow(()=>formatContent(String.raw`Broken \(\frac{\)`));
  assert.equal(formatContent('Price $5, accuracy 90%, <script>'),'Price $5, accuracy 90%, &lt;script&gt;');
});

test('legacy browser datasets receive corrections without overwriting personal edits or imported questions',()=>{
  assert.deepEqual(applyQuestionRevisions(revisions.map(r=>r.before)),revisions.map(r=>r.after));
  const personal=structuredClone(revisions[0].before);personal.options.B='My custom answer';personal.correctText='My custom answer';
  const result=applyQuestionRevisions([personal])[0];
  assert.equal(result.options.B,'My custom answer');assert.equal(result.correctText,'My custom answer');assert.equal(result.options.A,revisions[0].after.options.A);
  const imported={...personal,question:'My own question',sourceImage:'custom'};
  assert.deepEqual(applyQuestionRevisions([imported])[0],imported);
  assert.deepEqual(revisions[0].before.options.A,'(¥ - yf'); // Migration never mutates original snapshots.
});

test('vendored renderer and every locally referenced font are available without a CDN',()=>{
  assert.equal(fs.readFileSync('vendor/katex/katex.min.js','utf8'),fs.readFileSync('node_modules/katex/dist/katex.min.js','utf8'));
  const css=fs.readFileSync('vendor/katex/katex.min.css','utf8');
  assert.doesNotMatch(css,/https?:\/\//);assert.doesNotMatch(css,/\.woff\)/);
  for(const match of css.matchAll(/url\(([^)]+)\)/g))assert.ok(fs.existsSync(path.join('vendor/katex',match[1])),match[1]);
});

function app(){
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://study.test/'}),w=dom.window;
  w.katex=katex;const run=code=>vm.runInContext(code,dom.getInternalVMContext());
  for(const file of ['learning.js','math-format.js','question-revisions.js','practice-sync.js','account.js'])run(fs.readFileSync(file,'utf8'));
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('initializeAccount();',''));
  return {dom,w,run};
}
test('actual flashcards, practice, tests, results, library and editor handle the corrected notation',t=>{
  const {dom,w,run}=app();t.after(()=>dom.window.close());
  for(const id of [66,102,113,115,128,173,203,209,210,211,229,231,237,248]){
    run(`questions=[DEFAULT_QUESTIONS.find(q=>q.id===${id})];study.pool=[];practice.pool=[];`);
    for(const view of ['study','practice','test','library']){
      if(view==='test')run("test={active:true,pool:questions,index:0,answers:{},submitted:false};");
      run(`navTo('${view}')`);
      assert.ok(w.document.querySelector('#appContent .katex'),`${id} ${view}`);
      assert.doesNotMatch(w.document.querySelector('#appContent').textContent,/\\\(|\\\)/);
    }
    run("test.submitted=true;navTo('test')");assert.ok(w.document.querySelector('.result-list .katex'));
  }
  run('questions=DEFAULT_QUESTIONS;openEditor(113)');
  assert.match(w.document.querySelector('#editQuestion').value,/\\\(a\^/);
  assert.equal(w.document.querySelector('#modalRoot textarea .katex'),null);
});

test('saved answer history renders MathML using the same formatter without altering its snapshot',async t=>{
  const {dom,w,run}=app();t.after(()=>dom.window.close());
  const q=questions.find(q=>q.id===128);
  const saved={attempt:{id:99,mode:'practice',created_at:1,total:1,correct:1},answers:[{question_id:q.id,section:q.section,question:q.question,options:q.options,selected_answer:'D',correct_answer:'D',is_correct:1}]};
  const original=JSON.stringify(saved);
  w.fetch=async()=>({ok:true,headers:{get:()=> 'application/json'},json:async()=>saved});
  run("account={id:1,username:'test'};currentView='history';document.querySelector('#appContent').innerHTML=renderHistory();");
  await run('loadHistory(99)');
  assert.ok(w.document.querySelector('.result-list .katex-mathml'));
  assert.match(w.document.querySelector('.result-list').textContent,/"\?" means don't care/);
  assert.equal(JSON.stringify(saved),original);
});
