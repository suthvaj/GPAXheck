# ระบบตรวจสอบคุณสมบัติ ม.4 ปีการศึกษา 2570 — โรงเรียนมัธยมประชานิเวศน์

โครงสร้าง: `index.html`/`admin.html` (Frontend) → `/api` (Netlify Function ตัวกลาง) → Google Apps Script → Google Sheets
Frontend ไม่เคยเห็น Sheet, Secret หรือรหัสผ่าน และไม่เคยได้รับข้อมูลนักเรียนทั้งหมด

## 1) Google Sheets + Apps Script
1. สร้าง Google Sheets ใหม่ (ห้ามแชร์เป็นสาธารณะ) → **ส่วนขยาย › Apps Script**
2. วางโค้ดจาก `gas/Code.gs` ลงใน Editor
3. **Project Settings › Script Properties** เพิ่ม: `API_SECRET` (สุ่มข้อความยาว ≥ 32 ตัว), `ADMIN_USER` (เช่น `admin`), `ADMIN_PASS` (≥ 8 ตัว)
4. เลือกฟังก์ชัน `setup` กด **Run** อนุญาตสิทธิ์ → ระบบสร้างชีต Students, Admins, SearchLogs, ActivityLogs, ImportLogs, Settings และบัญชีแรก (แล้วลบ `ADMIN_PASS` ออกจาก Properties อัตโนมัติ)
5. นำเข้าข้อมูล: เปิดไฟล์ Excel คัดลอกแถวข้อมูล (ไม่รวมหัวตาราง) วางที่ชีต `Students` เซลล์ A2 — คอลัมน์ A และ F ถูกตั้งเป็นข้อความไว้แล้วเพื่อรักษาเลข 0 นำหน้า (ควรวางด้วย Ctrl+Shift+V แบบ "ค่าเท่านั้น")
6. **Deploy › New deployment › Web app**: Execute as = *Me*, Who has access = *Anyone* → คัดลอก Web app URL (`.../exec`)
   (ความปลอดภัยอยู่ที่ `API_SECRET` ซึ่งมีเฉพาะ Netlify Function; ถ้าไม่ตรงจะปฏิเสธทุกคำขอ)

## 2) Netlify
1. อัปโหลดโปรเจกต์ขึ้น GitHub แล้วเชื่อม Netlify (Build command ว่าง, Publish directory `.`)
2. **Site settings › Environment variables**: `GAS_URL` = Web app URL, `API_SECRET` = ค่าเดียวกับในข้อ 1.3
3. Deploy ใหม่ และใส่ตราโรงเรียนที่ `assets/images/logo.png`

## 3) ทดสอบ
- เปิด `/` ใส่เลขบัตรของนักเรียนทดสอบ → ต้องเห็นเฉพาะข้อมูลคนนั้น เลขบัตรถูกปกปิด
- ใส่เลขที่ไม่มี → ข้อความ "ไม่พบข้อมูลในระบบ…"; ค้นหาเกิน 10 ครั้ง/10 นาที (ปรับที่ชีต Settings: `SEARCH_LIMIT`) → ถูกจำกัด
- เปิด `/admin.html` เข้าสู่ระบบ → ตรวจ ภาพรวม, เพิ่ม/แก้ไข/ลบ, ตรวจสอบข้อมูล, บันทึกการค้นหา (ต้องไม่มีเลขบัตร)
- ปิดเว็บ Backend (ลบ `GAS_URL`) → ต้องแสดงข้อความแจ้งว่ายังไม่ได้ตั้งค่า ไม่มีข้อมูลสมมติ

## คู่มือผู้ดูแล
- สิทธิ์: `superadmin` (ทุกอย่างรวมบัญชี), `editor` (แก้ไขนักเรียน), `viewer` (ดูอย่างเดียว)
- หมดเวลาเซสชันและจำนวนค้นหาปรับได้ที่ชีต `Settings` (`SESSION_MIN`, `SEARCH_LIMIT`)
- ล็อกอินผิด 5 ครั้งล็อก 15 นาที; การปิดบัญชีมีผลกับการเข้าสู่ระบบครั้งถัดไป (เซสชันเดิมหมดตามเวลา)
- ถ้าแก้โค้ด GAS ต้อง **Deploy › Manage deployments › New version** ทุกครั้ง
- แก้ข้อมูลตรงในชีตได้ แต่ห้ามเปลี่ยนชื่อหัวคอลัมน์ ใช้เมนู "ตรวจสอบข้อมูล" เพื่อตรวจหลังนำเข้า
