# 本地验证系统 API 调用文档

本文档说明如何通过外部应用（如 Telegram/Discord 机器人、后台管理系统等）调用本地部署的验证服务。

## 基础配置

### 1. 服务地址 (Base URL)
默认本地地址为：`http://localhost:3000`
部署后请替换为实际域名。

### 2. 认证方式 (Authentication)
所有 API 请求均需要在 Header 中携带 API Key。
API Key 在 `.env.local` 文件中的 `API_KEY` 字段配置。

**Header 示例：**
```http
Authorization: Bearer your-api-key-here
Content-Type: application/json
```

---

## 接口列表

### 1. 创建验证链接 (Create Verification)
当新用户加入群组时，机器人调用此接口生成专属验证链接。

*   **Endpoint:** `/api/verify/create`
*   **Method:** `POST`
*   **Body:**

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `group_id` | string/number | 是 | 群组 ID |
| `user_id` | string/number | 是 | 用户 ID |

*   **请求示例 (curl):**
```bash
curl -X POST http://localhost:3000/api/verify/create \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "10086",
    "user_id": "12345678"
  }'
```

*   **成功响应:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "ticket": "a1b2c3d4e5...",
    "url": "http://localhost:3000/v/a1b2c3d4e5...",
    "expire": 300
  }
}
```
> **说明**: 机器人应将 `url` 发送给用户，并告知其在 5 分钟内完成验证。

---

### 2. 核验验证结果 (Check Verification)
用户在网页端完成验证后，会获得一个 6 位数字验证码 (Code)。机器人引导用户在群内发送该 Code，然后调用此接口进行核验。

*   **Endpoint:** `/api/verify/check`
*   **Method:** `POST`
*   **Body:**

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `group_id` | string/number | 是 | 群组 ID (必须与创建时一致) |
| `code` | string | 是 | 用户提供的 6 位数字验证码 |

*   **请求示例 (curl):**
```bash
curl -X POST http://localhost:3000/api/verify/check \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "10086",
    "code": "123456"
  }'
```

*   **成功响应 (验证通过):**
```json
{
  "code": 0,
  "msg": "验证通过",
  "passed": true,
  "data": {
    "user_id": "12345678",
    "group_id": "10086"
  }
}
```
> **说明**: 
> *   `code: 0` 表示接口调用成功且验证码有效。
> *   验证码只能使用一次，验证成功后立即失效。

---

## 生产环境部署指南 (Cloudflare KV)

本项目默认使用内存存储 (Memory Storage)，在 Vercel 或本地开发环境下可用。
**但在 Cloudflare Pages 等 Edge 环境下，必须替换为持久化存储 (KV)，否则多节点间数据无法同步。**

### 1. 准备工作
1.  登录 Cloudflare Dashboard。
2.  进入 **Workers & Pages** -> **KV**。
3.  创建一个新的 Namespace，命名为 `VERIFY_KV`。
4.  获取该 Namespace 的 ID。

### 2. 配置项目
在项目根目录的 `wrangler.toml` (如果没有请创建) 中添加绑定：

```toml
[[kv_namespaces]]
binding = "VERIFY_KV"
id = "你的_NAMESPACE_ID"
preview_id = "你的_PREVIEW_NAMESPACE_ID" # 可选，用于本地 wrangler dev
```

### 3. 替换存储代码
将 `lib/storage.ts` 的内容替换为以下代码：

```typescript
import { type TicketData } from "./storage"; // 保持接口定义或直接在此定义

export interface TicketData {
  ticket: string;
  group_id: string;
  user_id: string;
  created_at: number;
  verified: boolean;
  code?: string;
}

// 绑定 KV Namespace 类型
interface Env {
  VERIFY_KV: KVNamespace;
}

// 获取 KV 实例 (在 Next.js Edge Runtime 中通常通过 process.env 获取绑定)
// 注意：Cloudflare Pages + Next.js 的绑定方式可能需要适配，以下为通用 Edge 模式
const getKV = () => (process.env.VERIFY_KV as unknown as KVNamespace);

export async function saveTicket(data: TicketData): Promise<void> {
  const kv = getKV();
  // 设置 5 分钟 (300秒) 过期
  await kv.put(data.ticket, JSON.stringify(data), { expirationTtl: 300 });
}

export async function getTicket(ticket: string): Promise<TicketData | null> {
  const kv = getKV();
  const data = await kv.get(ticket);
  return data ? JSON.parse(data) : null;
}

export async function updateTicket(ticket: string, data: TicketData): Promise<void> {
  const kv = getKV();
  // 更新 Ticket 数据
  await kv.put(ticket, JSON.stringify(data), { expirationTtl: 300 });

  // 如果验证通过，创建反向索引以便通过 code + group_id 查找
  if (data.verified && data.code && data.group_id) {
    const indexKey = `code:${data.group_id}:${data.code}`;
    // 存储 Ticket ID，有效期与 Ticket 一致
    await kv.put(indexKey, ticket, { expirationTtl: 300 });
  }
}

export async function deleteTicket(ticket: string): Promise<void> {
  const kv = getKV();
  await kv.delete(ticket);
}

export async function findVerifiedTicket(group_id: string, code: string): Promise<TicketData | null> {
  const kv = getKV();
  const indexKey = `code:${group_id}:${code}`;
  
  // 1. 通过索引查找 Ticket ID
  const ticketId = await kv.get(indexKey);
  if (!ticketId) return null;

  // 2. 获取 Ticket 数据
  const dataStr = await kv.get(ticketId);
  if (!dataStr) return null;

  const data = JSON.parse(dataStr) as TicketData;
  
  // 3. 再次确认验证状态
  if (data.verified && String(data.code) === String(code)) {
    // 找到后删除索引，防止重放 (Ticket 本身由调用者决定是否删除)
    await kv.delete(indexKey);
    return data;
  }
  
  return null;
}

// KV 自动处理过期，无需手动清理
export function cleanExpiredTickets() {}
```

### 4. 类型定义补充
如果遇到 `KVNamespace` 类型报错，请安装 Cloudflare 类型库：
```bash
pnpm add -D @cloudflare/workers-types
```
并在 `tsconfig.json` 的 `types` 中添加 `"@cloudflare/workers-types"`。
