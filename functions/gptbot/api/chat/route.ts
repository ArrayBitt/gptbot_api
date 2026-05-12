import { NextRequest, NextResponse } from "next/server"
import { getOpenJobs, Job } from "@/src/lib/getOpenJobs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message: string = body.message?.toLowerCase() || ""

    const jobs = await getOpenJobs()

    // INTENT DETECTION
    let intent = "UNKNOWN"

    if (message.includes("สมัคร") || message.includes("สนใจสมัคร")) {
      intent = "APPLY"
    } else if (
      message.includes("jd") ||
      message.includes("รายละเอียด") ||
      message.includes("ทำอะไร") ||
      message.includes("หน้าที่")
    ) {
      intent = "JOB_DETAIL"
    } else if (
      message.includes("มีงาน") ||
      message.includes("ตำแหน่ง") ||
      message.includes("งานอะไรบ้าง")
    ) {
      intent = "CAREER_MATCH"
    } else {
      intent = "POSITION_MATCH"
    }

    switch (intent) {

      case "POSITION_MATCH": {
        const matches = jobs.filter((job: Job) => {
          const position = job.position_name.toLowerCase()
          const detailText = Object.values(job.detail).join(" ").toLowerCase()
          return position.includes(message) || detailText.includes(message)
        })

        if (matches.length === 0) {
          return NextResponse.json({
            message: "ขออภัยค่ะ ขณะนี้ยังไม่มีตำแหน่งดังกล่าวเปิดรับ",
          })
        }

        if (matches.length === 1) {
          const job = matches[0]
          const detail = job.detail
          return NextResponse.json({
            message: `
ชื่อตำแหน่ง: ${job.position_name}
บริษัท: ${job.company}

หน้าที่หลักของตำแหน่งนี้ เช่น
${detail["หน้าที่และความรับผิดชอบหลัก (ระบุเป็นข้อๆ)"]?.split("\n")[0] || ""}

สนใจดูรายละเอียดเพิ่มเติมหรือสมัครตำแหน่งนี้ไหมคะ
            `,
          })
        }

        const list = matches
          .slice(0, 3)
          .map((j: Job, i: number) => `${i + 1}. ${j.position_name}`)
          .join("\n")

        return NextResponse.json({
          message: `
พบตำแหน่งที่เกี่ยวข้องดังนี้

${list}

พิมพ์ชื่อตำแหน่งที่สนใจได้เลยค่ะ
`,
        })
      }

      case "CAREER_MATCH": {
        const list = jobs
          .slice(0, 5)
          .map((j: Job, i: number) => `${i + 1}. ${j.position_name}`)
          .join("\n")

        return NextResponse.json({
          message: `
ขณะนี้มีตำแหน่งงานที่เปิดรับ เช่น

${list}

หากสนใจตำแหน่งใด สามารถพิมพ์ชื่อตำแหน่งได้เลยนะคะ
`,
        })
      }

      case "JOB_DETAIL": {
        const match = jobs.find((job: Job) =>
          message.includes(job.position_name.toLowerCase())
        )

        if (!match) {
          return NextResponse.json({
            message: "กรุณาระบุชื่อตำแหน่งที่ต้องการทราบรายละเอียดค่ะ",
          })
        }

        const d = match.detail
        return NextResponse.json({
          message: `
ตำแหน่ง ${match.position_name}

หน้าที่หลัก
${d["หน้าที่และความรับผิดชอบหลัก (ระบุเป็นข้อๆ)"] || "-"}

คุณสมบัติ
${d["ประสบการณ์ขั้นต่ำ (จำนวนปี)"] || "-"}

รูปแบบการทำงาน
${d["รูปแบบการทำงาน"] || "-"}

สถานที่ทำงาน
${d["สถานที่ทำงาน"] || "-"}

สนใจสมัครตำแหน่งนี้ไหมคะ
`,
        })
      }

      case "APPLY": {
        return NextResponse.json({
          message: `
สามารถส่ง Resume มาที่อีเมล

itcenter.thitaram@gmail.com

โดยระบุชื่อตำแหน่งที่ต้องการสมัครในหัวข้ออีเมลด้วยนะคะ
`,
        })
      }

      default:
        return NextResponse.json({ message: "ขออภัยค่ะ ไม่เข้าใจคำถาม" })
    }
  } catch (error) {
    console.error("CHAT API ERROR", error)
    return NextResponse.json({ message: "ระบบเกิดข้อผิดพลาด" })
  }
}
