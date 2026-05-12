import { onRequest } from "firebase-functions/v2/https"
import { createSheetsClient } from "./lib/sheets"
import { getOpenJobs, Job } from "./lib/getOpenJobs"
import { getCompanySheetId } from "./lib/getCompanySheetId"

const CONTROL_CENTER_ID = "1slOgchohy1pNoXKhGhx8FSMl5o6VjkAYkP4vWEby_ng"

function getSheets() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_B64 is not set")
  const raw = Buffer.from(b64, "base64").toString("utf-8")
  return createSheetsClient(raw)
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// GET /jobs?search=...
export const jobs = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    if (req.method === "OPTIONS") { res.status(204).send(""); return }

    try {
      const sheets = getSheets()
      const search = (req.query.search as string) || ""
      const data = await getOpenJobs(sheets, search)
      res.json({ success: true, data })
    } catch (error) {
      console.error("jobs error:", error)
      res.status(500).json({ success: false })
    }
  }
)

// GET /jobDetail?position_name=...
export const jobDetail = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    if (req.method === "OPTIONS") { res.status(204).send(""); return }

    const positionName = (req.query.position_name as string)?.trim()
    if (!positionName) { res.status(400).json({ success: false }); return }

    try {
      const sheets = getSheets()

      const res2 = await sheets.spreadsheets.values.get({
        spreadsheetId: CONTROL_CENTER_ID,
        range: "Global_Open_Position!A2:D100",
      })

      const rows = res2.data.values || []
      const found = rows.find((row: string[]) => row[2]?.trim() === positionName)
      if (!found) { res.json({ success: false }); return }

      const companySheetId = await getCompanySheetId(sheets, found[1])
      if (!companySheetId) { res.json({ success: false }); return }

      const detail = await sheets.spreadsheets.values.get({
        spreadsheetId: companySheetId,
        range: `'${positionName}'!A1:D200`,
      })

      const formatted: Record<string, string> = {}
      ;(detail.data.values || []).forEach((row: string[]) => {
        const key = row[1]; const value = row[2]
        if (key && value && key !== "รายการ" && !key.includes("SECTION")) {
          formatted[key] = value
        }
      })

      res.json({ success: true, data: formatted })
    } catch (error) {
      console.error("jobDetail error:", error)
      res.status(500).json({ success: false })
    }
  }
)

// POST /chat  body: { message: string }
export const chat = onRequest(
  { region: "asia-southeast1" },
  async (req, res) => {
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v))
    if (req.method === "OPTIONS") { res.status(204).send(""); return }

    try {
      const sheets = getSheets()
      const message: string = req.body?.message?.toLowerCase() || ""
      const allJobs = await getOpenJobs(sheets)

      let intent = "UNKNOWN"
      if (message.includes("สมัคร") || message.includes("สนใจสมัคร")) {
        intent = "APPLY"
      } else if (
        message.includes("jd") || message.includes("รายละเอียด") ||
        message.includes("ทำอะไร") || message.includes("หน้าที่")
      ) {
        intent = "JOB_DETAIL"
      } else if (
        message.includes("มีงาน") || message.includes("ตำแหน่ง") ||
        message.includes("งานอะไรบ้าง")
      ) {
        intent = "CAREER_MATCH"
      } else {
        intent = "POSITION_MATCH"
      }

      switch (intent) {
        case "POSITION_MATCH": {
          const matches = allJobs.filter((job: Job) => {
            const position = job.position_name.toLowerCase()
            const detailText = Object.values(job.detail).join(" ").toLowerCase()
            return position.includes(message) || detailText.includes(message)
          })
          if (matches.length === 0) {
            res.json({ message: "ขออภัยค่ะ ขณะนี้ยังไม่มีตำแหน่งดังกล่าวเปิดรับ" }); return
          }
          if (matches.length === 1) {
            const job = matches[0]
            res.json({ message: `ชื่อตำแหน่ง: ${job.position_name}\nบริษัท: ${job.company}\n\n${job.detail["หน้าที่และความรับผิดชอบหลัก (ระบุเป็นข้อๆ)"]?.split("\n")[0] || ""}\n\nสนใจดูรายละเอียดเพิ่มเติมหรือสมัครตำแหน่งนี้ไหมคะ` })
            return
          }
          const list = matches.slice(0, 3).map((j: Job, i: number) => `${i + 1}. ${j.position_name}`).join("\n")
          res.json({ message: `พบตำแหน่งที่เกี่ยวข้องดังนี้\n\n${list}\n\nพิมพ์ชื่อตำแหน่งที่สนใจได้เลยค่ะ` })
          break
        }
        case "CAREER_MATCH": {
          const list = allJobs.slice(0, 5).map((j: Job, i: number) => `${i + 1}. ${j.position_name}`).join("\n")
          res.json({ message: `ขณะนี้มีตำแหน่งงานที่เปิดรับ เช่น\n\n${list}\n\nหากสนใจตำแหน่งใด สามารถพิมพ์ชื่อตำแหน่งได้เลยนะคะ` })
          break
        }
        case "JOB_DETAIL": {
          const match = allJobs.find((job: Job) => message.includes(job.position_name.toLowerCase()))
          if (!match) { res.json({ message: "กรุณาระบุชื่อตำแหน่งที่ต้องการทราบรายละเอียดค่ะ" }); return }
          const d = match.detail
          res.json({ message: `ตำแหน่ง ${match.position_name}\n\nหน้าที่หลัก\n${d["หน้าที่และความรับผิดชอบหลัก (ระบุเป็นข้อๆ)"] || "-"}\n\nคุณสมบัติ\n${d["ประสบการณ์ขั้นต่ำ (จำนวนปี)"] || "-"}\n\nรูปแบบการทำงาน\n${d["รูปแบบการทำงาน"] || "-"}\n\nสถานที่ทำงาน\n${d["สถานที่ทำงาน"] || "-"}\n\nสนใจสมัครตำแหน่งนี้ไหมคะ` })
          break
        }
        case "APPLY": {
          res.json({ message: "สามารถส่ง Resume มาที่อีเมล\n\nitcenter.thitaram@gmail.com\n\nโดยระบุชื่อตำแหน่งที่ต้องการสมัครในหัวข้ออีเมลด้วยนะคะ" })
          break
        }
        default:
          res.json({ message: "ขออภัยค่ะ ไม่เข้าใจคำถาม" })
      }
    } catch (error) {
      console.error("chat error:", error)
      res.status(500).json({ message: "ระบบเกิดข้อผิดพลาด" })
    }
  }
)
