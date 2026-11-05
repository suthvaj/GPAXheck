const $ = s => document.querySelector(s), main = $('#main');
let me = null, idleT, idleMin = 30, st = { q: '', page: 1, sort: 0, dir: 'asc', size: 20 };
const ROLE = { superadmin: 'ผู้ดูแลสูงสุด', editor: 'แก้ไขข้อมูลได้', viewer: 'ดูอย่างเดียว' };
const canEdit = () => me && me.role !== 'viewer';
const SECS = [['ov', 'ภาพรวม'], ['stu', 'จัดการข้อมูลนักเรียน'], ['val', 'ตรวจสอบข้อมูล'], ['sl', 'ประวัติการค้นหา'], ['act', 'ประวัติการดำเนินงาน'], ['acc', 'จัดการบัญชี']];

// ---------- Login / session ----------
$('#tp').onclick = () => { const p = $('#p'); p.type = p.type === 'password' ? 'text' : 'password'; $('#tp').textContent = p.type === 'password' ? 'แสดง' : 'ซ่อน'; };
$('#lf').onsubmit = async e => {
  e.preventDefault(); const b = $('#lb'); if (b.disabled) return; $('#le').textContent = '';
  if (!$('#u').value.trim() || !$('#p').value) { $('#le').textContent = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'; return; }
  b.disabled = true; b.classList.add('busy');
  try { const r = await api('login', { username: $('#u').value, password: $('#p').value }); sessionStorage.setItem('tk', r.token); idleMin = r.minutes; $('#p').value = ''; start(r.user); }
  catch (x) { $('#le').textContent = x.message; } finally { b.disabled = false; b.classList.remove('busy'); }
};
function start(u) {
  me = u; $('#loginView').hidden = true; $('#appView').hidden = false;
  $('#nav').innerHTML = `<div class="brand">🎓 ประชานิเวศน์</div>` + SECS.filter(s => s[0] !== 'acc' || me.role === 'superadmin').map(s => `<a data-s="${s[0]}">${s[1]}</a>`).join('') +
    `<span class="sp"></span><a data-s="pw">เปลี่ยนรหัสผ่าน</a><a data-s="out">ออกจากระบบ (${esc(me.u)})</a>`;
  go('ov'); ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, bump, { passive: true })); bump();
}
function bump() { clearTimeout(idleT); idleT = setTimeout(() => out('ไม่มีการใช้งานเป็นเวลานาน ระบบออกจากระบบอัตโนมัติ'), idleMin * 60000); }
async function out(msg) { try { if (sessionStorage.getItem('tk')) await api('logout', {}, true); } catch (e) { } sessionStorage.removeItem('tk'); me = null; $('#appView').hidden = true; $('#loginView').hidden = false; closeM(); if (msg) $('#le').textContent = msg; }
$('#nav').onclick = e => { const a = e.target.closest('a'); if (a) go(a.dataset.s); };
async function boot() { if (!sessionStorage.getItem('tk')) return; try { start((await api('me', {}, true)).user); } catch (e) { sessionStorage.removeItem('tk'); } }

// ---------- helpers ----------
const A = (a, d) => api(a, d, true);
function closeM() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
function openM(html) { const m = $('#modal'); m.innerHTML = `<div class="md" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; return m; }
function confirmM(title, msg, label = 'ยืนยัน') { return new Promise(res => { const m = openM(`<h3>${title}</h3><p>${msg}</p><div class="row"><button class="btn ghost" id="c0">ยกเลิก</button><button class="btn bad" id="c1">${label}</button></div>`); m.querySelector('#c0').onclick = () => { closeM(); res(false); }; m.querySelector('#c1').onclick = () => { closeM(); res(true); }; }); }
function skel() { main.innerHTML = '<div class="card skel" style="height:90px"></div><div class="card skel" style="height:240px"></div>'; }
function fail(x) { if (x.code === 'SESSION') return out(x.message); toast(x.message, 'err'); main.innerHTML = `<div class="card state bad"><b>เกิดข้อผิดพลาด</b><p>${esc(x.message)}</p></div>`; }
function go(s) {
  if (s === 'out') return out(); if (s === 'pw') return pwM();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.s === s)); skel();
  ({ ov, stu, val, sl, act, acc })[s]().catch(fail);
}
const head = (t, extra = '') => `<div class="top"><h1>${t}</h1><div>${extra}</div></div>`;
const table = (cols, rows) => rows.length ? `<div class="tw"><table class="rt"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td data-l="${cols[i]}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีข้อมูล</div>';

// ---------- Overview ----------
async function ov() {
  const d = await A('stats');
  if (!d.total) { main.innerHTML = head('ภาพรวม') + '<div class="card empty"><h3>ยังไม่มีข้อมูลนักเรียน</h3><p>นำเข้าข้อมูลจากไฟล์ Excel ลงในชีต Students ของ Google Sheets หรือเพิ่มข้อมูลที่เมนูจัดการข้อมูลนักเรียน</p></div>'; return; }
  const card = (n, t) => `<div class="card"><div class="n">${n.toLocaleString()}</div><div class="t">${t}</div></div>`;
  const mx = Math.max(...d.bins, 1), lb = ['< 1.00', '1.00–1.99', '2.00–2.49', '2.50–2.99', '3.00–3.49', '3.50–4.00'];
  const bar = (l, v, max, f) => `<div class="bar"><span class="l">${l}</span><span class="tr"><span class="fi" style="width:${max ? v / max * 100 : 0}%;display:block"></span></span><span class="v">${f}</span></div>`;
  main.innerHTML = head('ภาพรวม') + `<div class="stats">${card(d.total, 'นักเรียนทั้งหมด')}${card(d.complete, 'ข้อมูลสมบูรณ์')}${card(d.check, 'ข้อมูลที่ต้องตรวจสอบ')}${card(d.problem, 'รายการซ้ำ/มีปัญหา')}</div>
  <div class="two"><div class="card"><b>การกระจายตัวของ GPAX</b>${d.bins.map((v, i) => bar(lb[i], v, mx, v)).join('')}</div>
  <div class="card"><b>สถิติ GPAX</b>${d.gpax ? `<p>เฉลี่ย <b>${g2(d.gpax.avg)}</b> · ต่ำสุด <b>${g2(d.gpax.min)}</b> · สูงสุด <b>${g2(d.gpax.max)}</b></p>` : '<p class="empty">ไม่มีข้อมูล</p>'}
  <b>ค่าเฉลี่ยรายวิชา</b>${bar('คณิต', d.subj.math, 4, g2(d.subj.math))}${bar('วิทย์', d.subj.sci, 4, g2(d.subj.sci))}${bar('ภาษาต่างประเทศ', d.subj.lang, 4, g2(d.subj.lang))}</div>
  <div class="card"><b>นักเรียนที่เพิ่มล่าสุด</b>${table(['เลขประจำตัว', 'ชื่อ-สกุล', 'GPAX'], d.recent.map(r => [esc(r[0]), esc(r[1] + r[2] + ' ' + r[3]), g2(r[4])]))}</div>
  <div class="card"><b>ประวัติการทำงานล่าสุด</b>${table(['เวลา', 'ผู้ใช้', 'การกระทำ'], d.activity.map(r => [esc(r[0]), esc(r[1]), esc(r[2] + ' ' + r[3])]))}</div></div>`;
}

// ---------- Students ----------
const COLS = ['เลขประจำตัว', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'GPAX', 'เลขบัตรประชาชน', 'คณิต', 'วิทย์', 'ภาษาต่างประเทศ'];
let debounce;
async function stu() {
  main.innerHTML = head('จัดการข้อมูลนักเรียน', canEdit() ? '<button class="btn sm" id="add">+ เพิ่มนักเรียน</button>' : '') +
    `<div class="card"><div class="tools"><input id="q" placeholder="ค้นหาชื่อ-นามสกุล หรือเลขประจำตัว" value="${esc(st.q)}"><select id="so">${[[0, 'เลขประจำตัว'], [2, 'ชื่อ'], [3, 'นามสกุล'], [4, 'GPAX']].map(o => `<option value="${o[0]}" ${st.sort == o[0] ? 'selected' : ''}>เรียงตาม${o[1]}</option>`).join('')}</select><select id="sd"><option value="asc">น้อย→มาก</option><option value="desc" ${st.dir === 'desc' ? 'selected' : ''}>มาก→น้อย</option></select></div><div id="tb"></div></div>`;
  $('#q').oninput = e => { clearTimeout(debounce); debounce = setTimeout(() => { st.q = e.target.value; st.page = 1; load(); }, 350); };
  $('#so').onchange = e => { st.sort = e.target.value; load(); }; $('#sd').onchange = e => { st.dir = e.target.value; load(); };
  if ($('#add')) $('#add').onclick = () => form(null); load();
}
async function load() {
  const t = $('#tb'); t.innerHTML = '<div class="skel" style="height:200px;border-radius:14px"></div>';
  try {
    const d = await A('list', st), pages = Math.max(1, Math.ceil(d.total / st.size));
    t.innerHTML = (d.rows.length ? table(['เลขประจำตัว', 'ชื่อ-สกุล', 'GPAX', 'คณิต', 'วิทย์', 'ภาษาต่างประเทศ', 'จัดการ'], d.rows.map(r => [esc(r[0]), esc(r[1] + r[2] + ' ' + r[3]), g2(r[4]), g2(r[6]), g2(r[7]), g2(r[8]),
      `<div class="acts"><button class="btn ghost sm" data-a="v" data-i="${esc(r[0])}">ดู</button>${canEdit() ? `<button class="btn ghost sm" data-a="e" data-i="${esc(r[0])}">แก้ไข</button><button class="btn ghost sm" data-a="d" data-i="${esc(r[0])}">ลบ</button>` : ''}</div>`])) : '<div class="empty">ไม่พบรายการ</div>') +
      `<div class="pg"><span>ทั้งหมด ${d.total.toLocaleString()} รายการ</span><span><button class="btn ghost sm" id="pv" ${st.page <= 1 ? 'disabled' : ''}>ก่อนหน้า</button> หน้า ${st.page}/${pages} <button class="btn ghost sm" id="nx" ${st.page >= pages ? 'disabled' : ''}>ถัดไป</button></span></div>`;
    $('#pv').onclick = () => { st.page--; load(); }; $('#nx').onclick = () => { st.page++; load(); };
    t.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const r = d.rows.find(x => x[0] === b.dataset.i); ({ v: () => view(r), e: () => form(r), d: () => del(r) })[b.dataset.a](); };
  } catch (x) { fail(x); }
}
function view(r) { const m = openM(`<h3>รายละเอียดนักเรียน</h3><dl class="dl">${COLS.map((c, i) => `<dt>${c}</dt><dd>${esc(r[i])}</dd>`).join('')}</dl><div class="row"><button class="btn ghost" id="x">ปิด</button></div>`); m.querySelector('#x').onclick = closeM; }
function form(r) {
  const v = i => esc(r ? r[i] : ''), f = (i, t = 'text', ex = '') => `<div><label>${COLS[i]}</label><input name="f${i}" value="${v(i)}" ${ex}></div>`;
  const m = openM(`<h3>${r ? 'แก้ไข' : 'เพิ่ม'}ข้อมูลนักเรียน</h3><form class="fg" novalidate>${f(0)}<div class="fg2">${f(1)}${f(4, 'text', 'inputmode="decimal"')}</div><div class="fg2">${f(2)}${f(3)}</div>${f(5, 'text', 'inputmode="numeric" maxlength="13"')}<div class="fg2" style="grid-template-columns:repeat(3,1fr)">${f(6, 'text', 'inputmode="decimal"')}${f(7, 'text', 'inputmode="decimal"')}${f(8, 'text', 'inputmode="decimal"')}</div><div class="err" id="fe"></div><div class="row"><button type="button" class="btn ghost" id="x">ยกเลิก</button><button class="btn" id="sv">บันทึก</button></div></form>`);
  m.querySelector('#x').onclick = closeM;
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const g = i => m.querySelector(`[name=f${i}]`).value, d = { id: g(0), title: g(1), first: g(2), last: g(3), gpax: g(4), cid: g(5), math: g(6), sci: g(7), lang: g(8) }, b = m.querySelector('#sv');
    b.disabled = true; try { await A('save', { data: d, orig: r ? r[0] : null }); closeM(); toast('บันทึกข้อมูลเรียบร้อย'); load(); } catch (x) { if (x.code === 'SESSION') return out(x.message); m.querySelector('#fe').textContent = x.message; b.disabled = false; }
  };
}
async function del(r) { if (!await confirmM('ยืนยันการลบ', `ต้องการลบ <b>${esc(r[1] + r[2] + ' ' + r[3])}</b> (เลขประจำตัว ${esc(r[0])}) ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`, 'ลบข้อมูล')) return; try { await A('remove', { id: r[0] }); toast('ลบข้อมูลแล้ว'); load(); } catch (x) { if (x.code === 'SESSION') out(x.message); else toast(x.message, 'err'); } }

// ---------- Validate / logs / accounts ----------
async function val() {
  const d = await A('validate'), T = { dup: ['ซ้ำ', 'dup'], check: ['ต้องตรวจสอบ', 'check'] };
  main.innerHTML = head('ตรวจสอบข้อมูล') + `<div class="card"><p>ตรวจ ${d.total.toLocaleString()} รายการ — พบปัญหา <b>${d.issues.length}</b> รายการ</p>${d.issues.length ? table(['แถวในชีต', 'เลขประจำตัว', 'ชื่อ', 'ประเภท', 'รายละเอียด'], d.issues.map(x => [x.row, esc(x.id), esc(x.name), `<span class="tag ${T[x.type][1]}">${T[x.type][0]}</span>`, esc(x.msg)])) : '<div class="empty">✅ ไม่พบข้อมูลผิดปกติ</div>'}</div>`;
}
async function sl() {
  const d = await A('searchLogs');
  main.innerHTML = head('ประวัติการค้นหา') + `<div class="stats"><div class="card"><div class="n">${d.found}</div><div class="t">พบ (200 ครั้งล่าสุด)</div></div><div class="card"><div class="n">${d.missing}</div><div class="t">ไม่พบ</div></div></div><div class="card">${table(['วันที่-เวลา', 'ผลการค้นหา', 'ประเภท'], d.rows.map(r => [esc(r[0]), `<span class="tag ${r[1] === 'พบ' ? 'good' : 'warn'}">${esc(r[1])}</span>`, esc(r[2])]))}</div>`;
}
async function act() { const d = await A('activity'); main.innerHTML = head('ประวัติการดำเนินงาน') + `<div class="card">${table(['วันที่-เวลา', 'ผู้ใช้', 'การกระทำ', 'รายละเอียด'], d.rows.map(r => r.map(esc)))}</div>`; }
async function acc() {
  const d = await A('admins');
  main.innerHTML = head('จัดการบัญชี', '<button class="btn sm" id="na">+ เพิ่มบัญชี</button>') + `<div class="card">${table(['ชื่อผู้ใช้', 'ชื่อ', 'สิทธิ์', 'สถานะ', 'จัดการ'], d.map(a => [esc(a.username), esc(a.name), ROLE[a.role], `<span class="tag ${a.active ? 'good' : 'bad'}">${a.active ? 'ใช้งาน' : 'ปิดใช้งาน'}</span>`, `<button class="btn ghost sm" data-u="${esc(a.username)}">แก้ไข</button>`]))}</div>`;
  $('#na').onclick = () => accForm(null); main.onclick = e => { const b = e.target.closest('[data-u]'); if (b) accForm(d.find(x => x.username === b.dataset.u)); };
}
function accForm(a) {
  const m = openM(`<h3>${a ? 'แก้ไข' : 'เพิ่ม'}บัญชีผู้ดูแล</h3><form class="fg" novalidate><div><label>ชื่อผู้ใช้</label><input name="u" value="${esc(a?.username)}" ${a ? 'readonly' : ''}></div><div><label>ชื่อที่แสดง</label><input name="n" value="${esc(a?.name)}"></div>
  <div><label>สิทธิ์</label><select name="r">${Object.keys(ROLE).map(k => `<option value="${k}" ${a?.role === k ? 'selected' : ''}>${ROLE[k]}</option>`).join('')}</select></div>
  ${a ? `<div><label>สถานะ</label><select name="a"><option value="1">ใช้งาน</option><option value="0" ${a.active ? '' : 'selected'}>ปิดใช้งาน</option></select></div>` : ''}
  <div><label>${a ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน (อย่างน้อย 8 ตัว)'}</label><input name="p" type="password" autocomplete="new-password"></div><div class="err" id="fe"></div><div class="row"><button type="button" class="btn ghost" id="x">ยกเลิก</button><button class="btn">บันทึก</button></div></form>`);
  m.querySelector('#x').onclick = closeM;
  m.querySelector('form').onsubmit = async e => { e.preventDefault(); const g = n => m.querySelector(`[name=${n}]`)?.value;
    try { await A('saveAdmin', { data: { username: g('u'), name: g('n'), role: g('r'), active: g('a') !== '0', password: g('p') } }); closeM(); toast('บันทึกบัญชีแล้ว'); acc(); } catch (x) { if (x.code === 'SESSION') return out(x.message); m.querySelector('#fe').textContent = x.message; } };
}
function pwM() {
  const m = openM(`<h3>เปลี่ยนรหัสผ่าน</h3><form class="fg" novalidate><div><label>รหัสผ่านเดิม</label><input name="o" type="password" autocomplete="current-password"></div><div><label>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label><input name="n" type="password" autocomplete="new-password"></div><div class="err" id="fe"></div><div class="row"><button type="button" class="btn ghost" id="x">ยกเลิก</button><button class="btn">เปลี่ยนรหัสผ่าน</button></div></form>`);
  m.querySelector('#x').onclick = closeM;
  m.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await A('changePw', { oldPassword: m.querySelector('[name=o]').value, newPassword: m.querySelector('[name=n]').value }); closeM(); toast('เปลี่ยนรหัสผ่านแล้ว'); } catch (x) { if (x.code === 'SESSION') return out(x.message); m.querySelector('#fe').textContent = x.message; } };
}
boot();
