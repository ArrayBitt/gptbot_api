/**
 * Fallback เมื่อ API ไม่มีข้อมูลที่ถูกถาม: บอทต้องไม่ตอบเอง ให้ส่งข้อความนี้
 * ตามตัวอักษร แล้วชวนกรอกใบสมัคร ทีมแอดมินจะดูหลังบ้านและติดต่อกลับเอง
 */
export const APPLY_FORM_URL = "https://url.in.th/ccoAN"

export type FallbackReason = "search_empty" | "job_not_found" | "field_missing" | "list_empty"

function applyBlock() {
  return [
    "รบกวนกรอกใบสมัครไว้ที่ลิงก์ด้านล่างนี้ได้เลยนะคะ 😊",
    "แอดมินจะดูรายละเอียดและติดต่อกลับให้โดยเร็วค่ะ",
    APPLY_FORM_URL,
  ].join("\n")
}

export function buildFallbackReply(reason: FallbackReason, query?: string): string {
  switch (reason) {
    case "search_empty":
      return [
        query
          ? `ตอนนี้ยังไม่พบตำแหน่งที่ตรงกับ "${query}" ในระบบค่ะ`
          : "ตอนนี้ยังไม่พบตำแหน่งที่ตรงกับที่สอบถามในระบบค่ะ",
        applyBlock(),
      ].join("\n")
    case "list_empty":
      return ["ตอนนี้ยังไม่มีตำแหน่งที่เปิดรับในระบบค่ะ", applyBlock()].join("\n")
    case "job_not_found":
    case "field_missing":
      return ["เรื่องนี้ขอให้ทีมงานตรวจสอบข้อมูลล่าสุดให้นะคะ", applyBlock()].join("\n")
  }
}

/** Fields ที่ทุก response แบบ no-data ต้องมีเหมือนกัน เพื่อให้บอทตัดสินใจจาก flag เดียว */
export function noDataFields(reason: FallbackReason, query?: string) {
  const reply_fallback = buildFallbackReply(reason, query)
  return {
    no_data: true as const,
    fallback_reason: reason,
    reply_fallback,
    instruction:
      "NO_DATA: do NOT answer from your own knowledge. Send `reply_fallback` to the user exactly as-is, nothing added.",
  }
}
