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
> *   验证通过后，该验证码即刻失效（防重放），机器人应解除用户禁言或通过入群申请。

*   **失败响应 (验证码错误或过期):**
```json
{
  "code": 400,
  "msg": "验证失败：验证码不存在或已失效"
}
```

---

## 完整业务流程图解

1.  **用户入群/触发验证**
    *   用户 -> 机器人: 申请入群
    *   机器人 -> API: 调用 `/api/verify/create` (带上 user_id, group_id)
    *   API -> 机器人: 返回验证 URL

2.  **用户进行验证**
    *   机器人 -> 用户: 发送验证 URL (私聊或群内临时消息)
    *   用户 -> 浏览器: 打开 URL
    *   浏览器 -> 用户: 显示 Cloudflare + Google 双重验证
    *   用户 -> 浏览器: 完成点击验证
    *   浏览器 -> API: 自动回调 `/api/verify/callback` (前端自动处理)
    *   浏览器 -> 用户: 验证成功，**显示 6 位数字 Code**

3.  **结果确认**
    *   用户 -> 机器人: 发送/输入 6 位 Code
    *   机器人 -> API: 调用 `/api/verify/check` (带上 group_id, code)
    *   API -> 机器人: 返回 `{ "passed": true }`
    *   机器人 -> 群组: 允许用户通过/解除禁言

## Python 调用示例

```python
import requests

API_BASE = "http://localhost:3000"
API_KEY = "your-api-key-here"

def create_verification(group_id, user_id):
    resp = requests.post(
        f"{API_BASE}/api/verify/create",
        json={"group_id": group_id, "user_id": user_id},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    return resp.json()

def check_verification(group_id, code):
    resp = requests.post(
        f"{API_BASE}/api/verify/check",
        json={"group_id": group_id, "code": code},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    return resp.json()

# 1. 创建
result = create_verification(10086, 12345678)
print(f"请访问链接验证: {result['data']['url']}")

# ... 等待用户验证并获取 Code ...
user_provided_code = input("请输入验证码: ")

# 2. 核验
check_result = check_verification(10086, user_provided_code)
if check_result.get("code") == 0:
    print("验证通过！欢迎入群")
else:
    print(f"验证失败: {check_result.get('msg')}")
```
