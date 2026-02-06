import { NextRequest, NextResponse } from "next/server";
import { saveTicket, cleanExpiredTickets } from "@/lib/storage";

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.API_KEY;

    // Simple API Key check
    if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
        // Allow if API_KEY is not set in env (dev mode convenience) or strictly check?
        // User said "key写在env就行", so we expect it.
        if (apiKey) {
            return NextResponse.json({ code: 401, msg: "Unauthorized: Invalid API key" }, { status: 401 });
        }
    }

    const body = await request.json() as { group_id: string | number; user_id: string | number };
    const { group_id, user_id } = body;

    if (!group_id || !user_id) {
      return NextResponse.json({ code: 400, msg: "参数错误：group_id 和 user_id 必填" }, { status: 400 });
    }

    // Clean expired tickets occasionally
    if (Math.random() < 0.1) {
        cleanExpiredTickets();
    }

    const ticket = crypto.randomUUID().replace(/-/g, "");
    const now = Date.now();

    await saveTicket({
      ticket,
      group_id: String(group_id),
      user_id: String(user_id),
      created_at: now,
      verified: false,
    });

    const origin = request.nextUrl.origin;
    
    return NextResponse.json({
      code: 0,
      msg: "success",
      data: {
        ticket,
        url: `${origin}/v/${ticket}`,
        expire: 300,
      },
    });

  } catch (error) {
    console.error("Create verify error:", error);
    return NextResponse.json({ code: 500, msg: "Internal Server Error" }, { status: 500 });
  }
}
