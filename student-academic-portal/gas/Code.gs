/** Backend: ระบบตรวจสอบคุณสมบัติ ม.4 ปีการศึกษา 2570 — โรงเรียนมัธยมประชานิเวศน์
 *  Script Properties: API_SECRET, ADMIN_USER, ADMIN_PASS (ใช้ครั้งแรกแล้วระบบลบทิ้ง), SHEET_ID (ถ้าสคริปต์ไม่ได้ผูกกับชีต) */
const HEAD=['เลขประจำตัว','คำนำหน้า','ชื่อ','นามสกุล','GPAX','เลขบัตรประชาชน','คณิต','วิทย์','ภาษาต่างประเทศ'];
const SHEETS={Students:HEAD,Admins:['username','salt','hash','name','role','active','createdAt'],
 SearchLogs:['เวลา','ผลการค้นหา','ประเภท'],ActivityLogs:['เวลา','ผู้ใช้','การกระทำ','รายละเอียด'],
 ImportLogs:['เวลา','ผู้ใช้','จำนวน','หมายเหตุ'],Settings:['key','value']};
const prop_=k=>PropertiesService.getScriptProperties().getProperty(k);
const ss_=()=>prop_('SHEET_ID')?SpreadsheetApp.openById(prop_('SHEET_ID')):SpreadsheetApp.getActiveSpreadsheet();
const sh_=n=>ss_().getSheetByName(n);
const now_=()=>Utilities.formatDate(new Date(),'Asia/Bangkok','yyyy-MM-dd HH:mm:ss');
const fail_=(code,msg)=>{const e=new Error(code);e.code=code;e.userMsg=msg;return e;};
function setting_(k,d){const v=sh_('Settings').getDataRange().getValues().find(r=>r[0]===k);return v?Number(v[1]):d;}

/** รันครั้งเดียวจาก Editor: สร้างชีตและบัญชีแรก */
function setup(){
  const ss=ss_();
  Object.keys(SHEETS).forEach(n=>{const s=ss.getSheetByName(n)||ss.insertSheet(n);
    if(s.getLastRow()===0){s.getRange(1,1,1,SHEETS[n].length).setValues([SHEETS[n]]).setFontWeight('bold');s.setFrozenRows(1);}});
  const st=sh_('Students');st.getRange('A:A').setNumberFormat('@');st.getRange('F:F').setNumberFormat('@');
  const se=sh_('Settings');if(se.getLastRow()<2)se.getRange(2,1,2,2).setValues([['SESSION_MIN',30],['SEARCH_LIMIT',10]]);
  const u=prop_('ADMIN_USER'),p=prop_('ADMIN_PASS'),ad=sh_('Admins');
  if(u&&p&&ad.getLastRow()<2){const salt=Utilities.getUuid();ad.appendRow([u.toLowerCase(),salt,hash_(salt,p),'ผู้ดูแลระบบ','superadmin',true,now_()]);
    PropertiesService.getScriptProperties().deleteProperty('ADMIN_PASS');}
}
function hash_(salt,pw){let h=salt+pw;for(let i=0;i<1000;i++)h=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,h+salt,Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');return h;}

function doGet(){return ContentService.createTextOutput('OK');}
function doPost(e){let out;
  try{const b=JSON.parse(e.postData.contents);
    if(!b.secret||b.secret!==prop_('API_SECRET'))throw fail_('FORBIDDEN','ไม่อนุญาต');
    const f=ACTIONS[b.action];if(!f)throw fail_('BAD_ACTION','คำขอไม่ถูกต้อง');
    out={ok:true,data:f(b)};
  }catch(err){out={ok:false,error:err.code||'SERVER_ERROR',message:err.userMsg||'เกิดข้อผิดพลาดของระบบ'};if(!err.code)console.error(err.message);}
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);}

function rate_(key,max,sec){const c=CacheService.getScriptCache(),n=Number(c.get(key)||0)+1;
  if(n>max)throw fail_('RATE_LIMIT','มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');c.put(key,String(n),sec);}
function session_(b,roles){const c=CacheService.getScriptCache(),raw=b.token&&c.get('s_'+b.token);
  if(!raw)throw fail_('SESSION','เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const s=JSON.parse(raw);if(roles&&roles.indexOf(s.role)<0)throw fail_('PERM','ไม่มีสิทธิ์ดำเนินการนี้');
  c.put('s_'+b.token,raw,setting_('SESSION_MIN',30)*60);return s;}
function log_(sheet,row){sh_(sheet).appendRow([now_()].concat(row));}
const EDIT=['superadmin','editor'];

function search_(b){
  rate_('r_'+b.ip,setting_('SEARCH_LIMIT',10),600);rate_('g_all',120,60);
  const id=String(b.cid||'');if(!/^\d{13}$/.test(id))throw fail_('INVALID','กรุณากรอกเลขบัตรประชาชน 13 หลักให้ถูกต้อง');
  const s=sh_('Students'),n=s.getLastRow()-1;let row=null;
  if(n>0){const f=s.getRange(2,6,n,1).createTextFinder(id).matchEntireCell(true).findNext();
    if(f)row=s.getRange(f.getRow(),1,1,9).getDisplayValues()[0];}
  log_('SearchLogs',[row?'พบ':'ไม่พบ','นักเรียน']);
  if(!row)throw fail_('NOT_FOUND','ไม่พบข้อมูลในระบบ กรุณาตรวจสอบเลขบัตรประชาชนของท่านอีกครั้ง หรือติดต่อผู้ดูแลระบบ');
  return {id:row[0],title:row[1],first:row[2],last:row[3],gpax:row[4],cid:id[0]+'-XXXX-XXXXX-'+id.slice(10,12)+'-'+id[12],math:row[6],sci:row[7],lang:row[8]};}

function login_(b){
  const u=String(b.username||'').toLowerCase().trim(),c=CacheService.getScriptCache(),fk='f_'+u+'|'+b.ip,n=Number(c.get(fk)||0);
  if(n>=5)throw fail_('LOCKED','ลองผิดหลายครั้ง บัญชีถูกล็อกชั่วคราว 15 นาที');
  const r=sh_('Admins').getDataRange().getValues().slice(1).find(x=>x[0]===u);
  if(!r||r[5]!==true||hash_(r[1],String(b.password||''))!==r[2]){c.put(fk,String(n+1),900);throw fail_('LOGIN','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');}
  c.remove(fk);const token=Utilities.getUuid()+Utilities.getUuid(),m=setting_('SESSION_MIN',30);
  c.put('s_'+token,JSON.stringify({u:u,role:r[4],name:r[3]}),m*60);
  log_('ActivityLogs',[u,'เข้าสู่ระบบ','']);return {token:token,user:{u:u,role:r[4],name:r[3]},minutes:m};}
function logout_(b){const s=session_(b);CacheService.getScriptCache().remove('s_'+b.token);log_('ActivityLogs',[s.u,'ออกจากระบบ','']);return true;}
function me_(b){return {user:session_(b)};}

function rows_(){const s=sh_('Students'),n=s.getLastRow()-1;return n>0?s.getRange(2,1,n,9).getDisplayValues():[];}
const isNum_=(v,lo,hi)=>v!==''&&!isNaN(Number(v))&&Number(v)>=lo&&Number(v)<=hi;
function validate_(rows){const issues=[],ids={},cids={};
  rows.forEach(r=>{ids[r[0]]=(ids[r[0]]||0)+1;cids[r[5]]=(cids[r[5]]||0)+1;});
  rows.forEach((r,i)=>{const add=(t,m)=>issues.push({row:i+2,id:r[0],name:(r[2]+' '+r[3]).trim(),type:t,msg:m});
    if(!r[0])add('check','เลขประจำตัวว่าง');else if(ids[r[0]]>1)add('dup','เลขประจำตัวซ้ำ');
    if(!/^\d{13}$/.test(r[5]))add('check','เลขบัตรประชาชนไม่ครบ 13 หลัก หรือมีอักขระที่ไม่ใช่ตัวเลข');else if(cids[r[5]]>1)add('dup','เลขบัตรประชาชนซ้ำ');
    if(!r[2].trim())add('check','ชื่อว่าง');if(!r[3].trim())add('check','นามสกุลว่าง');
    if(!isNum_(r[4],0,4))add('check','GPAX ไม่ใช่ตัวเลขหรืออยู่นอกช่วง 0.00–4.00');
    [[6,'คณิต'],[7,'วิทย์'],[8,'ภาษาต่างประเทศ']].forEach(p=>{if(!isNum_(r[p[0]],0,4))add('check','เกรด'+p[1]+'ไม่ถูกต้อง (ต้องเป็นตัวเลข 0.00–4.00)');});});
  return issues;}
function validate(b){session_(b);const rows=rows_();return {total:rows.length,issues:validate_(rows)};}

function stats(b){session_(b);const rows=rows_(),iss=validate_(rows),bad={},dup={};
  iss.forEach(x=>{bad[x.row]=1;if(x.type==='dup')dup[x.row]=1;});
  const g=rows.map(r=>Number(r[4])).filter(v=>!isNaN(v)&&v>=0&&v<=4),bins=[0,0,0,0,0,0];
  g.forEach(v=>bins[v<1?0:v<2?1:v<2.5?2:v<3?3:v<3.5?4:5]++);
  const avg=i=>{const a=rows.map(r=>Number(r[i])).filter(v=>!isNaN(v)&&v>=0&&v<=4);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
  return {total:rows.length,complete:rows.length-Object.keys(bad).length,check:Object.keys(bad).length-Object.keys(dup).length,problem:Object.keys(dup).length,
    gpax:g.length?{avg:g.reduce((a,c)=>a+c,0)/g.length,min:Math.min.apply(null,g),max:Math.max.apply(null,g)}:null,bins:bins,
    subj:{math:avg(6),sci:avg(7),lang:avg(8)},recent:rows.slice(-5).reverse(),activity:tail_('ActivityLogs',8,4)};}

function list(b){session_(b);let rows=rows_();const q=String(b.q||'').trim().toLowerCase();
  if(q){const q2=q.replace(/\s/g,'');rows=rows.filter(r=>r[0].toLowerCase().indexOf(q)>=0||(r[2]+r[3]).toLowerCase().indexOf(q2)>=0);}
  const c=Math.max(0,Math.min(8,Number(b.sort)||0)),d=b.dir==='desc'?-1:1,num=[4,6,7,8].indexOf(c)>=0;
  rows.sort((a,z)=>d*(num?Number(a[c])-Number(z[c]):String(a[c]).localeCompare(String(z[c]),'th')));
  const size=Math.min(100,Number(b.size)||20),page=Math.max(1,Number(b.page)||1);
  return {total:rows.length,rows:rows.slice((page-1)*size,page*size)};}

function clean_(v){return String(v==null?'':v).trim().replace(/^[=+\-@\t\r]+/,'').slice(0,60);}
function save(b){const s=session_(b,EDIT),d=b.data||{},r=[clean_(d.id),clean_(d.title),clean_(d.first),clean_(d.last),clean_(d.gpax),clean_(d.cid),clean_(d.math),clean_(d.sci),clean_(d.lang)];
  if(!/^[0-9A-Za-z]{1,20}$/.test(r[0]))throw fail_('INVALID','เลขประจำตัวไม่ถูกต้อง');
  if(!/^\d{13}$/.test(r[5]))throw fail_('INVALID','เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
  if(!r[2]||!r[3])throw fail_('INVALID','กรุณากรอกชื่อและนามสกุล');
  [4,6,7,8].forEach(i=>{if(!isNum_(r[i],0,4))throw fail_('INVALID',HEAD[i]+' ต้องเป็นตัวเลข 0.00–4.00');});
  const lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const sh=sh_('Students'),all=rows_(),orig=b.orig?String(b.orig):null,oi=orig?all.findIndex(x=>x[0]===orig):-1;
    if(orig&&oi<0)throw fail_('NOT_FOUND','ไม่พบรายการที่ต้องการแก้ไข');
    all.forEach((x,i)=>{if(i===oi)return;if(x[0]===r[0])throw fail_('DUP','เลขประจำตัวนี้มีอยู่ในระบบแล้ว');if(x[5]===r[5])throw fail_('DUP','เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');});
    const row=oi<0?sh.getLastRow()+1:oi+2;
    sh.getRange(row,1).setNumberFormat('@');sh.getRange(row,6).setNumberFormat('@');
    sh.getRange(row,1,1,9).setValues([r.map((v,i)=>[4,6,7,8].indexOf(i)>=0?Number(v):v)]);
    log_('ActivityLogs',[s.u,oi<0?'เพิ่มนักเรียน':'แก้ไขนักเรียน','เลขประจำตัว '+r[0]]);
  }finally{lock.releaseLock();}return true;}
function remove(b){const s=session_(b,EDIT),lock=LockService.getScriptLock();lock.waitLock(15000);
  try{const i=rows_().findIndex(x=>x[0]===String(b.id));if(i<0)throw fail_('NOT_FOUND','ไม่พบรายการ');
    sh_('Students').deleteRow(i+2);log_('ActivityLogs',[s.u,'ลบนักเรียน','เลขประจำตัว '+b.id]);}finally{lock.releaseLock();}return true;}

function tail_(name,n,w){const s=sh_(name),c=s.getLastRow()-1;return c>0?s.getRange(Math.max(2,c+2-n),1,Math.min(n,c),w).getDisplayValues().reverse():[];}
function searchLogs(b){session_(b);const rows=tail_('SearchLogs',200,3);return {rows:rows,found:rows.filter(r=>r[1]==='พบ').length,missing:rows.filter(r=>r[1]!=='พบ').length};}
function activity(b){session_(b);return {rows:tail_('ActivityLogs',200,4)};}

function admins(b){session_(b,['superadmin']);return sh_('Admins').getDataRange().getValues().slice(1).map(r=>({username:r[0],name:r[3],role:r[4],active:r[5]===true,createdAt:String(r[6])}));}
function saveAdmin(b){const me=session_(b,['superadmin']),d=b.data||{},u=String(d.username||'').toLowerCase().trim();
  if(!/^[a-z0-9_.-]{3,30}$/.test(u))throw fail_('INVALID','ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . - (3–30 ตัว)');
  if(['superadmin','editor','viewer'].indexOf(d.role)<0)throw fail_('INVALID','สิทธิ์ไม่ถูกต้อง');
  const pw=String(d.password||'');if(pw&&pw.length<8)throw fail_('INVALID','รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  const sh=sh_('Admins'),all=sh.getDataRange().getValues(),i=all.findIndex((r,k)=>k>0&&r[0]===u),name=clean_(d.name)||u;
  if(i<0){if(!pw)throw fail_('INVALID','กรุณากำหนดรหัสผ่าน');const salt=Utilities.getUuid();sh.appendRow([u,salt,hash_(salt,pw),name,d.role,true,now_()]);}
  else{if(u===me.u&&(d.active===false||d.role!=='superadmin'))throw fail_('INVALID','ไม่สามารถปิดหรือลดสิทธิ์บัญชีของตนเองได้');
    sh.getRange(i+1,4,1,3).setValues([[name,d.role,d.active!==false]]);if(pw){const salt=Utilities.getUuid();sh.getRange(i+1,2,1,2).setValues([[salt,hash_(salt,pw)]]);}}
  log_('ActivityLogs',[me.u,i<0?'เพิ่มบัญชีผู้ดูแล':'แก้ไขบัญชีผู้ดูแล',u]);return true;}
function changePw(b){const me=session_(b),pw=String(b.newPassword||'');if(pw.length<8)throw fail_('INVALID','รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  const sh=sh_('Admins'),all=sh.getDataRange().getValues(),i=all.findIndex((r,k)=>k>0&&r[0]===me.u);
  if(i<0||hash_(all[i][1],String(b.oldPassword||''))!==all[i][2])throw fail_('LOGIN','รหัสผ่านเดิมไม่ถูกต้อง');
  const salt=Utilities.getUuid();sh.getRange(i+1,2,1,2).setValues([[salt,hash_(salt,pw)]]);log_('ActivityLogs',[me.u,'เปลี่ยนรหัสผ่าน','']);return true;}

const ACTIONS={search:search_,login:login_,logout:logout_,me:me_,stats:stats,list:list,save:save,remove:remove,validate:validate,searchLogs:searchLogs,activity:activity,admins:admins,saveAdmin:saveAdmin,changePw:changePw};
