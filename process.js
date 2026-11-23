'use strict';
const ProcessLab=(()=>{
 const products=['토망고','방울토마토'],surfaces=['부착물 적음','부착물 많음'];
 const fields=['투입량','전처리 시간','세척 시간'],units=['kg','분','분'];
 const med=values=>{const a=[...values].sort((x,y)=>x-y),k=Math.floor(a.length/2);return a.length%2?a[k]:(a[k-1]+a[k])/2};
 const meanDepth=n=>n<2?0:n===2?1:2*(Math.log(n-1)+0.5772156649)-2*(n-1)/n;
 function rng(seed){let n=seed>>>0;return ()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296}}
 function features(p,s){return [p===products[0]?80:66,s===surfaces[0]?12:18,s===surfaces[0]?8:12]}
 function vector(r){return [r.kg,r.prep,r.wash]}
 function tree(rows,d,random){
   if(d>=6||rows.length<=1)return {n:rows.length};
   const spans=[0,1,2].map(i=>{const v=rows.map(r=>r[i]);return {i,min:Math.min(...v),max:Math.max(...v)}}).filter(f=>f.max>f.min);
   if(!spans.length)return {n:rows.length};
   const {i,min,max}=spans[Math.floor(random()*spans.length)],cut=min+(max-min)*(0.000001+0.999998*random());
   return {i,cut,left:tree(rows.filter(x=>x[i]<cut),d+1,random),right:tree(rows.filter(x=>x[i]>=cut),d+1,random)};
 }
 function path(t,v,d=0){return 'n' in t?d+meanDepth(t.n):path(v[t.i]<t.cut?t.left:t.right,v,d+1)}
 const models=new Map();
 function model(p,s){
   const k=p+'|'+s;if(models.has(k))return models.get(k);
   const random=rng(456+(products.indexOf(p)+1)*91+surfaces.indexOf(s)*37),base=features(p,s);
   const refs=Array.from({length:96},()=>base.map((b,j)=>+(b+(random()+random()+random()-1.5)*[11,3.2,2][j]).toFixed(1)));
   const forest=Array.from({length:64},()=>{const sample=[...refs];for(let i=0;i<64;i++){const j=i+Math.floor(random()*(sample.length-i));[sample[i],sample[j]]=[sample[j],sample[i]]}return tree(sample.slice(0,64),0,random)});
   const m={refs,forest,medians:base.map((_,i)=>med(refs.map(r=>r[i])))};models.set(k,m);return m;
 }
 function analyze(r){const m=model(r.product,r.surface),v=vector(r);return {...m,score:2**(-m.forest.reduce((a,t)=>a+path(t,v),0)/m.forest.length/meanDepth(64))}}
 function seeds(){
   const values=[
    [0,1,111,11,5,8,true],[0,0,82,12,8,1,false],[1,0,66,13,8,2,false],[0,1,84,19,12,2,false],[1,1,93,10,6,7,true],[0,0,78,11,8,1,false],[1,1,64,17,12,2,false],[0,0,97,9,5,5,true],[1,0,69,12,9,1,false],[0,1,81,16,11,3,false],[1,0,49,18,12,4,true],[1,1,66,18,11,2,false]
   ];
   return values.map(([p,s,kg,prep,wash,residual,expected],i)=>({lot:'EF-1123-'+String(i+1).padStart(2,'0'),round:1,product:products[p],surface:surfaces[s],kg,prep,wash,sample:50,residual,expected,history:[]}));
 }
 const key=r=>r.lot+'/'+r.round;
 const header=['로트','회차','품목','원물 상태','투입량(kg)','전처리(분)','세척(분)','확인 수','재선별 대상 수'];
 const cells=r=>[r.lot,r.round,r.product,r.surface,r.kg,r.prep,r.wash,r.sample,r.residual];
 function record(v){
   if(v.length!==9)throw Error('열 수를 확인하세요.');
   const [lot,round,p,s,kg,prep,wash,sample,residual]=v.map(x=>String(x??'').trim());
   if(!/^[A-Za-z가-힣0-9_-]{1,40}$/.test(lot)||!products.includes(p)||!surfaces.includes(s))throw Error('로트, 품목 또는 원물 상태를 확인하세요.');
   const values=[round,kg,prep,wash,sample,residual];
   if(values.some(x=>!x||!Number.isFinite(Number(x)))||values.slice(0,5).some(x=>+x<=0)||![round,sample,residual].every(x=>Number.isSafeInteger(+x))||+residual<0||+residual>+sample)throw Error('빈 값, 단위 또는 표본 수를 확인하세요. 재선별 대상은 확인 수 이하여야 합니다.');
   return {lot,round:+round,product:p,surface:s,kg:+kg,prep:+prep,wash:+wash,sample:+sample,residual:+residual,expected:null,history:[]};
 }
 function importCSV(text,existing){
   const raw=text.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false;
   function finish(){row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=''}
   for(let i=0;i<raw.length;i++){let c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(!quoted&&c===','){row.push(cell);cell=''}else if(!quoted&&/[\r\n]/.test(c)){if(c==='\r'&&raw[i+1]==='\n')i++;finish()}else cell+=c}
   if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');finish();
   if(!rows.length||rows.shift().map(x=>x.trim()).join('|')!==header.join('|')||!rows.length)throw Error('예시 CSV의 한글 제목 행과 작업 기록을 넣으세요.');
   const known=new Set(existing.map(key)),added=[];let duplicates=0;
   rows.forEach((v,i)=>{try{const r=record(v);if(known.has(key(r)))duplicates++;else{known.add(key(r));added.push(r)}}catch(e){throw Error((i+2)+'행 · '+e.message)}});
   return {added,duplicates};
 }
 return {products,surfaces,fields,units,vector,analyze,seeds,key,header,cells,record,importCSV};
})();
if(typeof module!=='undefined')module.exports=ProcessLab;

