import type { JobDetail } from "./getJobDetail"

const DETAIL_FIELD_ORDER = [
  "สถานที่ทำงาน",
  "วันและเวลาทำงาน",
  "ลักษณะงาน",
  "อายุ",
  "ประสบการณ์ในการทำงาน",
  "คุณสมบัติ",
  "สวัสดิการ",
  "รถที่ใช้",
  "เอกสารที่ต้องใช้",
]

const SALARY_FIELDS = [
  "ช่วงเงินเดือน (Min – Max)",
  "เงินเดือน",
  "ค่าจ้าง",
  "OT",
  "ค่าวิ่ง",
]

function orderedDetailBullets(
  detail: Record<string, string>,
  includeSalary: boolean
): string[] {
  const used = new Set<string>()
  const bullets: string[] = []

  const add = (key: string) => {
    const value = detail[key]?.trim()
    if (!value || used.has(key)) return
    used.add(key)
    bullets.push(`- ${key}: ${value}`)
  }

  for (const key of DETAIL_FIELD_ORDER) add(key)

  if (includeSalary) {
    for (const key of SALARY_FIELDS) add(key)
  }

  for (const [key, value] of Object.entries(detail)) {
    if (used.has(key) || !value?.trim()) continue
    if (!includeSalary && SALARY_FIELDS.includes(key)) continue
    used.add(key)
    bullets.push(`- ${key}: ${value.trim()}`)
  }

  return bullets
}

function buildDetailReply(positionName: string, bullets: string[]) {
  return [
    `รายละเอียดตำแหน่ง ${positionName} มีดังนี้ค่ะ`,
    "",
    ...bullets,
  ].join("\n")
}

export function formatJobDetailResult(data: JobDetail): string {
  const { position_name, company, detail } = data
  const bullets = orderedDetailBullets(detail, false)
  const bulletsWithSalary = orderedDetailBullets(detail, true)
  const reply = buildDetailReply(position_name, bullets)
  const replyWithSalary = buildDetailReply(position_name, bulletsWithSalary)

  return [
    "COPY_THIS_REPLY (send to user as-is):",
    reply,
    "",
    `position_name=${position_name}`,
    `company=${company}`,
    "",
    "REPLY_DETAIL_WITH_SALARY (only when user asks เงิน/OT):",
    replyWithSalary,
  ].join("\n")
}

export function formatJobDetailReply(data: JobDetail): string {
  const bullets = orderedDetailBullets(data.detail, false)
  return buildDetailReply(data.position_name, bullets)
}
