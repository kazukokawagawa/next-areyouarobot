"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import axios from "axios"
import { ExternalLink, Key, ShieldCheck, UserCheck, Play, Copy, CheckCircle2, XCircle } from "lucide-react"

export default function TestToolsPage() {
  const [apiKey, setApiKey] = useState("your-api-key-here")
  
  // Create Verification State
  const [createGroupId, setCreateGroupId] = useState("123456")
  const [createUserId, setCreateUserId] = useState("789012")
  const [createResult, setCreateResult] = useState<any>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Check Verification State
  const [checkGroupId, setCheckGroupId] = useState("123456")
  const [checkCode, setCheckCode] = useState("")
  const [checkResult, setCheckResult] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
    setCreateResult(null)
    try {
      const res = await axios.post(
        "/api/verify/create", 
        { group_id: createGroupId, user_id: createUserId },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      setCreateResult(res.data)
      toast.success("验证链接生成成功")
    } catch (error: any) {
      console.error(error)
      toast.error(error.response?.data?.msg || "生成失败")
      setCreateResult(error.response?.data || { msg: "Request Failed" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCheck = async () => {
    setIsChecking(true)
    setCheckResult(null)
    try {
      const res = await axios.post(
        "/api/verify/check",
        { group_id: checkGroupId, code: checkCode },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      setCheckResult(res.data)
      if (res.data.code === 0) {
        toast.success("验证通过！")
      } else {
        toast.error("验证未通过")
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.response?.data?.msg || "核验失败")
      setCheckResult(error.response?.data || { msg: "Request Failed" })
    } finally {
      setIsChecking(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("已复制到剪贴板")
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">验证系统测试台</h1>
            <p className="text-gray-500 mt-2">模拟机器人/群管端的 API 调用流程</p>
          </div>
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <Key className="w-4 h-4 text-gray-400" />
            <Input 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              className="border-none shadow-none focus-visible:ring-0 w-64 h-8"
              placeholder="Enter API Key"
              type="password"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Verification Card */}
          <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <ShieldCheck className="w-5 h-5" />
                第一步：生成验证链接
              </CardTitle>
              <CardDescription>
                模拟新用户入群，机器人请求生成验证链接
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="group_id">Group ID</Label>
                <Input 
                  id="group_id" 
                  value={createGroupId} 
                  onChange={(e) => {
                    setCreateGroupId(e.target.value)
                    setCheckGroupId(e.target.value) // Sync with check
                  }} 
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="user_id">User ID</Label>
                <Input 
                  id="user_id" 
                  value={createUserId} 
                  onChange={(e) => setCreateUserId(e.target.value)} 
                />
              </div>
              
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "生成中..." : "生成链接"}
              </Button>

              {createResult && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md text-sm break-all">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-700">Response:</span>
                    {createResult.code === 0 && (
                        <span className="text-green-600 flex items-center gap-1 text-xs">
                            <CheckCircle2 className="w-3 h-3"/> Success
                        </span>
                    )}
                  </div>
                  
                  {createResult.data?.url && (
                    <div className="bg-white p-3 rounded border border-blue-100 mb-2">
                        <div className="text-xs text-gray-500 mb-1">验证 URL</div>
                        <div className="flex items-center gap-2">
                            <a 
                                href={createResult.data.url} 
                                target="_blank" 
                                className="text-blue-600 hover:underline truncate flex-1 font-mono"
                            >
                                {createResult.data.url}
                            </a>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(createResult.data.url)}>
                                <Copy className="w-3 h-3" />
                            </Button>
                            <a href={createResult.data.url} target="_blank">
                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                    <ExternalLink className="w-3 h-3" />
                                </Button>
                            </a>
                        </div>
                    </div>
                  )}

                  <pre className="text-xs text-gray-500 overflow-x-auto">
                    {JSON.stringify(createResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check Verification Card */}
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <UserCheck className="w-5 h-5" />
                第二步：核验结果
              </CardTitle>
              <CardDescription>
                用户完成验证后，机器人核验 Code 是否有效
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="check_group_id">Group ID</Label>
                <Input 
                  id="check_group_id" 
                  value={checkGroupId} 
                  onChange={(e) => setCheckGroupId(e.target.value)} 
                />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="code">Verification Code</Label>
                <Input 
                  id="code" 
                  placeholder="用户完成验证后获得的 6 位数字"
                  value={checkCode} 
                  onChange={(e) => setCheckCode(e.target.value)} 
                />
              </div>

              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleCheck} disabled={isChecking}>
                {isChecking ? "核验中..." : "核验 Code"}
              </Button>

              {checkResult && (
                <div className={`mt-4 p-4 rounded-md text-sm border ${checkResult.code === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                   <div className="flex items-center gap-2 font-bold mb-2">
                        {checkResult.code === 0 ? (
                            <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>验证通过</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-red-700">
                                <XCircle className="w-5 h-5" />
                                <span>{checkResult.msg}</span>
                            </div>
                        )}
                   </div>
                   {checkResult.data && (
                       <div className="space-y-1 text-gray-600">
                           <div>User ID: {checkResult.data.user_id}</div>
                           <div>Group ID: {checkResult.data.group_id}</div>
                       </div>
                   )}
                   <div className="mt-2 pt-2 border-t border-gray-200/50">
                        <pre className="text-xs text-gray-500 overflow-x-auto">
                            {JSON.stringify(checkResult, null, 2)}
                        </pre>
                   </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>测试流程说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600 space-y-2">
                <p>1. 确保 <strong>.env.local</strong> 中的 <code className="bg-gray-100 px-1 py-0.5 rounded">API_KEY</code> 与上方输入框一致。</p>
                <p>2. 在左侧卡片点击“生成链接”，获取验证 URL。</p>
                <p>3. 点击链接跳转到验证页面，完成 Cloudflare 和 Google 的双重验证。</p>
                <p>4. 验证成功后，页面会显示一个 6 位数字的 Code。</p>
                <p>5. 将 Code 填入右侧卡片，点击“核验 Code”，查看验证结果。</p>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
