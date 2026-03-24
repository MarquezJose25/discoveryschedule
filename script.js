// ══════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════
const S = {
  blocks:[],      // {id,start,end,type,label}
  grades:[],      // strings
  subjects:[],    // {id,name,abbr,ci}  ci=colorIdx
  gradeSubjs:{},  // gradeId -> [{sid,hpw}]
  teachers:[],    // {id,name,tutorGrade,assignments:[{sid,gids:[]}]}
  schedules:{},   // gradeId -> day -> blockId -> {sid,tid,tids?,locked?} | null
  tutoring:{sessionsPerWeek:1},
  turnos:{enabled:true,targetHours:28},
};
const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes'];
const TUTOR_SUBJECT_ID='__TUTORIA__';
const TURNO_SUBJECT_ID='__TURNO__';
let eTid=null, aRows=[], cCtx=null, sci=0;

// ══════════════════════════════════════════
//  NAV
// ══════════════════════════════════════════
function goTo(i){
  document.querySelectorAll('.section').forEach((s,j)=>s.classList.toggle('active',j===i));
  document.querySelectorAll('.wstep').forEach((w,j)=>{
    w.classList.remove('active','done');
    if(j===i)w.classList.add('active');
    else if(j<i)w.classList.add('done');
  });
  if(i===3)prepGen();
  if(i===4)renderView();
}

// ══════════════════════════════════════════
//  STEP 1 — BLOCKS
// ══════════════════════════════════════════
function addBlock(){
  const s=document.getElementById('tb-s').value;
  const e=document.getElementById('tb-e').value;
  const t=document.getElementById('tb-t').value;
  const lbl=document.getElementById('tb-lbl').value.trim();
  if(!s||!e)return alert('Ingresa inicio y fin');
  if(s>=e)return alert('El inicio debe ser antes del fin');
  S.blocks.push({id:uid(),start:s,end:e,type:t,label:lbl});
  S.blocks.sort((a,b)=>a.start.localeCompare(b.start));
  document.getElementById('tb-lbl').value='';
  rbBlocks();
}
function rbBlocks(){
  const body=document.getElementById('tb-body');
  const cl=S.blocks.filter(b=>b.type==='class');
  body.innerHTML=S.blocks.map((b,i)=>{
    const dur=mdf(b.start,b.end);
    const tl={class:'📖 Clase',break:'☕ Recreo',other:'📌 Otro'}[b.type];
    const rs=b.type==='break'?'style="background:rgba(245,166,35,.03)"':'';
    return `<tr ${rs}><td><span class="badge">${i+1}</span></td>
    <td><strong>${b.start}</strong></td><td><strong>${b.end}</strong></td>
    <td>${dur}min</td><td>${tl}</td>
    <td>${b.label||'<span style="color:var(--t3)">—</span>'}</td>
    <td><button class="btn btn-danger" onclick="delBlock(${b.id})">✕</button></td></tr>`;
  }).join('');
  const hd=cl.reduce((s,b)=>s+mdf(b.start,b.end),0)/60;
  set('st-total',S.blocks.length);
  set('st-class',cl.length);
  set('st-hday',hd.toFixed(1)+'h');
  set('st-hweek',(hd*5).toFixed(1)+'h');
}
function delBlock(id){S.blocks=S.blocks.filter(b=>b.id!==id);rbBlocks();}
function mdf(s,e){const[sh,sm]=s.split(':').map(Number),[eh,em]=e.split(':').map(Number);return(eh*60+em)-(sh*60+sm);}
function loadDefault(){
  S.blocks=[
    {id:1,start:'07:00',end:'08:00',type:'class',label:'1er bloque'},
    {id:2,start:'08:00',end:'09:00',type:'class',label:'2do bloque'},
    {id:3,start:'09:00',end:'10:00',type:'class',label:'3er bloque'},
    {id:4,start:'10:00',end:'10:30',type:'break',label:'Recreo'},
    {id:5,start:'10:30',end:'11:30',type:'class',label:'4to bloque'},
    {id:6,start:'11:30',end:'12:30',type:'class',label:'5to bloque'},
    {id:7,start:'12:30',end:'13:00',type:'break',label:'Almuerzo'},
    {id:8,start:'13:00',end:'14:00',type:'class',label:'6to bloque'},
    {id:9,start:'14:00',end:'15:00',type:'class',label:'7mo bloque'},
  ];
  rbBlocks();
}

// ══════════════════════════════════════════
//  STEP 2 — GRADES
// ══════════════════════════════════════════
function genGrades(){
  const from=+get('gf').value, to=+get('gt').value;
  const pfx=get('gpfx').value.trim()||'Grado';
  const secR=get('gsec').value.trim();
  const secs=secR?secR.split(',').map(s=>s.trim()).filter(Boolean):[];
  if(from>to)return alert('Desde debe ser ≤ Hasta');
  S.grades=[];
  for(let i=from;i<=to;i++){
    if(secs.length)secs.forEach(sc=>S.grades.push(`${pfx} ${i}${sc}`));
    else S.grades.push(`${pfx} ${i}`);
  }
  S.grades.forEach(g=>{if(!S.gradeSubjs[g])S.gradeSubjs[g]=[];});
  rbGradeChips();
  rbGSC();
}
function rbGradeChips(){
  get('grade-chips').innerHTML=S.grades.map(g=>`<span class="tag tag-blue">🏫 ${g}</span>`).join('');
}

// ══════════════════════════════════════════
//  STEP 2 — SUBJECTS
// ══════════════════════════════════════════
function addSubj(){
  const n=get('subj-n').value.trim();
  const a=get('subj-a').value.trim().toUpperCase();
  if(!n)return alert('Ingresa nombre');
  S.subjects.push({id:uid(),name:n,abbr:a||n.substring(0,3).toUpperCase(),ci:sci%10});
  sci++;
  get('subj-n').value='';get('subj-a').value='';
  rbSubjs();rbGSC();
}
function delSubj(id){
  S.subjects=S.subjects.filter(s=>s.id!==id);
  S.grades.forEach(g=>{if(S.gradeSubjs[g])S.gradeSubjs[g]=S.gradeSubjs[g].filter(x=>x.sid!==id);});
  rbSubjs();rbGSC();
}
function rbSubjs(){
  const empty=get('subj-empty'),tbl=get('subj-tbl'),body=get('subj-body');
  if(!S.subjects.length){empty.style.display='flex';tbl.style.display='none';return;}
  empty.style.display='none';tbl.style.display='block';
  body.innerHTML=S.subjects.map((s,i)=>`
    <tr><td><span class="badge">${i+1}</span></td>
    <td><strong>${s.name}</strong></td>
    <td><span class="tag tag-acc">${s.abbr}</span></td>
    <td><span class="sc${s.ci}" style="display:inline-block;width:28px;height:14px;border-radius:4px;border:1px solid rgba(255,255,255,.1)"></span></td>
    <td><button class="btn btn-danger" onclick="delSubj(${s.id})">✕</button></td></tr>`).join('');
}

// ══════════════════════════════════════════
//  STEP 2 — GRADE SUBJECT CONFIG
// ══════════════════════════════════════════
function rbGSC(){
  const cont=get('gsc-cont');
  if(!S.grades.length){cont.innerHTML='<div class="empty"><div class="eicon">🏫</div><p>Genera los grados primero</p></div>';return;}
  cont.innerHTML=S.grades.map(g=>{
    const ass=S.gradeSubjs[g]||[];
    const totalH=ass.reduce((s,x)=>s+x.hpw,0);
    return `<div class="gsc-row">
      <div class="gsc-head" onclick="toggleGSC('${esc(g)}')">
        <div class="flex fg-gap">
          <span style="font-weight:600">🏫 ${g}</span>
          <span class="tag tag-blue">${ass.length} materia${ass.length!==1?'s':''}</span>
          <span class="tag tag-acc">${totalH} h/sem</span>
        </div>
        <span style="color:var(--t2);font-size:18px" id="garr-${esc(g)}">›</span>
      </div>
      <div class="gsc-body" id="gbody-${esc(g)}">
        ${ass.map(x=>gsRow(g,x)).join('')}
        <div class="frow mt8">
          <div class="fg"><label>Agregar materia a ${g}</label>
            <select id="gsel-${esc(g)}" style="width:200px">
              <option value="">— Seleccionar —</option>
              ${S.subjects.filter(s=>!ass.find(a=>a.sid===s.id)).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="fg"><label>Horas/sem</label><input type="number" id="ghrs-${esc(g)}" value="3" min="1" max="30" style="width:80px"></div>
          <div class="fg" style="justify-content:flex-end"><button class="btn btn-acc btn-sm" onclick="addGS('${esc(g)}','${g.replace(/'/g,"\\'")}')">+ Agregar</button></div>
        </div>
      </div>
    </div>`;
  }).join('');
}
function gsRow(g,x){
  const s=S.subjects.find(s=>s.id===x.sid);
  if(!s)return '';
  const eg=esc(g);
  return `<div class="gsub-row">
    <div class="flex fg-gap" style="flex:1">
      <span class="sc${s.ci}" style="width:10px;height:10px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
      <span style="font-size:13px;font-weight:500">${s.name}</span>
    </div>
    <div class="flex fg-gap" style="font-size:12px;color:var(--t2)">
      <input type="number" value="${x.hpw}" min="1" max="30" style="width:65px"
        onchange="updGSH('${g.replace(/'/g,"\\'")}',${x.sid},this.value)"> h/sem
    </div>
    <button class="btn btn-danger btn-sm" onclick="delGS('${g.replace(/'/g,"\\'")}',${x.sid})">✕</button>
  </div>`;
}
function toggleGSC(eg){
  const b=document.getElementById(`gbody-${eg}`);
  const a=document.getElementById(`garr-${eg}`);
  b.classList.toggle('open');
  a.textContent=b.classList.contains('open')?'⌄':'›';
}
function addGS(eg,g){
  const sid=+document.getElementById(`gsel-${eg}`).value;
  const hpw=+document.getElementById(`ghrs-${eg}`).value;
  if(!sid)return alert('Selecciona materia');
  if(!S.gradeSubjs[g])S.gradeSubjs[g]=[];
  if(S.gradeSubjs[g].find(x=>x.sid===sid))return alert('Ya está agregada');
  S.gradeSubjs[g].push({sid,hpw});rbGSC();
}
function delGS(g,sid){S.gradeSubjs[g]=S.gradeSubjs[g].filter(x=>x.sid!==sid);rbGSC();}
function updGSH(g,sid,v){const x=S.gradeSubjs[g]?.find(x=>x.sid===sid);if(x)x.hpw=+v;}

// ══════════════════════════════════════════
//  STEP 3 — TEACHERS
// ══════════════════════════════════════════
function openTM(tid=null){
  eTid=tid;aRows=[];
  if(tid){
    const t=S.teachers.find(x=>x.id===tid);
    get('t-name').value=t.name;
    get('tmod-ttl').textContent='Editar Docente';
    aRows=JSON.parse(JSON.stringify(t.assignments));
    rbTutorSel(t.tutorGrade||'',tid);
  } else {
    get('t-name').value='';
    get('tmod-ttl').textContent='Agregar Docente';
    rbTutorSel('');
    addAR();
  }
  rbARows();
  get('tmodal').style.display='flex';
}
function closeTM(){get('tmodal').style.display='none';}
function addAR(){aRows.push({sid:'',gids:[]});rbARows();}
function delAR(i){aRows.splice(i,1);rbARows();}
function rbARows(){
  const cont=get('t-ass');
  if(!S.subjects.length){cont.innerHTML='<div class="alert al-warn">Sin materias. Ve al paso 2.</div>';return;}
  cont.innerHTML=aRows.map((row,i)=>`
    <div style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:10px">
      <div class="frow mb8">
        <div class="fg" style="flex:1"><label>Materia</label>
          <select onchange="aRows[${i}].sid=+this.value;rbARows()" style="width:100%">
            <option value="">— Seleccionar —</option>
            ${S.subjects.map(s=>`<option value="${s.id}" ${row.sid===s.id?'selected':''}>${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="fg" style="justify-content:flex-end;padding-top:18px">
          <button class="btn btn-danger btn-sm" onclick="delAR(${i})">✕ Quitar</button>
        </div>
      </div>
      <div class="fg"><label>Grados que atiende con esta materia</label>
        <div class="chip-list" style="margin-top:4px">
          ${S.grades.map(g=>{
            const sel=row.gids.includes(g);
            return `<span class="chip chip-btn ${sel?'sel':''}" onclick="togAG(${i},'${g.replace(/'/g,"\\'")}')">
              ${sel?'✓ ':''} ${g}</span>`;
          }).join('')}
        </div>
        ${!S.grades.length?'<span style="color:var(--t3);font-size:12px">Sin grados configurados</span>':''}
      </div>
    </div>`).join('');
  calcHWarn();
}
function rbTutorSel(sel='',tid=null){
  const el=get('t-tutor');
  if(!el)return;
  el.innerHTML='<option value="">— Sin tutoría asignada —</option>'+S.grades.map(g=>{
    const used=countGradeTutors(g,tid);
    return `<option value="${g}" ${sel===g?'selected':''} ${used>=2&&sel!==g?'disabled':''}>${g}${used>=2&&sel!==g?' · cupo completo':''}</option>`;
  }).join('');
}
function togAG(ri,g){const r=aRows[ri];const i=r.gids.indexOf(g);if(i===-1)r.gids.push(g);else r.gids.splice(i,1);rbARows();}
function calcHWarn(){
  let total=0;
  aRows.forEach(r=>{
    if(!r.sid||!r.gids.length)return;
    r.gids.forEach(g=>{
      const gs=S.gradeSubjs[g]?.find(x=>x.sid===r.sid);
      if(gs)total+=gs.hpw;
    });
  });
  if(get('t-tutor')?.value)total+=+S.tutoring.sessionsPerWeek||0;
  const w=get('t-hwarn');
  if(total>28){w.style.display='flex';w.textContent=`⚠️ Las asignaciones suman ${total} h/semana. Máximo: 28.`;}
  else w.style.display='none';
  return total;
}
function saveT(){
  const name=get('t-name').value.trim();
  const tutorGrade=get('t-tutor')?.value||'';
  if(!name)return alert('Ingresa nombre');
  if(calcHWarn()>28)return alert('Supera el máximo de 28 h/semana');
  if(tutorGrade&&countGradeTutors(tutorGrade,eTid)>=2)return alert('Ese grado ya tiene 2 tutores asignados');
  const valid=aRows.filter(r=>r.sid&&r.gids.length);
  if(eTid){
    const t=S.teachers.find(x=>x.id===eTid);
    t.name=name;t.assignments=valid;t.tutorGrade=tutorGrade;
  } else {
    S.teachers.push({id:uid(),name,tutorGrade,assignments:valid});
  }
  closeTM();rbTeachers();
}
function delT(id){
  if(!confirm('¿Eliminar docente?'))return;
  S.teachers=S.teachers.filter(t=>t.id!==id);
  Object.values(S.schedules).forEach(gs=>{
    DAYS.forEach(d=>Object.keys(gs[d]||{}).forEach(b=>{
      const cell=gs[d][b];
      if(!cellHasTeacher(cell,id))return;
      const next=removeTeacherFromCell(cell,id);
      gs[d][b]=next;
    }));
  });
  rbTeachers();
}
function rbTeachers(){
  const empty=get('t-empty'),grid=get('t-grid');
  get('tutor-hpw').value=S.tutoring.sessionsPerWeek||0;
  if(!S.teachers.length){empty.style.display='flex';grid.style.display='none';return;}
  empty.style.display='none';grid.style.display='grid';
  grid.innerHTML=S.teachers.map(t=>{
    const h=tWH(t.id);
    const pct=Math.round(h/28*100);
    const cls=pct>=100?'danger':pct>=80?'warn':'';
    const sts=t.assignments.map(a=>{
      const s=S.subjects.find(x=>x.id===a.sid);
      return s?`<span class="tag sc${s.ci}" style="font-size:10px;padding:1px 8px">${s.abbr}</span>`:'';
    }).join('');
    const gts=[...new Set(t.assignments.flatMap(a=>a.gids))].map(g=>`<span class="tag tag-blue" style="font-size:10px;padding:1px 8px">${g}</span>`).join('');
    const tutor=t.tutorGrade?`<div class="tsubjs"><span class="tag tag-green" style="font-size:10px;padding:1px 8px">👥 Tutor de ${t.tutorGrade}</span></div>`:'';
    return `<div class="tcard">
      <div class="tcard-top">
        <div class="tavatar">${t.name.charAt(0).toUpperCase()}</div>
        <div><div class="tname">${t.name}</div><div class="thours">${h} / 28 h/sem</div></div>
      </div>
      <div class="pbar"><div class="pfill ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
      <div class="tsubjs mt8">${sts}</div>
      <div class="tsubjs">${gts}</div>
      ${tutor}
      <div class="tactions no-print">
        <button class="btn btn-ghost btn-sm" onclick="openTM(${t.id})">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="delT(${t.id})">🗑</button>
      </div>
    </div>`;
  }).join('');
}
function tWH(tid){
  let c=0;
  Object.values(S.schedules).forEach(gs=>DAYS.forEach(d=>Object.values(gs[d]||{}).forEach(c2=>{if(cellHasTeacher(c2,tid))c++;})));
  return c;
}

// ══════════════════════════════════════════
//  STEP 4 — GENERATE
// ══════════════════════════════════════════
function prepGen(){
  const sel=get('gen-g');
  sel.innerHTML='<option value="all">✅ Todos los grados</option>'+
    S.grades.map(g=>`<option value="${g}">${g}</option>`).join('');
  get('turno-en').value=S.turnos.enabled?'1':'0';
  get('turno-target').value=S.turnos.targetHours;
  const cl=S.blocks.filter(b=>b.type==='class');
  const wb=cl.length*5;
  let html='';
  html+=al('ok','Regla activa: máximo 2 horas seguidas por docente en un mismo grado por día. Además, se prioriza repartir una misma materia en días distintos cuando sea posible.');
  html+=al('ok',`Tutorías simultáneas activas: ${S.tutoring.sessionsPerWeek||0} bloque${(S.tutoring.sessionsPerWeek||0)!==1?'s':''}/semana · máximo 2 tutores por grado.`);
  html+=al('ok',`Turnos: ${S.turnos.enabled?'activos':'desactivados'} · meta por docente ${S.turnos.targetHours} h/sem.`);
  if(!cl.length)html+=al('err','Sin bloques de clase');
  else html+=al('ok',`${cl.length} bloques de clase/día · ${wb} bloques/semana`);
  if(!S.grades.length)html+=al('err','Sin grados configurados');
  else html+=al('ok',`${S.grades.length} grados configurados`);
  if(!S.teachers.length)html+=al('err','Sin docentes registrados');
  else html+=al('ok',`${S.teachers.length} docentes registrados`);
  S.grades.forEach(g=>{
    const tc=getGradeTutorIds(g).length;
    if((S.tutoring.sessionsPerWeek||0)===0)return;
    if(tc===0)html+=al('warn',`${g}: sin tutor asignado`);
    else html+=al('ok',`${g}: ${tc} tutor${tc!==1?'es':''} asignado${tc!==1?'s':''}`);
  });
  S.grades.forEach(g=>{
    const gs=S.gradeSubjs[g]||[];
    if(!gs.length){html+=al('warn',`${g}: sin materias configuradas`);return;}
    const th=gs.reduce((s,x)=>s+x.hpw,0);
    const tc=th>wb?'err':th<wb?'warn':'ok';
    const em=th>wb?`⚠️ ${g}: requiere ${th}h, solo hay ${wb} bloques/semana. Revisar.`:
             th<wb?`ℹ️ ${g}: requiere ${th}h, hay ${wb} bloques (quedarán vacíos)`:
             `✅ ${g}: ${th}h requeridas = ${wb} bloques disponibles`;
    html+=al(tc,em);
  });
  get('pre-chk').innerHTML=html;
  get('btn-view').style.display='none';
}
function al(t,m){return `<div class="alert al-${t==='err'?'err':t==='warn'?'warn':'ok'}">${t==='ok'?'✅':t==='warn'?'⚠️':'❌'} ${m}</div>`;}

function runGen(){
  const logEl=get('gen-log');
  logEl.style.display='block';
  const logs=[];
  const gradeT=get('gen-g').value;
  const mode=get('gen-m').value;
  const toGen=gradeT==='all'?S.grades:[gradeT];
  const cl=S.blocks.filter(b=>b.type==='class');
  if(!cl.length){logEl.innerHTML='<div class="alert al-err">❌ Sin bloques de clase</div>';return;}

  // init schedules
  toGen.forEach(g=>{
    S.schedules[g]={};
    DAYS.forEach(d=>{S.schedules[g][d]={};cl.forEach(b=>{S.schedules[g][d][b.id]=null;});});
  });

  // teacher week hours counter
  const tH={};S.teachers.forEach(t=>{tH[t.id]=0;});
  // teacher slot tracker: tid -> day -> blockId -> gradeId
  const tS={};
  S.teachers.forEach(t=>{tS[t.id]={};DAYS.forEach(d=>{tS[t.id][d]={};});});
  seedTeacherUsage(tH,tS,toGen);
  const tutorSlots=getTutorSlotsForGeneration(cl,+S.tutoring.sessionsPerWeek||0,mode,toGen,logs);
  assignTutorSessions(toGen,tutorSlots,tH,tS,logs);

  toGen.forEach(g=>{
    const gs=S.gradeSubjs[g]||[];
    if(!gs.length){logs.push({t:'warn',m:`${g}: sin materias, omitido`});return;}

    // build slots list
    let slots=[];
    gs.forEach(x=>{for(let h=0;h<x.hpw;h++)slots.push({sid:x.sid});});

    // build positions
    let pos=[];
    DAYS.forEach(d=>cl.forEach(b=>pos.push({day:d,bid:b.id})));

    if(mode==='spread') pos=spreadPos(pos,slots.length);
    else if(mode==='random'){pos=shuf(pos);slots=shuf(slots);}
    else{pos.sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day));} // front

    if(mode!=='random')slots=shuf(slots);
    const posOrd={};
    pos.forEach((p,i)=>{posOrd[`${p.day}|${p.bid}`]=i;});

    let filled=0;
    for(const slot of slots){
      const subj=S.subjects.find(s=>s.id===slot.sid);
      const candidates=S.teachers.filter(t=>{
        return t.assignments.some(a=>a.sid===slot.sid&&a.gids.includes(g));
      });
      let best=null;
      const prefDaily=getSubjectDailyPref(g,slot.sid);
      for(const p of pos){
        if(S.schedules[g][p.day][p.bid]!==null)continue;
        const dayCount=countSubjectDay(g,p.day,slot.sid);
        if(dayCount>=2)continue;
        const adjCount=countAdjacentSubjectBlocks(g,p.day,p.bid,slot.sid);
        for(const t of candidates){
          if(tH[t.id]>=28)continue;
          if(tS[t.id][p.day][p.bid])continue; // conflict
          const streak=countTeacherGradeStreak(g,p.day,p.bid,t.id);
          if(streak>2)continue;
          const score=[
            dayCount===0?0:dayCount<prefDaily?1:3,
            adjCount===0?0:2,
            streak===1?0:1,
            tH[t.id],
            posOrd[`${p.day}|${p.bid}`]??999,
          ];
          if(!best||cmpScore(score,best.score)<0)best={p,t,score};
        }
      }
      if(best){
        S.schedules[g][best.p.day][best.p.bid]={sid:slot.sid,tid:best.t.id};
        tH[best.t.id]++;
        tS[best.t.id][best.p.day][best.p.bid]=g;
        filled++;
      }else{
        logs.push({t:'warn',m:`${g} · ${subj?.name||'?'}: no se pudo ubicar 1 hora (sin docente disponible o sin espacio)`});
      }
    }
    logs.push({t:filled===slots.length?'ok':'warn',m:`${g}: ${filled}/${slots.length} horas asignadas`});
  });

  if(S.turnos.enabled){
    assignTurnoSessions(toGen,tH,tS,logs);
  }

  S.teachers.forEach(t=>{
    const h=tH[t.id]||0;
    const target=S.turnos.targetHours||28;
    if(h>0)logs.push({t:h>target?'err':'ok',m:`${t.name}: ${h} h/semana asignadas (meta ${target})`});
  });

  const icons={ok:'✅',warn:'⚠️',err:'❌'};
  logEl.innerHTML='<h4 style="font-size:13px;color:var(--t2);margin-bottom:10px">📋 Registro de generación</h4>'+
    logs.map(l=>`<div class="log-item"><span style="color:${l.t==='ok'?'var(--green)':l.t==='warn'?'var(--acc)':'var(--red)'}">${icons[l.t]}</span><span>${l.m}</span></div>`).join('');
  get('btn-view').style.display='inline-flex';
}
function assignTurnoSessions(grades,tH,tS,logs){
  const target=S.turnos.targetHours||28;
  if(!grades.length||!S.teachers.length||target<=0)return;
  const empties=[];
  grades.forEach(g=>{
    DAYS.forEach(day=>{
      S.blocks.forEach(b=>{
        if(b.type!=='class')return;
        if(S.schedules[g]?.[day]?.[b.id]===null)empties.push({g,day,bid:b.id});
      });
    });
  });
  if(!empties.length)return;
  const teachers=[...S.teachers];
  let assigned=0;
  while(empties.length){
    teachers.sort((a,b)=>(target-(tH[b.id]||0))-(target-(tH[a.id]||0))||((tH[a.id]||0)-(tH[b.id]||0)));
    const actives=teachers.filter(t=>(target-(tH[t.id]||0))>0);
    if(!actives.length)break;
    let placedAny=false;
    for(const teacher of actives){
      let placed=false;
      for(let i=0;i<empties.length;i++){
        const s=empties[i];
        if(tS[teacher.id][s.day][s.bid])continue;
        if(countTeacherGradeStreak(s.g,s.day,s.bid,teacher.id)>2)continue;
        S.schedules[s.g][s.day][s.bid]={sid:TURNO_SUBJECT_ID,tid:teacher.id,tids:[teacher.id],locked:true};
        tH[teacher.id]=(tH[teacher.id]||0)+1;
        tS[teacher.id][s.day][s.bid]=s.g;
        empties.splice(i,1);
        assigned++;placed=true;placedAny=true;
        break;
      }
      if(placed)break;
    }
    if(!placedAny)break;
  }
  logs.push({t:'ok',m:`Turnos asignados: ${assigned}`});
  S.teachers.forEach(t=>{
    const miss=target-(tH[t.id]||0);
    if(miss>0)logs.push({t:'warn',m:`${t.name}: faltan ${miss} h para meta; no hubo más espacios sin conflicto.`});
  });
}

function spreadPos(pos,need){
  const byDay={};DAYS.forEach(d=>{byDay[d]=[];});
  pos.forEach(p=>byDay[p.day].push(p));
  const result=[];let di=0;
  while(result.length<pos.length){
    const d=DAYS[di%5];
    if(byDay[d].length)result.push(byDay[d].shift());
    di++;
  }
  return result;
}
function shuf(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function pickTutorSlots(cl,sessions,mode){
  if(!sessions||!cl.length)return [];
  let pos=[];
  DAYS.forEach(d=>cl.forEach(b=>pos.push({day:d,bid:b.id})));
  if(mode==='random')pos=shuf(pos);
  else if(mode==='spread')pos=spreadPos(pos,sessions);
  else pos.sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||a.bid-b.bid);
  const result=[], usedDays=new Set();
  for(const p of pos){
    if(result.length>=sessions)break;
    if(usedDays.size<Math.min(sessions,DAYS.length)&&usedDays.has(p.day))continue;
    result.push(p);usedDays.add(p.day);
  }
  for(const p of pos){
    if(result.length>=sessions)break;
    if(!result.find(x=>x.day===p.day&&x.bid===p.bid))result.push(p);
  }
  return result;
}
function getTutorSlotsForGeneration(cl,sessions,mode,skipGrades,logs){
  if(!sessions)return [];
  const existing=getExistingTutorSlots(skipGrades);
  if(existing.length){
    if(existing.length!==sessions)logs.push({t:'warn',m:`Tutorías simultáneas reutilizadas desde horarios existentes (${existing.length} bloque${existing.length!==1?'s':''}).`});
    return existing.slice(0,sessions);
  }
  return pickTutorSlots(cl,sessions,mode);
}
function getExistingTutorSlots(skipGrades=[]){
  const out=[];
  Object.entries(S.schedules).forEach(([g,gs])=>{
    if(skipGrades.includes(g))return;
    DAYS.forEach(d=>{
      Object.entries(gs[d]||{}).forEach(([bid,c])=>{
        if(!isTutorCell(c))return;
        if(!out.find(x=>x.day===d&&String(x.bid)===String(bid)))out.push({day:d,bid:+bid});
      });
    });
  });
  return out.sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||a.bid-b.bid);
}
function assignTutorSessions(grades,slots,tH,tS,logs){
  if(!slots.length)return;
  grades.forEach(g=>{
    const tutorIds=getGradeTutorIds(g);
    slots.forEach(slot=>{
      const validTutorIds=tutorIds.filter(tid=>{
        if((tH[tid]||0)>=28){
          logs.push({t:'warn',m:`${g}: ${getTeacherName(tid)} no pudo quedar en tutoría por límite semanal.`});
          return false;
        }
        if(tS[tid]?.[slot.day]?.[slot.bid]){
          logs.push({t:'warn',m:`${g}: ${getTeacherName(tid)} ya estaba ocupado durante la tutoría simultánea.`});
          return false;
        }
        return true;
      });
      S.schedules[g][slot.day][slot.bid]={sid:TUTOR_SUBJECT_ID,tid:validTutorIds[0]??null,tids:validTutorIds,locked:true};
      validTutorIds.forEach(tid=>{
        tH[tid]=(tH[tid]||0)+1;
        tS[tid][slot.day][slot.bid]=g;
      });
      if(!tutorIds.length)logs.push({t:'warn',m:`${g}: tutoría programada sin tutor asignado.`});
      else if(validTutorIds.length<tutorIds.length)logs.push({t:'warn',m:`${g}: no todos los tutores pudieron quedar disponibles en la tutoría simultánea.`});
    });
  });
}
function countTeacherGradeStreak(g,day,bid,tid){
  const i=S.blocks.findIndex(b=>b.id===bid);
  if(i===-1)return 1;
  let total=1;
  for(let x=i-1;x>=0;x--){
    const b=S.blocks[x];
    if(b.type!=='class')break;
    if(cellHasTeacher(S.schedules[g]?.[day]?.[b.id],tid))total++;
    else break;
  }
  for(let x=i+1;x<S.blocks.length;x++){
    const b=S.blocks[x];
    if(b.type!=='class')break;
    if(cellHasTeacher(S.schedules[g]?.[day]?.[b.id],tid))total++;
    else break;
  }
  return total;
}
function countSubjectDay(g,day,sid){
  let total=0;
  Object.values(S.schedules[g]?.[day]||{}).forEach(c=>{if(c?.sid===sid)total++;});
  return total;
}
function countAdjacentSubjectBlocks(g,day,bid,sid){
  const i=S.blocks.findIndex(b=>b.id===bid);
  if(i===-1)return 0;
  let total=0;
  if(i>0){
    const prev=S.blocks[i-1];
    if(prev.type==='class'&&S.schedules[g]?.[day]?.[prev.id]?.sid===sid)total++;
  }
  if(i<S.blocks.length-1){
    const next=S.blocks[i+1];
    if(next.type==='class'&&S.schedules[g]?.[day]?.[next.id]?.sid===sid)total++;
  }
  return total;
}
function getSubjectDailyPref(g,sid){
  const hpw=S.gradeSubjs[g]?.find(x=>x.sid===sid)?.hpw||0;
  return hpw>5?2:1;
}
function cmpScore(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const av=a[i]??0, bv=b[i]??0;
    if(av!==bv)return av-bv;
  }
  return 0;
}
function seedTeacherUsage(tH,tS,skipGrades=[]){
  Object.entries(S.schedules).forEach(([g,gs])=>{
    if(skipGrades.includes(g))return;
    DAYS.forEach(d=>{
      Object.entries(gs[d]||{}).forEach(([bid,c])=>{
        getCellTeacherIds(c).forEach(tid=>{
          if(!tS[tid])return;
          tH[tid]=(tH[tid]||0)+1;
          tS[tid][d][bid]=g;
        });
      });
    });
  });
}

// ══════════════════════════════════════════
//  STEP 5 — VIEW
// ══════════════════════════════════════════
function renderView(){
  const mode=get('vmode').value;
  const cont=get('vcont');
  if(!Object.keys(S.schedules).length){
    cont.innerHTML='<div class="empty"><div class="eicon">📋</div><p>Genera los horarios primero</p></div>';
    return;
  }
  if(mode==='grade')renderGradeV(cont);
  else if(mode==='teacher')renderTeachV(cont);
  else renderOverV(cont);
  rbLegend();
}

// --- BY GRADE ---
function renderGradeV(cont){
  const gs=Object.keys(S.schedules);
  if(!gs.length){cont.innerHTML='<div class="empty"><div class="eicon">📋</div><p>Sin horarios</p></div>';return;}
  const tabs=`<div class="tabs no-print" id="gtabs">${gs.map((g,i)=>`<div class="tab ${i===0?'active':''}" onclick="swGT('${esc(g)}',this)">${g}</div>`).join('')}</div>`;
  const panels=gs.map((g,i)=>`<div id="gpan-${esc(g)}" style="display:${i===0?'block':'none'}">${buildGrid(g)}</div>`).join('');
  cont.innerHTML=tabs+panels;
}
function swGT(eg,el){
  document.querySelectorAll('#gtabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  Object.keys(S.schedules).forEach(g=>{const d=document.getElementById(`gpan-${esc(g)}`);if(d)d.style.display='none';});
  const p=document.getElementById(`gpan-${eg}`);if(p)p.style.display='block';
}
function buildGrid(g){
  const sch=S.schedules[g]||{};
  let html=`<div class="phdr" style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:12px;color:var(--acc)">📋 ${g}</div>`;
  html+=`<div class="sch-wrap"><table class="sch-table"><thead><tr>
    <th class="th-time">Horario</th>
    ${DAYS.map(d=>`<th>${d}</th>`).join('')}
  </tr></thead><tbody>`;
  S.blocks.forEach(b=>{
    const tl=b.label||`${b.start}–${b.end}`;
    if(b.type!=='class'){
      html+=`<tr><td style="background:rgba(245,166,35,.05);color:var(--acc);font-size:11px;font-weight:600;padding:8px 10px;border-radius:6px">${b.start}–${b.end}</td>
      ${DAYS.map(()=>`<td class="sch-cell brk"><div class="brk-lbl">${b.type==='break'?'☕ Descanso':'—'}</div></td>`).join('')}</tr>`;
      return;
    }
    html+=`<tr><td style="background:rgba(245,166,35,.05);color:var(--acc);font-size:11px;font-weight:600;padding:8px 10px;border-radius:6px;min-width:110px">
      <strong>${b.start}–${b.end}</strong><br><span style="font-size:9px;color:var(--t2);font-weight:400">${tl}</span>
    </td>`;
    DAYS.forEach(d=>{
      const cell=sch[d]?.[b.id];
      if(cell){
        const s=getSubjectMeta(cell.sid);
        const cls=s?.ci==='tutor'?'sc-tutor':s?.ci==='turno'?'sc-turno':`sc${s?.ci??0}`;
        const teachers=getCellTeacherNames(cell);
        const canEdit=!isTutorCell(cell)&&!isTurnoCell(cell);
        html+=`<td class="sch-cell filled ${cls}" ${canEdit?`onclick="openCM('${g.replace(/'/g,"\\'")}','${d}',${b.id})"`:''}>
          ${canEdit?`<button class="cdel" onclick="event.stopPropagation();delCellA('${g.replace(/'/g,"\\'")}','${d}',${b.id})">✕</button>`:''}
          <div class="ccont"><div class="csubj">${s?.name||'?'}</div>
          <div class="cteach">👤 ${teachers||'Sin tutor asignado'}</div></div></td>`;
      } else {
        html+=`<td class="sch-cell" onclick="openCM('${g.replace(/'/g,"\\'")}','${d}',${b.id})">
          <div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:10px">+ asignar</div></td>`;
      }
    });
    html+=`</tr>`;
  });
  html+=`</tbody></table></div>`;
  // coverage stats
  const gss=S.gradeSubjs[g]||[];
  const cov=[
    ...gss.map(x=>({sid:x.sid,hpw:x.hpw})),
    ...((S.tutoring.sessionsPerWeek||0)>0?[{sid:TUTOR_SUBJECT_ID,hpw:+S.tutoring.sessionsPerWeek||0}]:[]),
    ...(S.turnos.enabled?[{sid:TURNO_SUBJECT_ID,hpw:0}]:[]),
  ];
  if(cov.length){
    const rows=cov.map(x=>{
      const s=getSubjectMeta(x.sid);
      let asgn=0;
      DAYS.forEach(d=>Object.values(sch[d]||{}).forEach(c=>{if(c?.sid===x.sid)asgn++;}));
      const ok=asgn>=x.hpw;
      const reqLbl=x.sid===TURNO_SUBJECT_ID?'—':x.hpw;
      return `<tr><td><div class="flex fg-gap"><span style="width:8px;height:8px;border-radius:50%;display:inline-block;${s?.ci==='tutor'?'background:#fff1a8':s?.ci==='turno'?'background:#93c5fd':`background:var(--acc)`}"></span>${s?.name||'?'}</div></td>
        <td>${reqLbl}</td><td>${asgn}</td>
        <td><span class="tag ${x.sid===TURNO_SUBJECT_ID?(asgn>0?'tag-blue':'tag-red'):(ok?'tag-green':asgn>0?'tag-acc':'tag-red')}">${x.sid===TURNO_SUBJECT_ID?(asgn>0?'ℹ️ Complemento':'❌ Sin turnos'):(ok?'✅ Completo':asgn>0?'⚠️ Parcial':'❌ Sin asignar')}</span></td></tr>`;
    }).join('');
    html+=`<div class="card mt16" style="background:var(--s3)"><h4 style="font-size:13px;color:var(--t2);margin-bottom:12px">📊 Cobertura de materias — ${g}</h4>
      <div class="tbl-wrap"><table><thead><tr><th>Materia</th><th>Req.</th><th>Asignado</th><th>Estado</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`;
  }
  return html;
}

// --- BY TEACHER ---
function renderTeachV(cont){
  if(!S.teachers.length){cont.innerHTML='<div class="empty"><div class="eicon">👨‍🏫</div><p>Sin docentes</p></div>';return;}
  const tabs=`<div class="tabs no-print" id="ttabs">${S.teachers.map((t,i)=>`<div class="tab ${i===0?'active':''}" onclick="swTT(${t.id},this)">${t.name}</div>`).join('')}</div>`;
  const panels=S.teachers.map((t,i)=>`<div id="tpan-${t.id}" style="display:${i===0?'block':'none'}">${buildTGrid(t)}</div>`).join('');
  cont.innerHTML=tabs+panels;
}
function swTT(id,el){
  document.querySelectorAll('#ttabs .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  S.teachers.forEach(t=>{const d=document.getElementById(`tpan-${t.id}`);if(d)d.style.display='none';});
  const d=document.getElementById(`tpan-${id}`);if(d)d.style.display='block';
}
function buildTGrid(teacher){
  let html=`<div class="phdr" style="font-family:'Syne',sans-serif;font-size:16px;font-weight:700;margin-bottom:12px;color:var(--blue)">📋 ${teacher.name}</div>`;
  html+=`<div class="sch-wrap"><table class="sch-table"><thead><tr>
    <th class="th-time">Horario</th>${DAYS.map(d=>`<th>${d}</th>`).join('')}
  </tr></thead><tbody>`;
  S.blocks.forEach(b=>{
    if(b.type!=='class'){
      html+=`<tr><td style="background:rgba(245,166,35,.05);color:var(--acc);font-size:11px;padding:8px 10px">${b.start}–${b.end}</td>
      ${DAYS.map(()=>`<td class="sch-cell brk"><div class="brk-lbl">☕</div></td>`).join('')}</tr>`;
      return;
    }
    html+=`<tr><td style="background:rgba(245,166,35,.05);color:var(--acc);font-size:11px;font-weight:600;padding:8px 10px">${b.start}–${b.end}</td>`;
    DAYS.forEach(d=>{
      let found=null;
      Object.entries(S.schedules).forEach(([g,gs])=>{
        const c=gs[d]?.[b.id];
        if(cellHasTeacher(c,teacher.id))found={...c,grade:g};
      });
      if(found){
        const s=getSubjectMeta(found.sid);
        const cls=s?.ci==='tutor'?'sc-tutor':s?.ci==='turno'?'sc-turno':`sc${s?.ci??0}`;
        html+=`<td class="sch-cell filled ${cls}">
          <div class="ccont"><div class="csubj">${s?.name||'?'}</div>
          <div class="cteach">🏫 ${found.grade}</div></div></td>`;
      } else {
        html+=`<td class="sch-cell brk"><div class="brk-lbl" style="color:var(--t3)">—</div></td>`;
      }
    });
    html+=`</tr>`;
  });
  html+=`</tbody></table></div>`;
  const h=tWH(teacher.id);
  html+=`<div class="flex fg-gap mt16">
    <span class="tag tag-blue">📊 ${h} h/semana asignadas</span>
    <span class="tag ${h>28?'tag-red':h>=24?'tag-acc':'tag-green'}">${h>28?'⚠️ Excede límite (28h)':h>=24?'⚡ Carga alta':'✅ Dentro del límite'}</span>
  </div>`;
  return html;
}

// --- OVERVIEW ---
function renderOverV(cont){
  const cl=S.blocks.filter(b=>b.type==='class');
  const overviewSubjects=[
    ...S.subjects,
    ...((S.tutoring.sessionsPerWeek||0)>0?[getSubjectMeta(TUTOR_SUBJECT_ID)]:[]),
    ...(S.turnos.enabled?[getSubjectMeta(TURNO_SUBJECT_ID)]:[]),
  ];
  let html=`<div class="card" style="background:var(--s3)">
    <h3 style="font-size:15px;margin-bottom:14px">📊 Resumen General</h3>
    <div class="stats">
      <div class="stat"><div class="stat-val">${S.grades.length}</div><div class="stat-lbl">Grados</div></div>
      <div class="stat"><div class="stat-val">${S.teachers.length}</div><div class="stat-lbl">Docentes</div></div>
      <div class="stat"><div class="stat-val">${S.subjects.length}</div><div class="stat-lbl">Materias</div></div>
      <div class="stat"><div class="stat-val">${cl.length*5}</div><div class="stat-lbl">Bloques/sem</div></div>
    </div>
    <div class="tbl-wrap"><table><thead>
      <tr><th>Grado</th>${overviewSubjects.map(s=>`<th>${s.abbr}</th>`).join('')}<th>Total</th><th>Estado</th></tr>
    </thead><tbody>`;
  Object.entries(S.schedules).forEach(([g,gs])=>{
    let total=0;
    const cells=overviewSubjects.map(s=>{
      let c=0;DAYS.forEach(d=>Object.values(gs[d]||{}).forEach(x=>{if(x?.sid===s.id)c++;}));
      total+=c;
      const req=s.id===TUTOR_SUBJECT_ID?(+S.tutoring.sessionsPerWeek||0):s.id===TURNO_SUBJECT_ID?0:(S.gradeSubjs[g]?.find(x=>x.sid===s.id)?.hpw||0);
      return `<td style="text-align:center">${c>0?`<span class="tag ${c>=req?'tag-green':'tag-acc'}" style="font-size:10px">${c}h</span>`:'<span style="color:var(--t3)">—</span>'}</td>`;
    }).join('');
    const mx=cl.length*5;
    html+=`<tr><td><strong>${g}</strong></td>${cells}<td><strong>${total}</strong></td>
      <td><span class="tag ${total>=mx?'tag-green':total>0?'tag-acc':'tag-red'}">${total}/${mx}</span></td></tr>`;
  });
  html+=`</tbody></table></div></div>`;
  html+=`<div class="card mt16" style="background:var(--s3)"><h3 style="font-size:15px;margin-bottom:14px">👨‍🏫 Carga por Docente</h3>
    <div class="tbl-wrap"><table><thead><tr><th>Docente</th><th>Materias</th><th>Horas/sem</th><th>Uso</th><th>Estado</th></tr></thead><tbody>`;
  S.teachers.forEach(t=>{
    const h=tWH(t.id);
    const pct=Math.round(h/28*100);
    const hasTurno=tWH(t.id)>0&&Object.values(S.schedules).some(gs=>DAYS.some(d=>Object.values(gs[d]||{}).some(c=>c?.sid===TURNO_SUBJECT_ID&&cellHasTeacher(c,t.id))));
    const subjs=[...new Set(t.assignments.map(a=>getSubjectMeta(a.sid)?.name||'?').concat(t.tutorGrade?['Tutoría']:[]).concat(hasTurno?['Turno']:[]))].join(', ');
    html+=`<tr><td><strong>${t.name}</strong></td><td style="font-size:12px;color:var(--t2)">${subjs}</td>
      <td>${h}h</td>
      <td><div class="pbar" style="width:100px"><div class="pfill ${pct>=100?'danger':pct>=80?'warn':''}" style="width:${Math.min(pct,100)}%"></div></div></td>
      <td><span class="tag ${h>28?'tag-red':h>=24?'tag-acc':'tag-green'}">${h>28?'⚠️ Excede':'✅'}</span></td></tr>`;
  });
  html+=`</tbody></table></div></div>`;
  html+=`<div class="card mt16" style="background:var(--s3)"><h3 style="font-size:15px;margin-bottom:14px">👥 Tutorías por grado</h3>
    <div class="tbl-wrap"><table><thead><tr><th>Grado</th><th>Tutores</th><th>Sesiones/sem</th><th>Estado</th></tr></thead><tbody>
      ${S.grades.map(g=>{
        const tids=getGradeTutorIds(g);
        return `<tr><td><strong>${g}</strong></td><td>${getTeacherNamesByIds(tids)||'<span style="color:var(--t3)">Sin tutor</span>'}</td><td>${+S.tutoring.sessionsPerWeek||0}</td><td><span class="tag ${tids.length?'tag-green':'tag-red'}">${tids.length?`${tids.length} tutor${tids.length!==1?'es':''}`:'Pendiente'}</span></td></tr>`;
      }).join('')}
    </tbody></table></div></div>`;
  cont.innerHTML=html;
}
function rbLegend(){
  const subjects=[...S.subjects,...((S.tutoring.sessionsPerWeek||0)>0?[getSubjectMeta(TUTOR_SUBJECT_ID)]:[]),...(S.turnos.enabled?[getSubjectMeta(TURNO_SUBJECT_ID)]:[])];
  get('vlegend').innerHTML=subjects.map(s=>`<span class="tag ${s.ci==='tutor'?'sc-tutor':s.ci==='turno'?'sc-turno':`sc${s.ci}`}" style="font-size:11px">■ ${s.name}</span>`).join('');
}

// ══════════════════════════════════════════
//  CELL MODAL
// ══════════════════════════════════════════
function openCM(g,day,bid){
  cCtx={g,day,bid};
  const block=S.blocks.find(b=>b.id===bid);
  const cur=S.schedules[g]?.[day]?.[bid];
  if(isTutorCell(cur)||isTurnoCell(cur))return;
  get('c-info').textContent=`${g} · ${day} · ${block?.start}–${block?.end}`;
  const gs=S.gradeSubjs[g]||[];
  const subSel=get('c-subj');
  subSel.innerHTML='<option value="">— Seleccionar —</option>'+
    gs.map(x=>{const s=getSubjectMeta(x.sid);return `<option value="${x.sid}" ${cur?.sid===x.sid?'selected':''}>${s?.name||'?'}</option>`;}).join('');
  fillCT();
  if(cur?.tid)get('c-teach').value=cur.tid;
  get('c-warn').style.display='none';
  get('cmodal').style.display='flex';
}
function closeCM(){get('cmodal').style.display='none';}
function fillCT(){
  if(!cCtx)return;
  const{g,day,bid}=cCtx;
  const sid=+get('c-subj').value;
  const ts=get('c-teach');
  const cur=S.schedules[g]?.[day]?.[bid];
  ts.innerHTML='<option value="">— Seleccionar —</option>';
  if(!sid)return;
  S.teachers.forEach(t=>{
    const ass=t.assignments.find(a=>a.sid===sid&&a.gids.includes(g));
    if(!ass)return;
    let conflict='';
    Object.entries(S.schedules).forEach(([gr,gs])=>{
      if(gr===g)return;
      const c=gs[day]?.[bid];
      if(cellHasTeacher(c,t.id))conflict=gr;
    });
    const wh=tWH(t.id)-(cur?.tid===t.id?1:0);
    const streak=countTeacherGradeStreak(g,day,bid,t.id);
    const overStreak=streak>2;
    const lbl=`${t.name}${conflict?` ⚠️ [conflicto con ${conflict}]`:''}${wh>=28?' 🔴 [límite alcanzado]':''}${overStreak?' ⛔ [más de 2 horas seguidas]':''}`;
    const opt=document.createElement('option');
    opt.value=t.id;opt.textContent=lbl;
    if(conflict||wh>=28||overStreak)opt.disabled=true;
    if(cur?.tid===t.id)opt.selected=true;
    ts.appendChild(opt);
  });
}
function saveC(){
  const{g,day,bid}=cCtx;
  const sid=+get('c-subj').value;
  const tid=+get('c-teach').value;
  const cur=S.schedules[g]?.[day]?.[bid];
  if(!sid||!tid)return alert('Selecciona materia y docente');
  let conflict='';
  Object.entries(S.schedules).forEach(([gr,gs])=>{
    if(gr===g)return;
    const c=gs[day]?.[bid];
    if(cellHasTeacher(c,tid))conflict=gr;
  });
  if(conflict){
    get('c-warn').style.display='flex';
    get('c-warn').textContent=`❌ ${S.teachers.find(t=>t.id===tid)?.name} ya está en ${conflict} en este bloque.`;
    return;
  }
  if(tWH(tid)-(cur?.tid===tid?1:0)>=28){
    get('c-warn').style.display='flex';
    get('c-warn').textContent=`❌ ${S.teachers.find(t=>t.id===tid)?.name} ya alcanzó el límite de 28 horas semanales.`;
    return;
  }
  if(countTeacherGradeStreak(g,day,bid,tid)>2){
    get('c-warn').style.display='flex';
    get('c-warn').textContent=`❌ Un docente no puede quedar con más de 2 horas seguidas en ${g} el ${day}.`;
    return;
  }
  if(!S.schedules[g])S.schedules[g]={};
  if(!S.schedules[g][day])S.schedules[g][day]={};
  S.schedules[g][day][bid]={sid,tid};
  closeCM();renderView();
}
function clearC(){
  if(!cCtx)return;
  const{g,day,bid}=cCtx;
  if(S.schedules[g]?.[day])S.schedules[g][day][bid]=null;
  closeCM();renderView();
}
function delCellA(g,day,bid){
  if(isTutorCell(S.schedules[g]?.[day]?.[bid])||isTurnoCell(S.schedules[g]?.[day]?.[bid]))return;
  if(S.schedules[g]?.[day])S.schedules[g][day][bid]=null;
  renderView();
}

// ══════════════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════════════
function exportCSV(){
  const cl=S.blocks.filter(b=>b.type==='class');
  let csv='Grado,Bloque,Inicio,Fin,'+DAYS.join(',')+'\n';
  Object.entries(S.schedules).forEach(([g,gs])=>{
    cl.forEach(b=>{
      const cells=DAYS.map(d=>{
        const c=gs[d]?.[b.id];
        if(!c)return '';
        const s=getSubjectMeta(c.sid);
        return `"${s?.name||''} (${getCellTeacherNames(c)||'Sin tutor'})"`;
      });
      csv+=`"${g}","${b.label||b.start+'-'+b.end}","${b.start}","${b.end}",${cells.join(',')}\n`;
    });
  });
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='horarios.csv';a.click();
}

// ══════════════════════════════════════════
//  PERSISTENCE
// ══════════════════════════════════════════
function saveLS(){
  try{localStorage.setItem('edu_v3',JSON.stringify(S));alert('✅ Guardado en el navegador');}
  catch(e){alert('Error: '+e.message);}
}
function loadLS(){
  try{
    const r=localStorage.getItem('edu_v3');
    if(!r){alert('No hay datos guardados');return;}
    const d=JSON.parse(r);
    Object.assign(S,d);
    ensureStateDefaults();
    rbBlocks();rbGradeChips();rbSubjs();rbGSC();rbTeachers();
    alert('✅ Cargado correctamente');
  }catch(e){alert('Error: '+e.message);}
}
function resetAll(){
  if(!confirm('¿Reiniciar todo? Los datos no guardados se perderán.'))return;
  S.blocks=[];S.grades=[];S.subjects=[];S.gradeSubjs={};S.teachers=[];S.schedules={};S.tutoring={sessionsPerWeek:1};S.turnos={enabled:true,targetHours:28};
  sci=0;eTid=null;aRows=[];cCtx=null;
  rbBlocks();get('grade-chips').innerHTML='';rbSubjs();
  get('gsc-cont').innerHTML='';rbTeachers();goTo(0);
}

// ══════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════
function ensureStateDefaults(){
  if(!S.tutoring||typeof S.tutoring!=='object')S.tutoring={sessionsPerWeek:1};
  if(typeof S.tutoring.sessionsPerWeek!=='number')S.tutoring.sessionsPerWeek=1;
  if(!S.turnos||typeof S.turnos!=='object')S.turnos={enabled:true,targetHours:28};
  if(typeof S.turnos.enabled!=='boolean')S.turnos.enabled=true;
  if(typeof S.turnos.targetHours!=='number')S.turnos.targetHours=28;
  S.teachers=(S.teachers||[]).map(t=>({...t,tutorGrade:t.tutorGrade||''}));
}
function updTutorCfg(v){
  const num=Math.max(0,Math.min(5,+v||0));
  S.tutoring.sessionsPerWeek=num;
  const el=get('tutor-hpw');
  if(el)el.value=num;
  rbTeachers();
}
function updTurnoCfgEnabled(v){
  S.turnos.enabled=String(v)==='1';
  const el=get('turno-en');
  if(el)el.value=S.turnos.enabled?'1':'0';
}
function updTurnoCfgTarget(v){
  const num=Math.max(1,Math.min(40,+v||28));
  S.turnos.targetHours=num;
  const el=get('turno-target');
  if(el)el.value=num;
}
function getSubjectMeta(sid){
  if(sid===TUTOR_SUBJECT_ID)return{id:TUTOR_SUBJECT_ID,name:'Tutoría',abbr:'TUT',ci:'tutor'};
  if(sid===TURNO_SUBJECT_ID)return{id:TURNO_SUBJECT_ID,name:'Turno',abbr:'TRN',ci:'turno'};
  return S.subjects.find(s=>s.id===sid);
}
function getTeacherName(id){return S.teachers.find(t=>t.id===id)?.name||'?';}
function getTeacherNamesByIds(ids){return(ids||[]).map(getTeacherName).join(' · ');}
function getCellTeacherIds(cell){
  if(!cell)return[];
  if(Array.isArray(cell.tids))return cell.tids.filter(Boolean);
  return cell.tid?[cell.tid]:[];
}
function getCellTeacherNames(cell){return getTeacherNamesByIds(getCellTeacherIds(cell));}
function cellHasTeacher(cell,tid){return getCellTeacherIds(cell).includes(tid);}
function removeTeacherFromCell(cell,tid){
  if(!cell)return cell;
  const tids=getCellTeacherIds(cell).filter(x=>x!==tid);
  if(isTutorCell(cell))return {...cell,tids,tid:tids[0]??null};
  return tids.length?{...cell,tid:tids[0],tids:[tids[0]]}:null;
}
function isTutorCell(cell){return cell?.sid===TUTOR_SUBJECT_ID;}
function isTurnoCell(cell){return cell?.sid===TURNO_SUBJECT_ID;}
function getGradeTutorIds(g){return S.teachers.filter(t=>t.tutorGrade===g).map(t=>t.id).slice(0,2);}
function countGradeTutors(g,excludeTid=null){return S.teachers.filter(t=>t.tutorGrade===g&&t.id!==excludeTid).length;}
function get(id){return document.getElementById(id);}
function set(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function uid(){return Date.now()+Math.random();}
function esc(s){return s.replace(/[^a-zA-Z0-9]/g,'_');}

// close modals on backdrop click
document.getElementById('tmodal').addEventListener('click',function(e){if(e.target===this)closeTM();});
document.getElementById('cmodal').addEventListener('click',function(e){if(e.target===this)closeCM();});

// INIT
ensureStateDefaults();
rbBlocks();