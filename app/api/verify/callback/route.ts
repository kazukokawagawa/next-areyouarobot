import { NextRequest, NextResponse } from "next/server";
import { ticketStore } from "@/lib/storage";
import axios from "axios";

// Helper to generate a 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function verifyCloudflare(token: string, ip: string) {
  const secret = process.env.CLOUDFLARE_SECRET_KEY;
  if (!secret) {
      console.warn("CLOUDFLARE_SECRET_KEY not set, skipping verification (dev mode)");
      return true; 
  }
  
  try {
    console.log(`Verifying Cloudflare with secret: ${secret.slice(0, 5)}...`);
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const outcome = await result.json();
    if (!outcome.success) {
        console.error("Cloudflare verification failed:", outcome);
    }
    return outcome.success === true;
  } catch (e) {
    console.error("Cloudflare verify error:", e);
    return false;
  }
}

async function verifyGoogle(token: string, ip: string) {
  const secret = process.env.GOOGLE_SECRET_KEY;
  if (!secret) {
      console.warn("GOOGLE_SECRET_KEY not set, skipping verification (dev mode)");
      return true;
  }

  try {
    console.log(`Verifying Google with secret: ${secret.slice(0, 5)}...`);
    // Use recaptcha.net for better availability in some regions (e.g. China)
    // Google also supports POST with parameters
    const url = new URL('https://www.recaptcha.net/recaptcha/api/siteverify');
    url.searchParams.append('secret', secret);
    url.searchParams.append('response', token);
    url.searchParams.append('remoteip', ip);

    const result = await fetch(url.toString(), {
        method: 'POST',
    });

    const outcome = await result.json();
    if (!outcome.success) {
        console.error("Google verification failed:", outcome);
    }
    return outcome.success === true;
  } catch (e) {
    console.error("Google verify error:", e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticket, cf_token, g_token } = body;

    if (!ticket || !cf_token || !g_token) {
      return NextResponse.json({ code: 400, msg: "参数错误：缺少必要参数" }, { status: 400 });
    }

    const ticketData = ticketStore.get(ticket);
    if (!ticketData) {
      return NextResponse.json({ code: 404, msg: "验证链接已过期或不存在" }, { status: 404 });
    }

    if (ticketData.verified) {
         return NextResponse.json({
            code: 0,
            msg: "验证成功",
            data: {
                code: ticketData.code
            }
        });
    }

    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

    // Verify both
    const [cfSuccess, gSuccess] = await Promise.all([
        verifyCloudflare(cf_token, ip),
        verifyGoogle(g_token, ip)
    ]);

    if (!cfSuccess || !gSuccess) {
        return NextResponse.json({ code: 400, msg: "验证失败：人机验证未通过" }, { status: 400 });
    }

    // Success
    const code = generateCode();
    ticketData.verified = true;
    ticketData.code = code;
    ticketStore.set(ticket, ticketData); // Update store

    return NextResponse.json({
      code: 0,
      msg: "验证成功",
      data: {
        code
      }
    });

  } catch (error) {
    console.error("Callback verify error:", error);
    return NextResponse.json({ code: 500, msg: "Internal Server Error" }, { status: 500 });
  }
}
