'use strict';
const P=ProcessLab,storageKey='eatsfresh.process.1',$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fresh(){return {rows:P.seeds(),threshold:.60}}
let db;try{db=JSON.parse(localStorage.getItem(storageKey));if(!db?.rows?.length||!Number.isFinite(db.threshold))db=fresh()}catch{db=fresh()}
let selected=P.key(db.rows[0]),tab='prep',query='',timer;
const current=()=>db.rows.find(r=>P.key(r)===selected);
const options=(values,sel)=>values.map(x=>`<option ${x===sel?'selected':''}>${esc(x)}</option>`).join('');
function toast(text){$('#toast').textContent=text;clearTimeout(timer);timer=setTimeout(()=>$('#toast').textContent='',3200)}
function persist(msg){try{localStorage.setItem(storageKey,JSON.stringify(db));toast(msg)}catch{toast('브라우저 저장 공간을 사용할 수 없습니다. 자료를 내려받으세요.')}}
function dialog(html){$('#dialog-body').innerHTML=html;$('#dialog').showModal()}
function csv(name,rows){
 const cell=v=>{let s=String(v??'');if(/^[=@+\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(a=>a.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function list(){
 const displayed=db.rows.filter(r=>(P.key(r)+' '+r.product).toLowerCase().includes(query.toLowerCase()));
 $('#count').textContent=displayed.length+'회차';
 $('#lots').innerHTML=displayed.map(r=>`<button class="lot" data-lot="${esc(P.key(r))}" aria-pressed="${selected===P.key(r)}"><b>${esc(r.lot)}</b><small>${esc(r.product)} · ${r.round}회차 · ${r.kg} kg</small></button>`).join('')||'<p class="hint">검색 결과가 없습니다.</p>';
 return displayed;
}
function title(r,name,tools=''){return `<div class="title"><div><p>${esc(r.lot)} / ${r.round}회차 · ${esc(r.product)}</p><h2>${name}</h2></div>${tools}</div>`}
function number(name,label,v,step='0.1',min='0.1'){return `<label>${label}<input name="${name}" type="number" step="${step}" min="${min}" required value="${esc(v)}"></label>`}
function prep(r){
 return title(r,'전처리 작업 기록','<button class="soft small" id="import">CSV 등록</button>')+`<p>세척 전 원물 상태와 작업량을 기록하세요. 같은 품목·원물 상태의 참고 회차와 비교합니다.</p><form id="prep-form"><div class="gridform"><label>품목<select name="product">${options(P.products,r.product)}</select></label><label>원물 상태<select name="surface">${options(P.surfaces,r.surface)}</select></label>${number('kg','투입량 (kg)',r.kg)}${number('prep','전처리 시간 (분)',r.prep)}${number('wash','세척 시간 (분)',r.wash)}<div></div>${number('sample','세척 후 확인 수 (개)',r.sample,'1','1')}${number('residual','재선별 대상 수 (개)',r.residual,'1','0')}</div><div class="tools"><button>작업 기록 저장</button><button type="button" class="soft" id="example">연습 CSV 받기</button></div></form><p class="hint">기존 기록은 로트 번호와 회차로 구분합니다. 새 회차는 CSV로 추가하세요.</p>`;
}
function wash(r){
 const a=P.analyze(r),v=P.vector(r),flag=a.score>=db.threshold, training=db.rows.filter(x=>typeof x.expected==='boolean');
 let fp=0,fn=0;training.forEach(x=>{const pred=P.analyze(x).score>=db.threshold;if(pred&&!x.expected)fp++;if(!pred&&x.expected)fn++});
 return title(r,'세척 조건 비교')+`<div class="status-line"><span class="score">${a.score.toFixed(3)} <small>이상 점수</small></span><span class="badge ${flag?'flag':''}">${flag?'우선 점검 후보':'일반 검토'}</span></div><p class="hint">점수가 높을수록 참고 회차와 작업 조건의 조합이 다릅니다.</p><h3>비슷한 원물과 비교</h3><p class="muted">${esc(r.product)} · ${esc(r.surface)} · 훈련용 정상 참고 96회차</p><table class="comparison"><thead><tr><th>작업 조건</th><th>참고 중앙값</th><th>선택 회차</th><th>차이</th></tr></thead><tbody>${P.fields.map((f,i)=>{const m=a.medians[i],d=v[i]-m;return `<tr><td>${f} (${P.units[i]})</td><td>${m.toFixed(1)}</td><td><b>${v[i]}</b></td><td>${d>=0?'+':''}${d.toFixed(1)}</td></tr>`}).join('')}</tbody></table><div class="strip"><label for="threshold">후보 선정 기준 <strong id="cutoff">${db.threshold.toFixed(2)}</strong></label><input type="range" id="threshold" min="0.45" max="0.75" step="0.01" value="${db.threshold}"><span class="muted">기준 이상의 회차를 점검 후보로 표시합니다.</span></div><p><b>별도 검증 ${training.length}회차</b> · 오탐 ${fp}건 · 누락 ${fn}건</p><div class="tools"><button id="analysis-csv" class="soft small">분석 결과 내려받기</button><button id="method" class="soft small">점수 계산 방법</button></div>`;
}
const rate=(n,total)=>100*n/total;
function history(r){
 const past=r.history,base=past.length?past[past.length-1]:null,beforeN=base?base.after:r.residual,beforeTotal=base?base.sample:r.sample;
 return title(r,'재처리 이력', '<button class="soft small" id="history-csv">이력 내려받기</button>')+`<div class="strip"><b>${base?'직전 재처리':'최초 세척'} 결과</b> · 확인 ${beforeTotal}개 중 재선별 대상 ${beforeN}개 (${rate(beforeN,beforeTotal).toFixed(1)}%)</div><form id="follow"><div class="gridform"><label>조치 유형<select name="kind">${options(['재선별','재세척','조건 재확인'],'재선별')}</select></label>${number('sample','조치 후 확인 수 (개)',beforeTotal,1,1)}${number('after','조치 후 재선별 대상 (개)','',1,0)}<label class="wide">작업 메모<textarea name="note" required maxlength="500" placeholder="무엇을 확인하고 어떻게 조치했나요?"></textarea></label></div><div class="tools"><button type="button" class="soft" id="fill">연습 결과 채우기</button><button>재처리 결과 저장</button></div></form><h3>회차별 처리 경과</h3>${past.length?[...past].reverse().map(h=>{const a=rate(h.before,h.beforeTotal),b=rate(h.after,h.sample);return `<div class="log"><b>재처리 ${h.seq}차 · ${esc(h.kind)}</b><p>대상 비율 ${a.toFixed(1)}% → ${b.toFixed(1)}% (${b>a?'+':''}${(b-a).toFixed(1)}%p)</p><p class="muted">${esc(h.note)}</p></div>`}).join(''):'<p class="hint">조치를 저장하면 전후 대상 비율과 작업 메모가 여기에 남습니다.</p>'}`;
}
function render(){
 document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 const visible=list();if(!visible.length){$('#work').innerHTML='<h2>작업 회차를 찾지 못했습니다.</h2><p class="hint">다른 로트 번호나 품목으로 검색하세요.</p>';return}
 if(!visible.some(r=>P.key(r)===selected)){selected=P.key(visible[0]);list()}
 const r=current();$('#work').innerHTML=tab==='prep'?prep(r):tab==='wash'?wash(r):history(r);
}
$('#query').oninput=e=>{query=e.target.value.trim();render()};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.tab){tab=b.dataset.tab;render();return}
 if(b.dataset.lot){selected=b.dataset.lot;render();return}
 const r=current();
 switch(b.id){
 case 'example':csv('잇츠프레시_작업회차_연습.csv',[P.header,...P.seeds().slice(0,3).map((s,i)=>['TRAIN-'+(i+1),...P.cells(s).slice(1)])]);break;
 case 'import':dialog('<h2>작업 회차 CSV 등록</h2><p>연습 CSV와 같은 한글 열 이름과 단위를 사용하세요. 같은 로트·회차는 중복 제외합니다.</p><form id="upload-form"><label>CSV 파일<input name="file" type="file" accept=".csv" required></label><p class="hint" role="status" id="file-error"></p><button>회차 등록</button></form>');break;
 case 'method':dialog('<h2>이상 점수 읽는 법</h2><p>같은 품목과 원물 상태의 가상 정상 회차 96건으로 Isolation Forest를 구성합니다. 투입량·전처리 시간·세척 시간이 다른 회차에서 쉽게 분리될수록 점수가 높습니다.</p><p class="hint">세척 후 재선별 수는 후속 비교에만 씁니다. 오탐은 일반 사례를 후보로 고른 수, 누락은 점검 사례를 놓친 수입니다. 별도 검증에는 기본값 그대로인 예시 회차를 사용합니다.</p>');break;
 case 'analysis-csv':csv('작업회차_이상분석.csv',[[...P.header,'이상 점수','선정 기준','점검 구분'],...db.rows.map(x=>{const s=P.analyze(x).score;return [...P.cells(x),s.toFixed(4),db.threshold,s>=db.threshold?'우선 점검 후보':'일반 검토']})]);break;
 case 'fill':{const f=$('#follow').elements,last=r.history.at(-1);f.kind.value='재세척';f.sample.value=last?.sample??r.sample;f.after.value=Math.max(0,Math.floor((last?.after??r.residual)/2));f.note.value='원물 상태와 최초 세척 시간을 대조하고 재세척 후 같은 수량을 다시 확인함.';break}
 case 'history-csv':{const lines=db.rows.flatMap(x=>x.history.map(h=>[x.lot,x.round,h.seq,h.kind,h.beforeTotal,h.before,h.sample,h.after,h.note,h.time]));if(!lines.length){toast('재처리 결과를 먼저 한 건 저장하세요.');break}csv('재처리이력.csv',[['로트','최초 작업 회차','재처리 차수','유형','조치 전 확인 수','조치 전 대상 수','조치 후 확인 수','조치 후 대상 수','메모','저장시각'],...lines]);break}
 case 'manage':dialog('<h2>자료 관리</h2><p>작업 기록과 재처리 이력은 접속한 브라우저에 저장됩니다.</p><div class="tools"><button id="download">작업 기록 CSV</button><button id="reset" class="soft reset">기본 자료로 복원</button></div><div id="confirm"></div>');break;
 case 'download':csv('잇츠프레시_작업기록.csv',[P.header,...db.rows.map(P.cells)]);break;
 case 'reset':$('#confirm').innerHTML='<p class="hint">추가한 작업과 조치 이력을 지우고 기본 12회차를 복원합니다.</p><button id="confirm-reset">초기화 확인</button>';break;
 case 'confirm-reset':db=fresh();selected=P.key(db.rows[0]);query='';$('#query').value='';$('#dialog').close();persist('기본 회차를 복원했습니다.');render();break;
 }
});
document.addEventListener('input',e=>{if(e.target.id==='threshold')$('#cutoff').textContent=Number(e.target.value).toFixed(2)});
document.addEventListener('change',e=>{if(e.target.id==='threshold'){db.threshold=Number(e.target.value);persist('선정 기준을 적용했습니다.');render();$('#threshold').focus()}});
document.addEventListener('submit',async e=>{
 const f=e.target;if(!['prep-form','follow','upload-form'].includes(f.id))return;e.preventDefault();const v=f.elements,r=current();
 try{
 if(f.id==='upload-form'){const {added,duplicates}=P.importCSV(await v.file.files[0].text(),db.rows);db.rows.push(...added);if(added.length){selected=P.key(added[0]);query='';$('#query').value=''}$('#dialog').close();persist('신규 '+added.length+'회차 · 중복 제외 '+duplicates+'회차');render();return}
 if(f.id==='prep-form'){
 const updated=P.record([r.lot,r.round,v.product.value,v.surface.value,v.kg.value,v.prep.value,v.wash.value,v.sample.value,v.residual.value]);
 if(r.history.length&&P.cells(r).join('|')!==P.cells(updated).join('|'))throw Error('재처리 이력이 연결된 원본입니다. 새 작업 회차로 등록하세요.');
 if(P.cells(r).join('|')!==P.cells(updated).join('|'))Object.assign(r,updated,{expected:null});
 persist('전처리 작업 기록을 저장했습니다.');
 }else{
 const sample=Number(v.sample.value),after=Number(v.after.value),note=v.note.value.trim();
 if(!note||!Number.isSafeInteger(sample)||sample<1||!Number.isSafeInteger(after)||after<0||after>sample)throw Error('작업 메모와 확인 수·대상 수를 확인하세요.');
 const last=r.history.at(-1);r.history.push({seq:r.history.length+1,kind:v.kind.value,sample,after,note,before:last?.after??r.residual,beforeTotal:last?.sample??r.sample,time:new Date().toISOString()});persist('재처리 결과를 기록했습니다.');
 }render()
 }catch(err){if(f.id==='upload-form')$('#file-error').textContent=err.message;else toast(err.message)}
});
render();

