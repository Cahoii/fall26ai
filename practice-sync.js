/* Durable, per-account practice outbox. No credentials are stored in IndexedDB. */
(function(root){
  const learning=root.Learning||(typeof require==='function'?require('./learning.js'):null);
  const copy = value => JSON.parse(JSON.stringify(value));
  function trackMastery(view,payload){
    const item=learning.event(payload);if(!item)return;
    view.state.masteryBase=view.state.masteryBase||copy(view.state.base.mastery||{});
    view.state.masteryTimeline=view.state.masteryTimeline||[];
    if(!view.state.masteryTimeline.some(row=>row.eventId===item.eventId))view.state.masteryTimeline.push(item);
  }
  function settleMastery(view,snapshot){
    const projected=learning.replay(view.state.masteryBase||view.state.base.mastery||{},view.state.masteryTimeline||[]);
    const fresh=snapshot.mastery&&snapshot.attempts>=view.state.base.attempts;
    view.state.base.mastery=copy(fresh?snapshot.mastery:projected);
    view.state.masteryBase=copy(view.state.base.mastery);view.state.masteryTimeline=[];
  }
  function addAnswers(base, payload){
    const next=copy(base);
    next.questionAttempts={...(next.questionAttempts||{})};
    for(const {question:q,selected} of payload.answers){
      next.attempts++;
      if(selected!=null)next.questionAttempts[q.id]=(next.questionAttempts[q.id]||0)+1;
      if(selected===q.answer){next.correct++;next.wrong=next.wrong.filter(id=>id!==q.id);}
      else if(!next.wrong.includes(q.id))next.wrong.push(q.id);
    }
    return next;
  }
  function mergeSnapshot(base, snapshot, known=false){
    const result=snapshot.attempts>=base.attempts?copy(snapshot):copy(base);
    result.known=copy(known?snapshot.known:base.known);
    result.mastery=copy(snapshot.mastery&&snapshot.attempts>=base.attempts?snapshot.mastery:(base.mastery||{}));
    return result;
  }
  class IndexedQueue {
    constructor(indexedDB, name='dpl302-practice-sync-v1'){this.indexedDB=indexedDB;this.name=name;}
    open(){
      if(!this.opening)this.opening=new Promise((resolve,reject)=>{
        if(!this.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
        const request=this.indexedDB.open(this.name,1);
        const timer=setTimeout(()=>reject(new Error('IndexedDB timeout')),3000);
        request.onupgradeneeded=()=>{
          const db=request.result;
          const entries=db.createObjectStore('entries',{keyPath:'id',autoIncrement:true});
          entries.createIndex('userId','userId');
          entries.createIndex('eventId','eventId',{unique:true});
          db.createObjectStore('accounts',{keyPath:'userId'});
        };
        request.onsuccess=()=>{clearTimeout(timer);request.result.onversionchange=()=>request.result.close();resolve(request.result);};
        request.onerror=()=>{clearTimeout(timer);reject(request.error);};
        request.onblocked=()=>{clearTimeout(timer);reject(new Error('IndexedDB blocked'));};
      });
      return this.opening;
    }
    async update(userId, change){
      const db=await this.open();
      return new Promise((resolve,reject)=>{
        const tx=db.transaction(['entries','accounts'],'readwrite');
        const entries=tx.objectStore('entries'),accounts=tx.objectStore('accounts');
        const all=entries.index('userId').getAll(userId),state=accounts.get(userId);
        let result,ready=0;
        const loaded=()=>{
          if(++ready!==2)return;
          const view={entries:all.result.sort((a,b)=>a.id-b.id),state:state.result};
          try{
            change?.(view,entries);
            if(view.state){view.state.revision=(view.state.revision||0)+1;accounts.put(view.state);}
            result=view;
          }catch(error){tx.abort();reject(error);}
        };
        all.onsuccess=loaded;state.onsuccess=loaded;
        tx.oncomplete=()=>resolve(result);
        tx.onabort=tx.onerror=()=>reject(tx.error||new Error('IndexedDB write failed'));
      });
    }
    attach(userId, snapshot){
      return this.update(userId,view=>{
        if(!view.state)view.state={userId,base:copy(snapshot),directIds:[],questionCountsReady:!!snapshot.questionAttempts};
        else if(!view.entries.length)view.state.base=mergeSnapshot(view.state.base,snapshot,true);
        else view.state.base.known=copy(snapshot.known);
        if(!view.entries.length)view.state.questionCountsReady=!!view.state.base.questionAttempts;
        else if(view.state.questionCountsReady==null)view.state.questionCountsReady=!!view.state.base.questionAttempts;
        if(!view.entries.length){view.state.masteryBase=copy(view.state.base.mastery||{});view.state.masteryTimeline=[];}
        else if(!view.state.masteryBase){
          view.state.masteryBase=copy(snapshot.mastery||{});view.state.masteryTimeline=[];
          for(const row of view.entries)trackMastery(view,row.payload);
        }
      });
    }
    enqueue(userId,payload){
      return this.update(userId,(view,store)=>{
        const row={userId,eventId:payload.eventId,payload:copy(payload)};
        const request=store.add(row);
        request.onsuccess=()=>{row.id=request.result;};
        view.entries.push(row);
        trackMastery(view,payload);
      });
    }
    acknowledge(userId,eventId,snapshot){
      return this.update(userId,(view,store)=>{
        const row=view.entries.find(entry=>entry.eventId===eventId);
        if(row){
          store.delete(row.id);
          view.entries=view.entries.filter(entry=>entry.id!==row.id);
          view.state.base=addAnswers(view.state.base,row.payload);
        }
        // While a backlog exists, a server snapshot may already include an
        // unacknowledged retry. Reconcile counters only after the queue drains.
        if(!view.entries.length){settleMastery(view,snapshot);view.state.base=mergeSnapshot(view.state.base,snapshot);view.state.questionCountsReady=!!snapshot.questionAttempts;}
      });
    }
    confirm(userId,snapshot,payload,known=false){
      return this.update(userId,view=>{
        if(payload)trackMastery(view,payload);
        if(!view.entries.length){view.state.base=mergeSnapshot(view.state.base,snapshot,known);view.state.questionCountsReady=!!snapshot.questionAttempts;}
        else{
          if(known)view.state.base.known=copy(snapshot.known);
          if(payload&&!view.state.directIds.includes(payload.eventId))view.state.base=addAnswers(view.state.base,payload);
        }
        if(payload)view.state.directIds=[...new Set([...view.state.directIds,payload.eventId])].slice(-1000);
        if(!view.entries.length)settleMastery(view,snapshot);
      });
    }
    block(userId,eventId,message){
      return this.update(userId,(view,store)=>{
        const row=view.entries.find(entry=>entry.eventId===eventId);
        if(row){row.blocked=message;store.put(row);}
      });
    }
    unblock(userId){
      return this.update(userId,(view,store)=>{
        for(const row of view.entries){delete row.blocked;store.put(row);}
      });
    }
  }
  class PracticeSync {
    constructor({store,send,onChange=()=>{},locks,timers={set:setTimeout,clear:clearTimeout},notify=()=>{}}){
      Object.assign(this,{store,send,onChange,locks,timers,notify});
      this.session=null;
    }
    async start(userId,snapshot){
      this.stop();
      if(userId==null)return;
      const session={userId,controller:new AbortController(),view:null,retryCount:0,paused:false,error:''};
      this.session=session;
      try{this.publish(session,await this.store.attach(userId,snapshot));}
      catch(error){session.storageError=true;session.view={state:{base:copy(snapshot)},entries:[]};this.publish(session);}
      this.pump();
    }
    stop(){
      const s=this.session;
      if(s){s.controller.abort();this.timers.clear(s.timer);}
      this.session=null;
    }
    publish(s,view){
      if(this.session!==s)return;
      if(view&&(!s.view||view.state.revision>=s.view.state.revision))s.view=view;
      if(!s.view)return;
      let progress=copy(s.view.state.base);
      for(const row of s.view.entries)progress=addAnswers(progress,row.payload);
      progress.mastery=learning.replay(s.view.state.masteryBase||progress.mastery||{},s.view.state.masteryTimeline||[]);
      const blocked=s.view.entries.find(row=>row.blocked);
      this.onChange({userId:s.userId,progress,pending:s.view.entries.length,
        questionCountsReady:s.storageError?!!progress.questionAttempts:s.view.state.questionCountsReady,
        status:s.storageError?'unavailable':s.paused||s.error||blocked?'error':s.view.entries.length?'syncing':'saved',
        error:s.error||blocked?.blocked||'',authRequired:s.paused});
    }
    async enqueue(payload){
      const s=this.session;
      if(!s||s.storageError)throw new Error('Không thể lưu tạm trên thiết bị.');
      const view=await this.store.enqueue(s.userId,payload);
      this.publish(s,view);this.notify(s.userId);
      if(this.session===s)this.pump();
    }
    async confirm(snapshot,payload,known=false){
      const s=this.session;
      if(!s)return;
      if(s.storageError){
        s.view.state.base=mergeSnapshot(s.view.state.base,snapshot,known);this.publish(s);return;
      }
      try{this.publish(s,await this.store.confirm(s.userId,snapshot,payload,known));this.notify(s.userId);}
      catch(error){
        // A successful server write must not be reported as a failed submission
        // merely because local storage ran out of space afterwards.
        if(this.session!==s)return;
        if(!s.view.entries.length)s.view.state.base=mergeSnapshot(s.view.state.base,snapshot,known);
        else if(payload&&!s.view.state.directIds.includes(payload.eventId)){
          s.view.state.base=addAnswers(s.view.state.base,payload);s.view.state.directIds.push(payload.eventId);
          trackMastery(s.view,payload);
        }
        s.error='Đã lưu lượt này trên máy chủ; chưa cập nhật được dữ liệu tạm.';this.publish(s);
      }
    }
    async refresh(){
      const s=this.session;
      if(!s||s.storageError)return;
      try{this.publish(s,await this.store.update(s.userId));}
      catch(error){s.error='Chưa đọc được dữ liệu chờ đồng bộ.';this.publish(s);}
    }
    async retry(manual=false){
      const s=this.session;
      if(!s||s.paused||s.storageError)return;
      this.timers.clear(s.timer);s.timer=null;s.error='';s.retryCount=0;
      if(manual)this.publish(s,await this.store.unblock(s.userId));
      await this.refresh();this.pump();
    }
    pump(){
      const s=this.session;
      if(!s||s.running||s.paused||s.storageError||s.timer)return;
      s.running=true;
      const drain=async()=>{
        while(this.session===s&&!s.paused){
          const view=await this.store.update(s.userId);
          this.publish(s,view);
          const row=view.entries[0];
          if(!row||row.blocked)return;
          try{
            const result=await this.send(row.payload,s.userId,s.controller.signal);
            if(this.session!==s)return;
            this.publish(s,await this.store.acknowledge(s.userId,row.eventId,result.progress));
            s.error='';s.retryCount=0;this.publish(s);this.notify(s.userId);
          }catch(error){
            if(this.session!==s)return;
            s.error=error.message||'Mất kết nối. Sẽ tự đồng bộ lại.';
            if(error.status===401||error.status===409)s.paused=true;
            else if(error.status>=400&&error.status<500&&![408,429].includes(error.status)){
              this.publish(s,await this.store.block(s.userId,row.eventId,s.error));this.notify(s.userId);
            }else{
              const delay=Math.min(1000*2**s.retryCount++,30000);
              s.timer=this.timers.set(()=>{s.timer=null;s.error='';this.pump();},delay);
            }
            this.publish(s);return;
          }
        }
      };
      const work=this.locks?this.locks.request('dpl302-practice-sync:'+s.userId,{signal:s.controller.signal},drain):drain();
      Promise.resolve(work).catch(error=>{
        if(this.session===s){s.error='Chưa đồng bộ được lịch sử. Vui lòng thử lại.';this.publish(s);}
      }).finally(()=>{
        s.running=false;
        // An enqueue may have committed just as the worker observed an empty queue.
        if(this.session===s&&!s.error&&!s.timer&&!s.paused&&s.view?.entries.length&&!s.view.entries[0].blocked)this.pump();
      });
    }
  }
  root.PracticeSync={IndexedQueue,PracticeSync,addAnswers};
  if(typeof module!=='undefined')module.exports=root.PracticeSync;
})(globalThis);
