"use client"

export const runtime = 'edge';

import { useState, useRef, use } from "react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import ReCAPTCHA from "react-google-recaptcha"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import { ShieldCheck, CheckCircle2, Loader2 } from "lucide-react"
import axios from "axios"

export default function VerificationPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = use(params)
  const [step, setStep] = useState<"start" | "cloudflare" | "ready_to_submit" | "google" | "success">("start")
  const [cfToken, setCfToken] = useState<string | null>(null)
  const [gToken, setGToken] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecaptchaLoaded, setIsRecaptchaLoaded] = useState(false)
  
  const turnstileRef = useRef<TurnstileInstance>(null)
  const recaptchaRef = useRef<ReCAPTCHA>(null)

  const handleStart = () => {
    setStep("cloudflare")
  }

  const handleCloudflareSuccess = (token: string) => {
    setCfToken(token)
    setStep("ready_to_submit")
    // toast.success("Cloudflare 验证通过")
  }

  const handleSubmitClick = () => {
    setStep("google")
    setIsRecaptchaLoaded(false)
    setIsDialogOpen(true)
  }

  const handleGoogleChange = (token: string | null) => {
    if (token) {
      setGToken(token)
      // 自动提交或稍微延迟
      setTimeout(() => {
        finalSubmit(cfToken!, token)
      }, 1000)
    }
  }

  const finalSubmit = async (cf: string, g: string) => {
    setIsSubmitting(true)
    try {
      const res = await axios.post("/api/verify/callback", {
        ticket,
        cf_token: cf,
        g_token: g
      })

      if (res.data.code === 0) {
        setStep("success")
        setCode(res.data.data.code)
        setIsDialogOpen(false)
        toast.success("所有验证已通过！")
      } else {
        toast.error(res.data.msg || "验证失败，请重试")
        recaptchaRef.current?.reset()
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.response?.data?.msg || "提交失败，请重试")
      recaptchaRef.current?.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <span>入群验证</span>
          </CardTitle>
          <CardDescription>
            为了维护群组环境，请完成人机验证
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 flex flex-col items-center py-8">
          
          {step === "start" && (
            <div className="w-full animate-in fade-in duration-500">
                <Button size="lg" className="w-full text-lg h-12" onClick={handleStart}>
                开始验证
                </Button>
            </div>
          )}

          {(step === "cloudflare" || step === "ready_to_submit") && (
            <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
              <div className="relative min-h-16.25 flex justify-center w-full">
                 <Turnstile 
                    siteKey={process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY!}  
                    onSuccess={handleCloudflareSuccess}
                    ref={turnstileRef}
                    options={{
                        theme: 'light',
                        size: 'normal'
                    }}
                 />
              </div>
              
              {step === "ready_to_submit" && (
                <Button 
                    size="lg" 
                    className="w-full animate-in slide-in-from-bottom-2 h-12 text-lg" 
                    onClick={handleSubmitClick}
                >
                  提交验证
                </Button>
              )}
            </div>
          )}

          {step === "success" && (
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">验证通过</h3>
                <p className="text-gray-500 mt-2">您已通过人机验证，请返回群聊。</p>
                {code && (
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-500 mb-1">验证码</p>
                        <p className="text-2xl font-mono font-bold tracking-widest text-primary">{code}</p>
                    </div>
                )}
              </div>
              <Button className="w-full mt-4" variant="outline" onClick={() => window.location.reload()}>
                重新验证
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={() => {
        // Prevent closing by user interaction
      }}>
        <DialogContent className="sm:max-w-100" showCloseButton={false}>
            <DialogHeader>
                <DialogTitle>安全检查</DialogTitle>
                <DialogDescription>
                    请完成下方验证，确认后即可入群。
                </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-8 relative">
                 {isSubmitting ? (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-sm text-gray-500 font-medium">正在提交验证结果...</p>
                    </div>
                 ) : (
                    <div className="relative flex flex-col items-center justify-center min-h-19.5 min-w-76">
                        {!isRecaptchaLoaded && (
                             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 z-10 rounded-md border border-dashed border-gray-200">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mb-2" />
                                <span className="text-xs text-muted-foreground font-medium">正在加载安全组件...</span>
                             </div>
                        )}
                        <div className="flex justify-center">
                             <ReCAPTCHA
                                 ref={recaptchaRef}
                                 sitekey={process.env.NEXT_PUBLIC_GOOGLE_SITE_KEY || ""}
                                 onChange={handleGoogleChange}
                                 asyncScriptOnLoad={() => setIsRecaptchaLoaded(true)}
                             />
                         </div>
                    </div>
                 )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
