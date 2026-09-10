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
  "Incentive / Bonus / Commission",
]

/** Internal / admin sheet fields — never show to candidates. */
const HIDDEN_FIELDS = [
  "กลุ่มตำแหน่งงาน",
  "ประเภทการสรรหา",
  "ชื่อตำแหน่งงาน",
  "แผนก / สายงานที่เกี่ยวข้อง",
  "แผนก",
  "ชื่อบริษัท",
  "ชื่อย่อบริษัท",
  "ประเภทธุรกิจของหน่วยงาน",
  "โซน / พื้นที่ที่เปิดรับ",
  "จำนวนที่เปิดรับ",
  "ระดับอาวุโสของตำแหน่ง",
  "รูปแบบการทำงาน",
]

function isEmptyValue(value: string | undefined | null): boolean {
  if (!value) return true
  const v = value.normalize("NFKC").trim()
  if (!v) return true
  if (/^[-–—•·.]+$/.test(v)) return true
  if (/^(n\/?a|none|null|ไม่มี|-)$/i.test(v)) return true
  return false
}

/** Strip leading bullet markers so we don't get "- label: - value". */
function cleanLine(line: string): string {
  return line
    .normalize("NFKC")
    .replace(/^[\s]*[-–—•·*]+\s*/, "")
    .trim()
}

function cleanValue(value: string): string {
  return value
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .join("\n")
}

function firstLines(value: string, maxLines: number) {
  return cleanValue(value)
    .split("\n")
    .filter(Boolean)
    .slice(0, maxLines)
    .join("\n")
}

/**
 * Match sheet headers that carry trailing notes, e.g.
 * "ระยะเวลาสัญญา" vs "ระยะเวลาสัญญา (ถ้ามี)".
 */
function findDetailKey(detail: Record<string, string>, wanted: string): string | null {
  const w = wanted.normalize("NFKC").trim()
  if (detail[wanted] !== undefined && !isEmptyValue(detail[wanted])) return wanted
  if (detail[w] !== undefined && !isEmptyValue(detail[w])) return w

  for (const k of Object.keys(detail)) {
    if (isEmptyValue(detail[k])) continue
    const nk = k.normalize("NFKC").trim()
    if (nk === w || nk.startsWith(w)) return k
  }
  return null
}

function isHiddenField(key: string): boolean {
  const k = key.normalize("NFKC").trim()
  return HIDDEN_FIELDS.some(
    (h) => k === h || k.startsWith(h.normalize("NFKC").trim())
  )
}

function isSalaryField(key: string): boolean {
  const k = key.normalize("NFKC").trim()
  return SALARY_FIELDS.some(
    (s) => k === s || k.startsWith(s.normalize("NFKC").trim())
  )
}

/**
 * Format one field as chat-safe bullets.
 * Multiline values become indented sub-bullets under the label.
 */
function formatFieldBullet(label: string, raw: string): string | null {
  if (isEmptyValue(raw)) return null
  const cleaned = cleanValue(raw)
  if (isEmptyValue(cleaned)) return null

  const lines = cleaned.split("\n").filter(Boolean)
  if (lines.length === 1) {
    return `- ${label}: ${lines[0]}`
  }
  return [`- ${label}:`, ...lines.map((l) => `  • ${l}`)].join("\n")
}

function pick(detail: Record<string, string>, keys: string[]) {
  const matchedKeys = new Set<string>()
  const bullets: string[] = []
  for (const key of keys) {
    const actualKey = findDetailKey(detail, key)
    if (!actualKey || matchedKeys.has(actualKey)) continue
    matchedKeys.add(actualKey)
    const bullet = formatFieldBullet(key, detail[actualKey])
    if (bullet) bullets.push(bullet)
  }
  return { bullets, matchedKeys }
}

/** Tier 1 — summary bullets only (no salary, no unlisted extra fields). */
function summaryBullets(detail: Record<string, string>): string[] {
  const { bullets } = pick(detail, SUMMARY_FIELD_ORDER)

  const dutyKey = MAIN_DUTY_KEYS.find((k) => !isEmptyValue(detail[k]))
  if (dutyKey) {
    const duty = formatFieldBullet("หน้าที่หลัก", firstLines(detail[dutyKey], 2))
    if (duty) bullets.push(duty)
  }

  return bullets
}

/**
 * Tier 2 — candidate-facing remaining fields only.
 * Admin meta + salary stay out of this reply.
 * Returns both labeled (B:C for bot) and value-only (C for user reply).
 */
function collectFullFields(detail: Record<string, string>): {
  labeled: string[]
  valuesOnly: string[]
} {
  const { matchedKeys: usedBySummary } = pick(detail, SUMMARY_FIELD_ORDER)
  const summaryDutyKey = MAIN_DUTY_KEYS.find((k) => !isEmptyValue(detail[k]))
  const { matchedKeys: usedBySalary } = pick(detail, SALARY_FIELDS)

  const labeled: string[] = []
  const valuesOnly: string[] = []
  const used = new Set<string>()

  const add = (label: string, raw: string) => {
    const labeledBullet = formatFieldBullet(label, raw)
    const valueBlock = formatValueOnly(raw)
    if (!labeledBullet || !valueBlock) return
    labeled.push(labeledBullet)
    valuesOnly.push(valueBlock)
  }

  for (const key of FULL_FIELD_ORDER) {
    const actualKey = findDetailKey(detail, key)
    if (!actualKey || used.has(actualKey)) continue
    used.add(actualKey)
    add(key, detail[actualKey])
  }

  for (const [key, value] of Object.entries(detail)) {
    if (used.has(key)) continue
    if (usedBySummary.has(key)) continue
    if (summaryDutyKey && key === summaryDutyKey) continue
    if (usedBySalary.has(key)) continue
    if (isSalaryField(key)) continue
    if (isHiddenField(key)) continue
    if (MAIN_DUTY_KEYS.some((k) => key.startsWith(k) || k.startsWith(key))) continue
    if (isEmptyValue(value)) continue
    used.add(key)
    add(key, value)
  }

  return { labeled, valuesOnly }
}

/** Column C only — no B label. Multiline → bullet lines. */
function formatValueOnly(raw: string): string | null {
  if (isEmptyValue(raw)) return null
  const cleaned = cleanValue(raw)
  if (isEmptyValue(cleaned)) return null
  const lines = cleaned.split("\n").filter(Boolean)
  if (lines.length === 1) return `• ${lines[0]}`
  return lines.map((l) => `• ${l}`).join("\n")
}

function fullBullets(detail: Record<string, string>): string[] {
  return collectFullFields(detail).labeled
}

function fullValueBlocks(detail: Record<string, string>): string[] {
  return collectFullFields(detail).valuesOnly
}

function salaryBullets(detail: Record<string, string>): string[] {
  const { bullets, matchedKeys } = pick(detail, SALARY_FIELDS)

  // Catch leftover pay-related sheet headers not in the fixed list.
  for (const [key, value] of Object.entries(detail)) {
    if (matchedKeys.has(key)) continue
    if (!isSalaryField(key)) continue
    if (isEmptyValue(value)) continue
    const bullet = formatFieldBullet(key, value)
    if (bullet) bullets.push(bullet)
  }

  return bullets
}

function buildSummaryReply(positionName: string, bullets: string[]) {
  return [
    `รายละเอียดตำแหน่ง ${positionName} ค่ะ`,
    ...bullets,
    "",
    "ต้องการดูรายละเอียดเพิ่มเติม (คุณสมบัติ, สวัสดิการ ฯลฯ) ไหมคะ? หรือสนใจสมัครเลยคะ?",
  ].join("\n")
}

function buildFullReply(blocks: string[]) {
  return [
    "คุณสมบัติและรายละเอียดเพิ่มเติมค่ะ",
    "",
    ...blocks,
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
  const fullValues = fullValueBlocks(detail)
  const fullLabeled = fullBullets(detail)
  const salary = salaryBullets(detail)
  const values = buildFieldValues(data)
  const valueLines = Object.entries(values).map(
    ([k, v]) => `${k} >>> ${v.replace(/\n/g, " | ")}`
  )

  return [
    "COPY_THIS_REPLY_SUMMARY (first time user asks for detail — send as-is):",
    buildSummaryReply(position_name, summary),
    "",
    "COPY_THIS_REPLY_FULL (เพิ่มเติม — VALUE/C only, send as-is to user):",
    buildFullReply(fullValues),
    "",
    "REPLY_FULL_LABELED (B:C for bot understanding only — DO NOT send to user):",
    buildFullReply(fullLabeled),
    "",
    "REPLY_SALARY (only when user asks เงินเดือน/OT/ค่าจ้าง):",
    buildSalaryReply(position_name, salary) || "(ไม่มีข้อมูลเงินเดือนในระบบ)",
    "",
    "FIELD_VALUES (single-field Q — send ONLY text AFTER >>> , never the key/หัวข้อ):",
    ...valueLines,
    "",
    `position_name=${position_name}`,
    `company=${company}`,
  ].join("\n")
}

/** Tier-1 reply only — used as the `reply` field for the first detail view. */
export function formatJobDetailReply(data: JobDetail): string {
  return buildSummaryReply(data.position_name, summaryBullets(data.detail))
}

/**
 * Tier-2 user-facing reply — column C values ONLY (no B labels).
 * Bot should send this as-is when user asks เพิ่มเติม.
 */
export function formatJobDetailFullReply(data: JobDetail): string {
  return buildFullReply(fullValueBlocks(data.detail))
}

/**
 * Tier-2 labeled (B:C) — for bot understanding only, not for user chat.
 */
export function formatJobDetailFullReplyLabeled(data: JobDetail): string {
  return buildFullReply(fullBullets(data.detail))
}

/** Salary-only reply — used when the user specifically asks about pay. */
export function formatJobDetailSalaryReply(data: JobDetail): string {
  return buildSalaryReply(data.position_name, salaryBullets(data.detail))
}

/** Short aliases so the bot can match casual questions to a field_values key. */
const FIELD_ALIASES: Record<string, string[]> = {
  หน้าที่หลัก: ["หน้าที่", "ลักษณะงาน", "รับผิดชอบ"],
  สถานที่ทำงาน: ["สถานที่", "ที่ทำงาน", "โลเคชัน", "location"],
  "วันและเวลาทำงาน": ["เวลาทำงาน", "ทำงานกี่วัน", "เวลา"],
  อายุ: ["อายุที่รับ"],
  "ประเภทการจ้างงาน": ["ประเภทจ้าง", "รูปแบบจ้าง"],
  "ปัญหาหรือความท้าทายหลัก": ["ความท้าทาย", "ปัญหา", "day to day", "งานประจำวัน"],
  "ขอบเขตการตัดสินใจของตำแหน่งนี้": ["ขอบเขตการตัดสินใจ", "ตัดสินใจ"],
  คุณสมบัติ: ["คุณสมบัติเพิ่มเติม"],
  "Soft Skills ที่จำเป็นสำหรับตำแหน่งนี้": ["soft skills", "ซอฟต์สกิล"],
  "ทักษะด้านเทคนิค / Hard Skills": ["hard skills", "ทักษะ"],
  "สิทธิประโยชน์ที่ไม่ใช่ตัวเงิน": ["สวัสดิการ", "สิทธิประโยชน์"],
  "ช่วงเงินเดือน (Min – Max)": ["เงินเดือน", "เงิน", "ค่าจ้าง"],
}

/**
 * Flat map: short label → value ONLY (no "label:" prefix).
 * Bot must copy the map value as-is for single-field answers.
 */
export function buildFieldValues(data: JobDetail): Record<string, string> {
  const { detail } = data
  const out: Record<string, string> = {}

  const put = (label: string, raw: string | undefined) => {
    if (isEmptyValue(raw)) return
    const cleaned = cleanValue(raw!)
    if (isEmptyValue(cleaned)) return
    out[label] = cleaned
    for (const alias of FIELD_ALIASES[label] || []) {
      if (!out[alias]) out[alias] = cleaned
    }
  }

  for (const label of SUMMARY_FIELD_ORDER) {
    const key = findDetailKey(detail, label)
    if (key) put(label, detail[key])
  }

  const dutyKey = MAIN_DUTY_KEYS.find((k) => !isEmptyValue(detail[k]))
  if (dutyKey) put("หน้าที่หลัก", detail[dutyKey])

  for (const label of FULL_FIELD_ORDER) {
    const key = findDetailKey(detail, label)
    if (key) put(label, detail[key])
  }

  for (const label of SALARY_FIELDS) {
    const key = findDetailKey(detail, label)
    if (key) put(label, detail[key])
  }

  // Any remaining candidate-facing sheet fields.
  for (const [key, value] of Object.entries(detail)) {
    if (isHiddenField(key)) continue
    if (isEmptyValue(value)) continue
    const short = key.replace(/\s*\([^)]*\)\s*$/u, "").trim()
    if (!out[short] && !out[key]) put(short || key, value)
  }

  return out
}

/**
 * Resolve a casual `field` query (e.g. ความท้าทาย) → value-only string.
 * Returns null when nothing matches.
 */
export function resolveFieldValue(
  fieldQuery: string,
  fieldValues: Record<string, string>
): { key: string; value: string } | null {
  const q = fieldQuery.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "")
  if (!q) return null

  const entries = Object.entries(fieldValues)
  if (entries.length === 0) return null

  // Exact / alias key match (normalized).
  for (const [key, value] of entries) {
    const k = key.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "")
    if (k === q) return { key, value }
  }

  // Containment: query inside key or key inside query (min length guard).
  let best: { key: string; value: string; score: number } | null = null
  for (const [key, value] of entries) {
    const k = key.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "")
    if (q.length < 2 || k.length < 2) continue
    let score = 0
    if (k.includes(q)) score = q.length / k.length
    else if (q.includes(k) && k.length >= 3) score = k.length / q.length
    if (score > 0 && (!best || score > best.score)) {
      best = { key, value, score }
    }
  }
  if (best && best.score >= 0.35) return { key: best.key, value: best.value }
  return null
}
