import { NextRequest, NextResponse } from "next/server";
import { ticketStore } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.API_KEY;

    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
         if (apiKey) {
            return NextResponse.json({ code: 401, msg: "Unauthorized: Invalid API key" }, { status: 401 });
        }
    }

    const body = await request.json();
    const { group_id, code } = body;
    // user_id is optional in spec but useful for strict check

    if (!group_id || !code) {
      return NextResponse.json({ code: 400, msg: "参数错误：缺少必填参数 group_id 或 code" }, { status: 400 });
    }

    // Find ticket by code and group_id
    // In efficient implementation, we should have a secondary index or lookup by code if code is unique-ish
    // But iterating map is fine for small scale
    let foundTicket = null;
    for (const [key, value] of ticketStore.entries()) {
        if (value.group_id === String(group_id) && value.code === String(code) && value.verified) {
            foundTicket = value;
            break;
        }
    }

    if (!foundTicket) {
        return NextResponse.json({ code: 400, msg: "验证失败：验证码不存在或已失效" }, { status: 400 });
    }

    // Success
    // Optionally remove ticket after use to prevent replay
    ticketStore.delete(foundTicket.ticket);

    return NextResponse.json({
      code: 0,
      msg: "验证通过",
      passed: true,
      data: {
        user_id: foundTicket.user_id,
        group_id: foundTicket.group_id
      }
    });

  } catch (error) {
    console.error("Check verify error:", error);
    return NextResponse.json({ code: 500, msg: "Internal Server Error" }, { status: 500 });
  }
}
