// ตัวกลาง Browser -> Google Apps Script : เก็บ GAS_URL และ API_SECRET ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น
const crypto = require('crypto');
const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'METHOD', message: 'Method not allowed' });
  const { GAS_URL, API_SECRET } = process.env;
  if (!GAS_URL || !API_SECRET) return json(503, { ok: false, error: 'NOT_CONFIGURED', message: 'ระบบยังไม่ได้ตั้งค่า Backend (GAS_URL / API_SECRET) กรุณาติดต่อผู้ดูแลระบบ' });
  if ((event.body || '').length > 5000) return json(413, { ok: false, error: 'TOO_LARGE', message: 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'BAD_JSON', message: 'คำขอไม่ถูกต้อง' }); }
  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown';
  body.ip = crypto.createHash('sha256').update(ip + API_SECRET).digest('hex').slice(0, 24);
  body.secret = API_SECRET;
  try {
    const r = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    return json(200, await r.json());
  } catch (e) { return json(502, { ok: false, error: 'UPSTREAM', message: 'ไม่สามารถเชื่อมต่อ Backend ได้ กรุณาลองใหม่ภายหลัง' }); }
};
