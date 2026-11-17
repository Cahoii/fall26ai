/* Shared learning rules and deterministic, testable exam construction. */
(function(root){
  const topics=['RNN, NLP & Attention','Convolutional Neural Networks','Sequence Models & Neural Network Fundamentals','Improving Deep Neural Networks & ML Strategy'];
  const labels=['Chưa thuộc','Thuộc','Nhớ','Nắm rõ'];
  const weights=[8,4,2,1];
  const level=value=>Math.max(0,Math.min(3,Number.isInteger(value)?value:0));
  function transition(current,correct,eligible=true){return correct?Math.min(3,level(current)+(eligible?1:0)):Math.max(0,level(current)-2);}
  function event(payload){
    if(!payload.learningSessionId)return null;
    return {eventId:payload.eventId,sessionId:payload.learningSessionId,time:payload.answeredAt,
      answers:payload.answers.map(({question,selected})=>({id:question.id,correct:selected===question.answer,eligible:payload.masteryEligible?.[question.id]!==false}))};
  }
  function replay(baseline,events){
    const result={...(baseline||{})},seen=new Set(),ids=new Set();
    for(const item of [...events].sort((a,b)=>a.time-b.time||(a.eventId<b.eventId?-1:a.eventId>b.eventId?1:0))){
      if(ids.has(item.eventId))continue;ids.add(item.eventId);
      for(const answer of item.answers){
        const key=item.sessionId+':'+answer.id;
        result[answer.id]=transition(result[answer.id],answer.correct,!seen.has(key)&&answer.eligible);
        seen.add(key);
      }
    }
    return result;
  }
  function allocate(total,percentages){
    const raw=percentages.map(p=>total*p/100),counts=raw.map(Math.floor);
    const order=raw.map((n,i)=>({i,fraction:n-counts[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
    const remainder=total-counts.reduce((a,b)=>a+b,0);
    for(let i=0;i<remainder;i++)counts[order[i].i]++;
    return counts;
  }
  function ratios(values){return Array.isArray(values)&&values.length===4&&values.every(n=>Number.isInteger(n)&&n>=20&&n<=40)&&values.reduce((a,b)=>a+b,0)===100?[...values]:[25,25,25,25];}
  function adjust(values,index,value){
    const previous=ratios(values),next=[...previous];
    next[index]=Math.max(20,Math.min(40,Math.round(Number(value)||20)));
    const others=[0,1,2,3].filter(i=>i!==index),extra=others.map(i=>previous[i]-20),sum=extra.reduce((a,b)=>a+b,0);
    const shares=extra.map(n=>sum?n/sum*100:100/3),distribution=allocate(40-next[index],shares);
    others.forEach((i,j)=>next[i]=20+distribution[j]);return next;
  }
  function sample(pool,count,mastery={},random=Math.random){
    return pool.map((q,i)=>({q,i,key:-Math.log(Math.max(Number.MIN_VALUE,Math.min(1-Number.EPSILON,random())))/weights[level(mastery[q.id])]}))
      .sort((a,b)=>a.key-b.key||a.i-b.i).slice(0,count).map(item=>item.q);
  }
  function blueprint(bank,settings){
    const unique=[...new Map(bank.map(q=>[q.id,q])).values()];
    const pool=settings.filter==='all'?unique:unique.filter(q=>q.section===settings.filter);
    const names=settings.filter==='all'?(settings.size==='all'?[...new Set(pool.map(q=>q.section))]:topics):[settings.filter];
    const percentages=settings.filter==='all'?ratios(settings.ratios):[100];
    const total=settings.size==='all'?pool.length:Number(settings.size);
    const counts=settings.size==='all'?names.map(name=>pool.filter(q=>q.section===name).length):allocate(total,percentages);
    const shortages=names.map((name,i)=>({name,need:counts[i],available:pool.filter(q=>q.section===name).length})).filter(row=>row.need>row.available);
    return {pool,names,percentages,counts,total,shortages,error:!pool.length?'Không có câu hỏi trong phạm vi này.':shortages.map(row=>`${row.name}: có ${row.available} câu, cần ${row.need}.`).join(' ')};
  }
  function createExam(bank,settings,mastery={},random=Math.random){
    const plan=blueprint(bank,settings);
    if(plan.error)throw new Error(plan.error+' Giảm số câu hoặc chỉnh tỷ lệ.');
    let selected=settings.size==='all'?[...plan.pool]:plan.names.flatMap((name,i)=>sample(plan.pool.filter(q=>q.section===name),plan.counts[i],mastery,random));
    if(settings.shuffle){for(let i=selected.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[selected[i],selected[j]]=[selected[j],selected[i]];}}
    else selected.sort((a,b)=>a.id-b.id);
    return selected;
  }
  root.Learning={topics,labels,weights,level,transition,event,replay,allocate,ratios,adjust,sample,blueprint,createExam};
  if(typeof module!=='undefined')module.exports=root.Learning;
})(globalThis);
