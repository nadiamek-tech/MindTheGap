/* Narrated lecture engine (shared by GED 102, MTH 105 …). Optional cfg.course, cfg.back, cfg.eyebrow; #sN links jump between scenes.
   A week page calls Lecture.mount({...}) with its scenes. Each scene:
   { title, kind:'lecture'|'activity'|'check', minutes, narration:[html...], think, notes:[...], src,
     fig:{label, html?, build?(el, W)}, wide:bool } */
(function(){
  const store = {
    get(k){ try{ return localStorage.getItem(k) }catch(e){ return null } },
    set(k,v){ try{ localStorage.setItem(k,v) }catch(e){} }
  };
  const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const h = (tag, attrs={}, html='') => { const e=document.createElement(tag); for(const k in attrs){ if(k==='class') e.className=attrs[k]; else if(k.startsWith('on')) e.addEventListener(k.slice(2),attrs[k]); else e.setAttribute(k,attrs[k]); } if(html) e.innerHTML=html; return e; };

  /* ---------- theme (shared with hub) ---------- */
  function applyTheme(t){ if(t==='light'||t==='dark') document.documentElement.setAttribute('data-theme',t); else document.documentElement.removeAttribute('data-theme'); }
  function currentDark(){ const t=document.documentElement.getAttribute('data-theme'); if(t) return t==='dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
  applyTheme(store.get('ged102-theme'));
  function toggleTheme(){ const t=currentDark()?'light':'dark'; applyTheme(t); store.set('ged102-theme',t); }

  /* ---------- widgets ---------- */
  const W = {
    esc, h,
    quiz(el, qs){
      const wrap=h('div',{class:'quiz'}); let answered=0, right=0;
      const score=h('p',{class:'score'},`Score: 0 / ${qs.length}`);
      qs.forEach((q,qi)=>{
        const box=h('div',{class:'q'}); box.appendChild(h('h4',{},`${qi+1}. ${q.q}`));
        const opts=h('div',{class:'opts'}); const why=h('div',{class:'why feedback',hidden:''});
        q.o.forEach((o,oi)=>{
          const b=h('button',{class:'opt',type:'button'},esc(o));
          b.addEventListener('click',()=>{
            opts.querySelectorAll('button').forEach((x,xi)=>{x.disabled=true; if(xi===q.a) x.classList.add('right');});
            if(oi!==q.a) b.classList.add('wrong'); else right++;
            answered++; why.hidden=false; why.innerHTML=(oi===q.a?'<b>Correct.</b> ':'<b>Not quite.</b> ')+q.why;
            score.textContent=`Score: ${right} / ${qs.length}`+(answered===qs.length?(right===qs.length?' · full marks':' · review the scenes you missed'):'');
          });
          opts.appendChild(b);
        });
        box.append(opts,why); wrap.appendChild(box);
      });
      wrap.appendChild(score); el.appendChild(wrap);
    },
    sort(el, {buckets, items, reveal='Show suggested answers'}){
      const wrap=h('div',{class:'sort'}); const picks=new Array(items.length).fill(null);
      items.forEach((it,i)=>{
        const row=h('div',{class:'item'}); row.appendChild(h('p',{},it.t));
        const ch=h('div',{class:'choices'});
        buckets.forEach((b,bi)=>{ const bt=h('button',{type:'button','aria-pressed':'false'},esc(b)); bt.addEventListener('click',()=>{picks[i]=bi; ch.querySelectorAll('button').forEach((x,xi)=>x.setAttribute('aria-pressed',xi===bi))}); ch.appendChild(bt); });
        const why=h('div',{class:'why',hidden:''});
        row.append(ch,why); wrap.appendChild(row); it._why=why;
      });
      const btn=h('button',{class:'btn ghost',type:'button'},reveal);
      btn.addEventListener('click',()=>{ items.forEach((it,i)=>{ const ok=picks[i]===it.a; it._why.hidden=false; it._why.innerHTML=`<span class="tag ${picks[i]==null?'':ok?'good':'warn'}">${picks[i]==null?'not sorted':ok?'matches':'different view'}</span> Suggested: <b>${esc(buckets[it.a])}</b>. ${it.why}`; }); });
      wrap.appendChild(h('div',{class:'row'})).appendChild(btn);
      el.appendChild(wrap);
    },
    worksheet(el, {id, fields, title='Worksheet'}){
      const wrap=h('div',{class:'ws'}); const key='ged102-ws-'+id;
      let saved={}; try{ saved=JSON.parse(store.get(key)||'{}') }catch(e){}
      fields.forEach((f,i)=>{ const d=h('div',{class:'f'}); const fid=`${id}-${i}`;
        d.appendChild(h('label',{for:fid},esc(f.l))); if(f.hint) d.appendChild(h('small',{},esc(f.hint)));
        const ta=h('textarea',{id:fid,rows:f.rows||2}); ta.value=saved[i]||''; ta.placeholder=f.ph||'';
        ta.addEventListener('input',()=>{saved[i]=ta.value; store.set(key,JSON.stringify(saved));});
        d.appendChild(ta); wrap.appendChild(d); });
      const out=h('div',{class:'feedback',hidden:''});
      const copy=h('button',{class:'btn',type:'button'},'Copy my answers');
      copy.addEventListener('click',()=>{
        const txt=title+'\n\n'+fields.map((f,i)=>`${f.l}\n${(wrap.querySelector('#'+id+'-'+i).value||'—')}`).join('\n\n');
        const done=()=>{out.hidden=false; out.textContent='Copied. Paste it into your Moodle submission or group document.';};
        const fallback=()=>{ out.hidden=false; out.innerHTML=''; const ta=h('textarea',{rows:6}); ta.value=txt; out.append('Copying is blocked here. Select the text below and copy it:',ta); ta.select(); };
        try{ navigator.clipboard.writeText(txt).then(done,fallback);}catch(e){fallback()}
      });
      wrap.append(h('div',{class:'row'}),out); wrap.children[wrap.children.length-2].appendChild(copy);
      el.appendChild(wrap);
    },
    poll(el, {q, opts, reveal}){
      const wrap=h('div',{class:'poll ui'}); wrap.appendChild(h('p',{style:'margin:0 0 4px;font-weight:600'},esc(q)));
      const msg=h('div',{class:'feedback',hidden:''});
      opts.forEach((o,i)=>{ const b=h('button',{class:'o',type:'button','aria-pressed':'false'},`<span>${esc(o)}</span><span class="tag">${String.fromCharCode(65+i)}</span>`);
        b.addEventListener('click',()=>{ wrap.querySelectorAll('button.o').forEach(x=>x.setAttribute('aria-pressed',x===b)); msg.hidden=false; msg.innerHTML=reveal(i); });
        wrap.appendChild(b); });
      wrap.appendChild(msg); el.appendChild(wrap);
    }
  };

  /* ---------- narration (Web Speech API) ---------- */
  const synth = window.speechSynthesis;
  let speaking=false, queue=[], qi=0, voice=null;
  function pickVoice(){ if(!synth) return; const vs=synth.getVoices(); voice=vs.find(v=>/en-GB/.test(v.lang)&&/female|Serena|Kate|Libby|Sonia|Google UK English Female/i.test(v.name))||vs.find(v=>/^en/.test(v.lang))||null; }
  if(synth){ pickVoice(); synth.onvoiceschanged=pickVoice; }

  /* ---------- mount ---------- */
  window.Lecture = { W, mount(cfg){
    document.title = cfg.pageTitle || document.title;
    const S = cfg.scenes; let cur = 0;
    const seen = new Set(JSON.parse(store.get('ged102-seen-'+cfg.id)||'[]'));
    document.body.dataset.layout = store.get('ged102-layout') || 'even';
    if(store.get('ged102-teacher')==='1') document.body.classList.add('teacher');

    const bar=h('header',{class:'bar'});
    bar.innerHTML=`<div class="bar-in">
      <a class="brand" href="index.html" title="Back to the course map"><b>${esc(cfg.course||'GED 102')}</b><span>← ${esc(cfg.back||'Course map')} · ${esc(cfg.short)}</span></a>
      <div class="controls">
        <span class="seg-label">Layout</span>
        <div class="seg" role="group" aria-label="Layout">
          <button type="button" data-l="text">Text</button><button type="button" data-l="even">Even</button><button type="button" data-l="diagram">Diagram</button>
        </div>
        <button type="button" class="pill listen" id="listen" aria-pressed="false">▶ Listen</button>
        <button type="button" class="pill" id="teach" aria-pressed="false" title="Show timings and facilitation notes">Teacher notes</button>
        <button type="button" class="pill" id="theme" title="Switch light or dark">◐ Theme</button>
      </div></div><div class="progress"><i></i></div>`;
    document.body.appendChild(bar);

    const shell=h('div',{class:'shell'});
    const toc=h('nav',{class:'toc','aria-label':'Scenes'});
    toc.innerHTML=`<div class="eyebrow">${cfg.eyebrow?esc(cfg.eyebrow):`Week ${cfg.week} · CLO ${cfg.clo}`}</div><h1>${esc(cfg.title)}</h1>
      <div class="meta">${esc(cfg.meta)}</div>`;
    const ol=h('ol'); toc.appendChild(ol);
    S.forEach((s,i)=>{ const li=h('li'); const b=h('button',{type:'button'},`<span class="n">${String(i).padStart(2,'0')}</span><span class="t">${esc(s.nav||s.title)}${s.kind&&s.kind!=='lecture'?`<span class="kind">${s.kind==='check'?'quiz':s.kind}</span>`:''}</span>`); b.addEventListener('click',()=>go(i)); li.appendChild(b); ol.appendChild(li); });
    const stage=h('main',{class:'stage',id:'stage'});
    shell.append(toc,stage); document.body.appendChild(shell);

    // controls
    const segBtns=bar.querySelectorAll('.seg button');
    const setLayout=l=>{ document.body.dataset.layout=l; store.set('ged102-layout',l); segBtns.forEach(b=>b.setAttribute('aria-pressed',b.dataset.l===l)); };
    segBtns.forEach(b=>b.addEventListener('click',()=>setLayout(b.dataset.l))); setLayout(document.body.dataset.layout);
    const teach=bar.querySelector('#teach');
    const syncTeach=()=>teach.setAttribute('aria-pressed',document.body.classList.contains('teacher'));
    teach.addEventListener('click',()=>{document.body.classList.toggle('teacher'); store.set('ged102-teacher',document.body.classList.contains('teacher')?'1':'0'); syncTeach();}); syncTeach();
    bar.querySelector('#theme').addEventListener('click',toggleTheme);
    const listen=bar.querySelector('#listen');
    listen.addEventListener('click',()=>{ speaking?stop():speak(); });

    function stop(){ speaking=false; if(synth) synth.cancel(); listen.setAttribute('aria-pressed','false'); listen.textContent='▶ Listen'; stage.querySelectorAll('.speaking').forEach(e=>e.classList.remove('speaking')); }
    function speak(){
      if(!synth){ listen.textContent='Narration not supported in this browser'; return; }
      synth.cancel(); speaking=true; listen.setAttribute('aria-pressed','true'); listen.textContent='❚❚ Pause';
      if(document.body.dataset.layout==='diagram') setLayout('even');
      queue=[...stage.querySelectorAll('.narr .para, .narr .think')]; qi=0; next();
    }
    function next(){
      stage.querySelectorAll('.speaking').forEach(e=>e.classList.remove('speaking'));
      if(!speaking) return;
      if(qi>=queue.length){ stop(); return; }
      const el=queue[qi++]; el.classList.add('speaking'); el.scrollIntoView({block:'nearest',behavior:'smooth'});
      const u=new SpeechSynthesisUtterance(el.innerText.replace(/^Pause and think\s*/i,'Pause and think. ')); if(voice) u.voice=voice; u.rate=0.98;
      u.onend=()=>{ if(speaking) next(); }; u.onerror=()=>{ if(speaking) next(); };
      synth.speak(u);
    }

    function render(){
      const s=S[cur]; stop(); stage.innerHTML='';
      const kindLabel={lecture:'Lecture',activity:'In-class activity',check:'Check your understanding'}[s.kind||'lecture'];
      const head=h('div',{class:'scene-head'});
      head.innerHTML=`<div><div class="eyebrow">Scene ${cur} of ${S.length-1}</div><h2>${s.title}</h2></div>
        <div class="chips"><span class="chip k-${s.kind||'lecture'}">${kindLabel}</span>${s.minutes?`<span class="chip">${s.minutes} min</span>`:''}</div>`;
      stage.appendChild(head);
      const split=h('div',{class:'split'+(s.fig?'':' nofig')+(s.wide?' wide':'')});
      const narr=h('div',{class:'narr'});
      (s.narration||[]).forEach((p,i)=>{ const isList=/^\s*<ul/.test(p); const d=h('div',{class:'para'+(i===0&&!isList?' lead':'')}); d.innerHTML=p; narr.appendChild(d); });
      if(s.think) narr.appendChild(h('div',{class:'think'},`<span class="eyebrow">Pause and think</span>${s.think}`));
      if(s.src) narr.appendChild(h('div',{class:'src'},s.src));
      if(s.notes) narr.appendChild(h('div',{class:'notes'},`<span class="eyebrow">Teacher notes${s.minutes?` · ${s.minutes} min`:''}</span><ul>${s.notes.map(n=>`<li>${n}</li>`).join('')}</ul>`));
      split.appendChild(narr);
      if(s.fig){ const f=h('figure',{class:'fig',style:'margin:0'}); if(s.fig.label) f.appendChild(h('span',{class:'eyebrow'},esc(s.fig.label))); const body=h('div'); if(s.fig.html) body.innerHTML=s.fig.html; f.appendChild(body); if(s.fig.caption) f.appendChild(h('figcaption',{class:'caption'},s.fig.caption)); split.appendChild(f); if(s.fig.build) s.fig.build(body,W); }
      stage.appendChild(split);
      const pager=h('div',{class:'pager'});
      const prev=h('button',{type:'button',class:'prev'},`<small>← Previous</small>${cur>0?esc(S[cur-1].nav||S[cur-1].title):'Start'}`); prev.disabled=cur===0; prev.addEventListener('click',()=>go(cur-1));
      const nxt=h('button',{type:'button',class:'next'},`<small>Next →</small>${cur<S.length-1?esc(S[cur+1].nav||S[cur+1].title):'End of lecture'}`); nxt.disabled=cur===S.length-1; nxt.addEventListener('click',()=>go(cur+1));
      pager.append(prev,h('span',{class:'kbd'},'← → keys'),nxt); stage.appendChild(pager);
      ol.querySelectorAll('li').forEach((li,i)=>{ li.querySelector('button').setAttribute('aria-current',i===cur); li.classList.toggle('seen',seen.has(i)); });
      const cb=ol.children[cur].querySelector('button'); if(cb.scrollIntoView && innerWidth<900) cb.scrollIntoView({block:'nearest',inline:'center'});
      bar.querySelector('.progress i').style.width=(cur/(S.length-1)*100)+'%';
      seen.add(cur); store.set('ged102-seen-'+cfg.id,JSON.stringify([...seen]));
    }
    function go(i,fromHash){ if(i<0||i>=S.length) return; cur=i; render(); if(!fromHash) try{ history.replaceState(null,'','#s'+i);}catch(e){} window.scrollTo({top:0}); }
    addEventListener('keydown',e=>{ if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return; if(e.key==='ArrowRight') go(cur+1); if(e.key==='ArrowLeft') go(cur-1); });
    addEventListener('hashchange',()=>{ const h=location.hash.match(/^#s(\d+)$/); if(h&&+h[1]!==cur) go(Math.min(+h[1],S.length-1),true); });
    const m=location.hash.match(/^#s(\d+)$/); go(m?Math.min(+m[1],S.length-1):0,true);
  }};
  window.GED102Theme = { toggle: toggleTheme };
})();
