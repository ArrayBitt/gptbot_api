import { NextRequest, NextResponse } from "next/server"
import { createSheetsClient } from "@/src/lib/createSheetsClient"
import { corsHeaders } from "@/src/lib/v2/constants"
import {
  formatJobDetailResult,
  formatJobDetailReply,
  formatJobDetailFullReply,
  formatJobDetailFullReplyLabeled,
  formatJobDetailSalaryReply,
  buildFieldValues,
  resolveFieldValue,
} from "@/src/lib/v2/formatJobDetailResult"
import { getJobDetail, cleanPositionQuery } from "@/src/lib/v2/getJobDetail"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function GET(req: NextRequest) {
  const positionName = req.nextUrl.searchParams.get("position_name")?.trim() || ""
  const company = req.nextUrl.searchParams.get("company")?.trim() || ""
  const field = req.nextUrl.searchParams.get("field")?.trim() || ""

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

    const field_values = buildFieldValues(data)
    const reply_full = formatJobDetailFullReply(data)
    const reply_full_labeled = formatJobDetailFullReplyLabeled(data)
    const reply_salary = formatJobDetailSalaryReply(data)

    // Single-field mode: reply = value ONLY (no label / หัวข้อ).
    if (field) {
      const matched = resolveFieldValue(field, field_values)
      if (!matched) {
        return NextResponse.json(
          {
            success: true,
            data,
            field,
            field_matched: null,
            reply: "",
            reply_full,
            reply_full_labeled,
            reply_salary,
            field_values,
            result:
              "FIELD_NOT_FOUND: no matching field_values key. Tell user this section is missing; offer contact 086-329-8865 / Line @jobpro. Do NOT invent.",
          },
          { headers: corsHeaders }
        )
      }

      return NextResponse.json(
        {
          success: true,
          data,
          field,
          field_matched: matched.key,
          /** VALUE ONLY — send this `reply` as-is. Never prepend the field label. */
          reply: matched.value,
          reply_full,
          reply_full_labeled,
          reply_salary,
          field_values,
          result: [
            "COPY_THIS_REPLY (single-field — VALUE ONLY, no หัวข้อ):",
            matched.value,
            "",
            `field_matched=${matched.key}`,
            `position_name=${data.position_name}`,
            `company=${data.company}`,
          ].join("\n"),
        },
        { headers: corsHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data,
        reply: formatJobDetailReply(data),
        /** User-facing เพิ่มเติม — column C values only. Send as-is. */
        reply_full,
        /** Bot-only labeled B:C — do NOT send to user. */
        reply_full_labeled,
        reply_salary,
        field_values,
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
