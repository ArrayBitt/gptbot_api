# gptbot-api

API กลางสำหรับบอท **Jobbie** (VR JobPro / Thitaram Group) บน GPTBots.ai — อ่านตำแหน่งงานขับรถจาก Google Sheets แล้วคืนข้อความพร้อมส่งให้บอท

> Production: `https://gptbot-api-v2.vercel.app` (Vercel project `gptbot-api-v2`, region `sin1`)

## ภาพรวมการทำงาน

```
ผู้สมัคร → GPTBots (Jobbie + prompt) → tool เรียก API นี้ → Google Sheets
                                         ↑ ข้อมูลตำแหน่งมาจากชีตเท่านั้น (แอดมินแก้ชีต บอทเปลี่ยนตาม)
```

หลักการสำคัญ: **ถ้า API ไม่มีข้อมูล บอทต้องไม่ตอบเอง** — API คืน `no_data: true` + `reply_fallback`
(ข้อความชวนกรอกใบสมัคร) ให้บอทส่งต่อตามตัวอักษร แล้วแอดมินติดตามหลังบ้าน

## Endpoints (`app/api/v2/jobs/`)

| Path | Query | คืนอะไร |
|---|---|---|
| `GET /api/v2/jobs/list` | `light=1` (ไม่ดึง location/กลุ่ม — เร็วกว่า) | รายการตำแหน่ง, โซน, `reply_zones`, `reply_jobs` |
| `GET /api/v2/jobs/search` | `q` (คำค้นสั้น ๆ) | ตำแหน่งที่ตรง, `reply` |
| `GET /api/v2/jobs/detail` | `position_name`, `company`, `field` (ไม่บังคับ) | `reply`, `reply_full`, `reply_salary`, `field_values` |

ทุก endpoint เมื่อไม่มีข้อมูลจะคืนเพิ่ม: `no_data`, `fallback_reason`, `reply_fallback`
(`search_empty` / `list_empty` / `job_not_found` / `field_missing`) — ข้อความอยู่ที่ `src/lib/v2/fallbackReply.ts` ที่เดียว

## โครงสร้างโปรเจกต์

```
app/api/v2/jobs/{list,search,detail}/route.ts   route บาง ๆ: รับ query → เรียก lib → ประกอบ JSON
src/lib/v2/
  constants.ts            ID ของสเปรดชีต Control Center, CORS
  createSheetsClient.ts   Google Sheets client (read-only, ใช้ร่วมทุก route)
  getOpenPositionRows.ts  อ่านแท็บ Global_Open_Position (เฉพาะสถานะ "เปิด")
  getCompanySheetMap.ts   แมปบริษัท → สเปรดชีตของบริษัท (แท็บ Company_Config)
  getJobListLight.ts      รายการตำแหน่ง + location/กลุ่ม
  getJobDetail.ts         จับคู่ชื่อตำแหน่ง + อ่านแท็บรายละเอียด (cache 60 วินาที)
  searchJobs.ts           ค้นหา + synonym + กรองสัญชาตินาย
  format*.ts              ประกอบข้อความตอบ (reply / reply_full / ...)
  fallbackReply.ts        ข้อความเมื่อไม่มีข้อมูล + ลิงก์ใบสมัคร
docs/jobbie-system-prompt.md   สำเนา prompt ของบอท (ตัวจริงรันอยู่ใน GPTBots.ai)
functions/gptbot/              โค้ด Firebase Functions เวอร์ชันเก่า (ไม่ใช่เส้นทางที่ GPTBots เรียกอยู่ตอนนี้)
```

## ตั้งค่าและรันในเครื่อง

1. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้ง credential ของ Google service account อย่างใดอย่างหนึ่ง:
   `GOOGLE_SERVICE_ACCOUNT` (JSON), `GOOGLE_SERVICE_ACCOUNT_B64` หรือ `GOOGLE_SERVICE_ACCOUNT_PATH`
2. service account ต้องมีสิทธิ์อ่านสเปรดชีตของ Control Center และของแต่ละบริษัท
3. `npm install` แล้ว `npm run dev` (หรือ `npm run dev:v2` พอร์ต 3001 + `npm run ngrok:v2`)
4. ตรวจ: `npx tsc --noEmit`, `npm run lint` และ `npm test` (Vitest — ครอบคลุมการจับคู่ชื่อตำแหน่ง, การค้นหา, fallback)

ทดสอบเร็ว ๆ:
```
curl -G "localhost:3000/api/v2/jobs/search" --data-urlencode "q=ส่วนกลาง"       # ควรมีข้อมูล
curl -G "localhost:3000/api/v2/jobs/search" --data-urlencode "q=ขับรถบรรทุก"     # ควรได้ no_data: true
```

## Deploy / Rollback (Vercel)

- Deploy: `vercel deploy --prod --yes`
- ย้อนกลับ: `vercel rollback <deployment-url>` (ดูรายการด้วย `vercel ls`)
- **หลัง deploy ที่เปลี่ยนรูปแบบ response ต้องทดสอบ tool ใน GPTBots ด้วย** (ดู "ข้อควรระวัง")

## ข้อควรระวัง

- **Prompt อยู่นอก repo:** แก้ API แล้วต้องดูว่า prompt ใน GPTBots ยังตรงกันหรือไม่ และอัปเดต `docs/jobbie-system-prompt.md` ตาม
- **Output Parameters ของ tool ใน GPTBots** ต้องประกาศ field ที่ API ส่ง (`reply`, `no_data`, `fallback_reason`, `reply_fallback` ฯลฯ) ไม่เช่นนั้นโมเดลจะมองไม่เห็น
- **โครงสร้างชีตคือสัญญา:** ชื่อแท็บ/คอลัมน์ (`Global_Open_Position!A2:D200`, `Company_Config`) ถูกฮาร์ดโค้ด ถ้าแอดมินเปลี่ยนโครงสร้าง API จะคืนผลว่าง
- **API ยังเปิดสาธารณะ ไม่มี auth** และ CORS เป็น `*`
- **test ครอบคลุมเฉพาะตรรกะหลัก** (`src/lib/v2/__tests__/`: จับคู่ชื่อ, ค้นหา, fallback) ยังไม่มี test ของ route/การจัดรูปแบบ `format*.ts` และไม่ได้ต่อชีตจริง — หลังแก้ต้องทดสอบด้วย `curl` ด้วย
- ข้อมูลตำแหน่งที่ cache (detail 60 วินาที) อาจเก่าได้ชั่วครู่หลังแอดมินแก้ชีต

ข้อมูลภายใน (ชีต, credential, ข้อมูลผู้สมัคร) เป็นความลับ ห้าม commit ลง git
