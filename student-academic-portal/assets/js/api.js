async function api(action, data = {}, auth = false) {
  const body = { action, ...data };
  if (auth) body.token = sessionStorage.getItem('tk');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch('/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.message || 'เกิดข้อผิดพลาด'); e.code = j.error; throw e; }
    return j.data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('หมดเวลารอการตอบกลับ กรุณาลองใหม่');
    if (e instanceof SyntaxError || e instanceof TypeError) throw new Error('ไม่สามารถเชื่อมต่อระบบได้ กรุณาตรวจสอบอินเทอร์เน็ตหรือการตั้งค่า Backend');
    throw e;
  } finally { clearTimeout(t); }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const g2 = v => (v === '' || v == null || isNaN(Number(v))) ? '-' : Number(v).toFixed(2);
function toast(msg, type = 'ok') {
  let w = document.getElementById('toasts'); if (!w) { w = document.createElement('div'); w.id = 'toasts'; document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; w.appendChild(t); setTimeout(() => t.remove(), 4200);
}
