import type { JobDetail } from "./getJobDetail"

// Tier 1 — shown immediately when user first asks for job detail.
// Keep in sync with the system prompt's "JOB DETAIL DISPLAY — SUMMARY FIRST" section.
const SUMMARY_FIELD_ORDER = [
  "สถานที่ทำงาน",
  "วันและเวลาทำงาน",
  "อายุ",
  "ประเภทการจ้างงาน",
  "ระยะเวลาสัญญา",
]

const MAIN_DUTY_KEYS = [
  "หน้าที่และความรับผิดชอบหลัก (ระบุเป็นข้อๆ)",
  "หน้าที่และความรับผิดชอบหลัก",
  "ลักษณะงาน",
]

// Tier 2 — only shown after user asks for "เพิ่มเติม" (WANTS MORE).
// Order mirrors the prompt's "คุณสมบัติและรายละเอียดเพิ่มเติม" list.
const FULL_FIELD_ORDER = [
  "วุฒิการศึกษาขั้นต่ำ",
  "ประสบการณ์ขั้นต่ำ (จำนวนปี)",
  "ประสบการณ์ในการทำงาน",
  "ประสบการณ์เฉพาะด้านที่จำเป็น",
  "คุณสมบัติ",
  "คุณสมบัติเพิ่มเติมที่ต้องการ",
  "ทักษะด้านเทคนิค / Hard Skills",
  "Soft Skills ที่จำเป็นสำหรับตำแหน่งนี้",
  "ขอบเขตการตัดสินใจของตำแหน่งนี้",
  "ปัญหาหรือความท้าทายหลัก",
  "สวัสดิการ",
  "สวัสดิการตัวเงิน",
  "สิทธิประโยชน์ที่ไม่ใช่ตัวเงิน",
  "นายจ้าง / รูปแบบการจ้าง",
  "รถที่ใช้",
  "เอกสารที่ต้องใช้",
]

const SALARY_FIELDS = [
  "ช่วงเงินเดือน (Min – Max)",
  "เงินเดือน",
  "ค่าจ้าง",
  "OT",
  "ค่าวิ่ง",
  "ค่าเบี้ย",
]

function firstLines(value: string, maxLines: number) {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n")
}

function pick(detail: Record<string, string>, keys: string[]) {
  const used = new Set<string>()
  const bullets: string[] = []
  for (const key of keys) {
    const value = detail[key]?.trim()
    if (!value || used.has(key)) continue
    used.add(key)
    bullets.push(`- ${key}: ${value}`)
  }
  return bullets
}

/** Tier 1 — summary bullets only (no salary, no unlisted extra fields). */
function summaryBullets(detail: Record<string, string>): string[] {
  const bullets = pick(detail, SUMMARY_FIELD_ORDER)

  const dutyKey = MAIN_DUTY_KEYS.find((k) => detail[k]?.trim())
  if (dutyKey) {
    bullets.push(`- หน้าที่หลัก: ${firstLines(detail[dutyKey], 2)}`)
  }

  return bullets
}

/**
 * Tier 2 — every remaining field NOT already shown in the summary tier
 * and not salary. Any field not explicitly known still falls in here
 * (never in the summary), so nothing new ever leaks into tier 1.
 */
function fullBullets(detail: Record<string, string>): string[] {
  const shownInSummary = new Set([
    ...SUMMARY_FIELD_ORDER,
    ...MAIN_DUTY_KEYS,
  ])

  const bullets = pick(detail, FULL_FIELD_ORDER)
  const used = new Set(FULL_FIELD_ORDER)

  for (const [key, value] of Object.entries(detail)) {
    if (used.has(key) || shownInSummary.has(key) || SALARY_FIELDS.includes(key)) continue
    if (!value?.trim()) continue
    used.add(key)
    bullets.push(`- ${key}: ${value.trim()}`)
  }

  return bullets
}

function salaryBullets(detail: Record<string, string>): string[] {
  return pick(detail, SALARY_FIELDS)
}

function buildSummaryReply(positionName: string, bullets: string[]) {
  return [
    `รายละเอียดตำแหน่ง ${positionName} ค่ะ`,
    ...bullets,
    "",
    "ต้องการดูรายละเอียดเพิ่มเติม (คุณสมบัติ, สวัสดิการ ฯลฯ) ไหมคะ? หรือสนใจสมัครเลยคะ?",
  ].join("\n")
}

function buildFullReply(bullets: string[]) {
  return [
    "คุณสมบัติและรายละเอียดเพิ่มเติมค่ะ",
    "",
    ...bullets,
    "",
    "หากสนใจตำแหน่งงานนี้ไหมคะ",
    'หากสนใจ พิมพ์ว่า "สนใจ" ได้เลยนะคะ',
  ].join("\n")
}

function buildSalaryReply(positionName: string, bullets: string[]) {
  if (bullets.length === 0) return ""
  return [`เงินเดือน/ค่าตอบแทนของตำแหน่ง ${positionName} ค่ะ`, ...bullets].join(
    "\n"
  )
}

export function formatJobDetailResult(data: JobDetail): string {
  const { position_name, company, detail } = data
  const summary = summaryBullets(detail)
  const full = fullBullets(detail)
  const salary = salaryBullets(detail)

  return [
    "COPY_THIS_REPLY_SUMMARY (first time user asks for detail — send as-is):",
    buildSummaryReply(position_name, summary),
    "",
    "COPY_THIS_REPLY_FULL (only when user asks for เพิ่มเติม/ทั้งหมด — send as-is):",
    buildFullReply(full),
    "",
    "REPLY_SALARY (only when user asks เงินเดือน/OT/ค่าจ้าง):",
    buildSalaryReply(position_name, salary) || "(ไม่มีข้อมูลเงินเดือนในระบบ)",
    "",
    `position_name=${position_name}`,
    `company=${company}`,
  ].join("\n")
}

/** Tier-1 reply only — used as the `reply` field for the first detail view. */
export function formatJobDetailReply(data: JobDetail): string {
  return buildSummaryReply(data.position_name, summaryBullets(data.detail))
}

/** Tier-2 reply only — used when the user asks for "เพิ่มเติม". */
export function formatJobDetailFullReply(data: JobDetail): string {
  return buildFullReply(fullBullets(data.detail))
}

/** Salary-only reply — used when the user specifically asks about pay. */
export function formatJobDetailSalaryReply(data: JobDetail): string {
  return buildSalaryReply(data.position_name, salaryBullets(data.detail))
}
