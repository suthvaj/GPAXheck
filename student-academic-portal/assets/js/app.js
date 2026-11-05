const form = document.getElementById('f'), inp = document.getElementById('cid'), btn = document.getElementById('go'), err = document.getElementById('err'), res = document.getElementById('result'), box = document.getElementById('searchBox');
let idle;
inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 13); err.textContent = ''; });
form.addEventListener('submit', async e => {
  e.preventDefault(); if (btn.disabled) return;
  if (!/^\d{13}$/.test(inp.value)) { err.textContent = 'กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก (เฉพาะตัวเลข)'; return; }
  btn.disabled = true; btn.classList.add('busy'); btn.querySelector('span').textContent = 'กำลังตรวจสอบ...';
  res.innerHTML = '<div class="card skel" style="height:130px"></div><div class="grid3"><div class="card skel" style="height:100px"></div><div class="card skel" style="height:100px"></div><div class="card skel" style="height:100px"></div></div>';
  try { show(await api('search', { cid: inp.value })); }
  catch (x) { res.innerHTML = `<div class="card state ${x.code === 'NOT_FOUND' ? 'warn' : 'bad'}"><b>${x.code === 'NOT_FOUND' ? 'ไม่พบข้อมูล' : 'ไม่สามารถตรวจสอบได้'}</b><p>${esc(x.message)}</p></div>`; }
  finally { btn.disabled = false; btn.classList.remove('busy'); btn.querySelector('span').textContent = 'ตรวจสอบข้อมูล'; }
});
function show(d) {
  box.hidden = true; inp.value = '';
  const sub = (n, v, ic) => `<div class="card sub"><div class="ic">${ic}</div><div class="lbl">${n}</div><div class="val">${g2(v)}</div></div>`;
  res.innerHTML = `
  <div class="card prof"><div class="avatar">${esc(d.first.charAt(0))}</div><div>
    <h2>${esc(d.title)}${esc(d.first)} ${esc(d.last)}</h2>
    <p>เลขประจำตัวนักเรียน: <b>${esc(d.id)}</b></p><p>เลขบัตรประชาชน: <b class="mono">${esc(d.cid)}</b></p></div></div>
  <div class="card gpax"><div class="lbl">GPAX เฉลี่ยสะสม 5 ภาคเรียน</div><div class="big">${g2(d.gpax)}</div></div>
  <div class="grid3">${sub('คณิตศาสตร์', d.math, '∑')}${sub('วิทยาศาสตร์', d.sci, '⚛')}${sub('ภาษาต่างประเทศ', d.lang, 'A')}</div>
  <div class="card note"><b>ข้อมูลเพิ่มเติม</b><p>GPAX ที่แสดงเป็นผลการเรียนเฉลี่ยสะสม 5 ภาคเรียน และข้อมูลเป็นไปตามฐานข้อมูลที่โรงเรียนจัดเตรียมไว้ หากพบข้อมูลคลาดเคลื่อน กรุณาติดต่อโรงเรียน</p></div>
  <button class="btn ghost" id="again">ตรวจสอบรายการอื่น / ล้างหน้าจอ</button>`;
  document.getElementById('again').onclick = reset; res.scrollIntoView({ behavior: 'smooth' });
  clearTimeout(idle); idle = setTimeout(reset, 180000);
}
function reset() { clearTimeout(idle); res.innerHTML = ''; box.hidden = false; inp.value = ''; inp.focus(); }
