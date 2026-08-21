import { NextRequest, NextResponse } from "next/server"
import { createSheetsClient } from "@/src/lib/createSheetsClient"
import { corsHeaders } from "@/src/lib/v2/constants"
import { formatJobDetailResult, formatJobDetailReply } from "@/src/lib/v2/formatJobDetailResult"
import { getJobDetail, cleanPositionQuery } from "@/src/lib/v2/getJobDetail"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const positionName = req.nextUrl.searchParams.get("position_name")?.trim() || ""
  const company = req.nextUrl.searchParams.get("company")?.trim() || ""

  if (!positionName) {
    return NextResponse.json(
      { success: false, error: "position_name is required" },
      { status: 400, headers: corsHeaders }
    )
  }

  const cleanedQuery = cleanPositionQuery(positionName)
  if (!cleanedQuery) {
    return NextResponse.json(
      {
        success: false,
        error: "position_name is a generic phrase, not a job title",
        result:
          "ERROR: position_name sent was a generic phrase (e.g. 'ต้องการดูรายละเอียดเพิ่มเติม'). Call jobs_list first. Then re-call jobs_detail with exact position_name + company from data[].",
        reply: "",
      },
      { status: 400, headers: corsHeaders }
    )
  }

  try {
    const sheets = createSheetsClient()
    const data = await getJobDetail(sheets, positionName, company)

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "job not found",
          result:
            "ERROR: job not found. Re-call jobs_list. Use exact position_name + company from data[]. Do NOT invent fallback name.",
          reply: "",
        },
        { status: 404, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data,
        reply: formatJobDetailReply(data),
        result: formatJobDetailResult(data),
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("v2 jobs/detail error:", error)
    return NextResponse.json(
      { success: false, error: "failed to load job detail", result: "" },
      { status: 500, headers: corsHeaders }
    )
  }
}
