import { describe, expect, it } from "vitest"
import { cleanPositionQuery, coreName, isStrongTitleMatch, scoreTitleMatch } from "../getJobDetail"

describe("cleanPositionQuery", () => {
  it("returns empty for a generic phrase that is not a job title", () => {
    expect(cleanPositionQuery("ต้องการดูรายละเอียดเพิ่มเติม")).toBe("")
  })

  it("strips trailing question words", () => {
    expect(cleanPositionQuery("ขับรถงานลูกค้าคืออะไร")).toBe("ขับรถงานลูกค้า")
  })

  it("drops a pasted ' — location' suffix", () => {
    expect(
      cleanPositionQuery("พนักงานขับรถส่วนกลาง แจ้งวัฒนะ — แจ้งวัฒนะ-หลักสี่")
    ).toBe("พนักงานขับรถส่วนกลาง แจ้งวัฒนะ")
  })

  it("keeps a bare 'นะ' inside a place name (แจ้งวัฒนะ)", () => {
    expect(cleanPositionQuery("พนักงานขับรถส่วนกลาง แจ้งวัฒนะ")).toBe(
      "พนักงานขับรถส่วนกลาง แจ้งวัฒนะ"
    )
  })

  it("never splits on a hyphen inside a name", () => {
    expect(cleanPositionQuery("ขับรถ สุขุมวิท-อโศก")).toContain("สุขุมวิท-อโศก")
  })
})

describe("coreName", () => {
  it("drops leading พนักงาน and parenthetical tags", () => {
    expect(coreName("พนักงานขับรถงานลูกค้า (Client)")).toBe("ขับรถงานลูกค้า")
  })
})

describe("scoreTitleMatch", () => {
  it("scores an exact match 100", () => {
    expect(scoreTitleMatch("พนักงานขับรถส่วนกลาง คลองเตย", "พนักงานขับรถส่วนกลาง คลองเตย")).toBe(100)
  })

  it("treats a missing leading พนักงาน as a strong (core) match", () => {
    const score = scoreTitleMatch("ขับรถส่วนกลาง คลองเตย", "พนักงานขับรถส่วนกลาง คลองเตย")
    expect(score).toBe(95)
    expect(isStrongTitleMatch("ขับรถส่วนกลาง คลองเตย", "พนักงานขับรถส่วนกลาง คลองเตย")).toBe(true)
  })

  it("does not let a generic title match a specific one (nationality / place)", () => {
    expect(isStrongTitleMatch("ขับรถผู้บริหาร", "พนักงานขับรถผู้บริหารชาวรัสเซีย")).toBe(false)
    expect(isStrongTitleMatch("ขับรถผู้บริหาร", "พนักงานขับรถผู้บริหาร ไทรม้า")).toBe(false)
  })

  it("rejects containment when the leftover text is a real qualifier (score 0, not just < 95)", () => {
    expect(scoreTitleMatch("ขับรถผู้บริหาร", "พนักงานขับรถผู้บริหารชาวรัสเซีย")).toBe(0)
    expect(scoreTitleMatch("ขับรถผู้บริหาร", "พนักงานขับรถผู้บริหาร ไทรม้า")).toBe(0)
  })

  it("scores unrelated titles 0", () => {
    expect(scoreTitleMatch("ขับรถส่วนกลาง คลองเตย", "พนักงานขับรถผู้บริหาร จรัญ 41")).toBe(0)
  })

  it("scores empty input 0", () => {
    expect(scoreTitleMatch("", "พนักงานขับรถส่วนกลาง")).toBe(0)
  })
})
