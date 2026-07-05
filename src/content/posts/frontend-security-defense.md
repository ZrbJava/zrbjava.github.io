---
title: "前端安全攻防：XSS、CSRF 与 CSP"
description: "常见 Web 攻击原理、防御策略、Content Security Policy 配置与 Electron 安全加固。"
pubDate: 2026-06-16
category: "浏览器原理"
tags: ["Security", "XSS", "CSRF", "CSP"]
series: "浏览器与网络底层"
draft: false
featured: false
---

安全是高级前端必须掌握的领域。不需要成为安全专家，但要能在项目中**识别风险、实施防御、通过安全审计**。

## XSS（跨站脚本攻击）

### 三种类型

| 类型   | 注入点                 | 特点               |
| ------ | ---------------------- | ------------------ |
| 存储型 | 数据库（评论、用户名） | 危害最大，持久存在 |
| 反射型 | URL 参数               | 需要诱骗用户点击   |
| DOM 型 | 前端 JS 直接操作 DOM   | 不经过服务端       |

### 防御策略

```tsx
// ❌ 危险：直接渲染用户输入
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ React 默认转义
<div>{userInput}</div>

// ✅ 必须渲染 HTML 时用 DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

```js
// ❌ 危险：eval 和 innerHTML
eval(userInput);
element.innerHTML = userInput;

// ✅ 安全替代
element.textContent = userInput;
JSON.parse(userInput); // 而非 eval
```

## CSRF（跨站请求伪造）

### 攻击原理

```
1. 用户登录 bank.com，Cookie 有效
2. 用户访问 evil.com
3. evil.com 页面：<img src="bank.com/transfer?to=hacker&amount=1000">
4. 浏览器自动携带 bank.com 的 Cookie 发起请求
```

### 防御方案

```ts
// 1. CSRF Token
// Server 生成 token，嵌入表单/meta 标签
<meta name="csrf-token" content="abc123" />
// Client 每次请求携带
headers: { 'X-CSRF-Token': getCsrfToken() }

// 2. SameSite Cookie
Set-Cookie: session=xxx; SameSite=Strict; Secure; HttpOnly

// 3. 验证 Origin/Referer Header
if (req.headers.origin !== 'https://myapp.com') reject();
```

## CSP（Content Security Policy）

CSP 是浏览器端的「白名单防火墙」：

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
  default-src 'self';
  script-src 'self' https://cdn.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
"
/>
```

**关键指令：**

- `script-src`：控制 JS 来源，`'nonce-xxx'` 允许特定内联脚本
- `frame-ancestors`：防止点击劫持（替代 X-Frame-Options）
- `report-uri`：违规报告收集

### CSP 报告监控

```ts
// 收集 CSP 违规报告
app.post("/api/csp-report", (req, res) => {
  const report = req.body["csp-report"];
  logger.warn("CSP Violation", {
    blockedUri: report["blocked-uri"],
    violatedDirective: report["violated-directive"],
    sourceFile: report["source-file"],
  });
  res.status(204).end();
});
```

## 其他安全 Headers

```ts
// Next.js 配置示例
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
```

## 前端安全检查清单

- [ ] 所有用户输入都经过转义或 sanitize
- [ ] API 请求携带 CSRF Token
- [ ] Cookie 设置 HttpOnly + Secure + SameSite
- [ ] 配置 CSP Header
- [ ] 依赖定期扫描（npm audit / Snyk）
- [ ] 敏感操作二次确认
- [ ] API Key 不在客户端暴露
- [ ] 生产环境关闭 Source Map 公开访问

## Electron 特有安全

```ts
// BrowserWindow 安全配置
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  enableRemoteModule: false, // 已废弃
}
```
