---
title: "小程序登录、支付与订阅消息实战"
description: "wx.login 会话、code2Session、支付签名、订阅消息模板与前后端协作的安全边界。"
pubDate: 2026-07-10
category: "跨端开发"
tags: ["Mini Program", "WeChat", "Payment", "Auth"]
series: "小程序全栈开发"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/mini-program-login-payment-flow.svg"
---

> **前置阅读**：[微信小程序架构与性能](/posts/wechat-mini-program-architecture) · **本专题第 2 篇**

小程序业务闭环里，**登录、支付、订阅消息**是最容易踩坑的三段。双线程模型下它们都涉及「前端触发 + 服务端验签」，任何一步 secret 进包或 session 存错地方都会出事故。

## 登录链路

```
用户打开小程序
  → wx.login() 得 code（5min 有效，一次性）
  → 前端 POST /auth/wx { code }
  → 服务端 code2Session → openid + session_key
  → 服务端签发自有 JWT / session
  → 前端存 token（内存 + 必要时加密 storage）
```

**禁止**：把 `session_key` 下发给前端；禁止用 openid 当登录态唯一凭证而不验签。

```ts
// 服务端（伪代码）
const { openid, session_key } = await wx.code2Session(code);
const token = signJwt({ openid, appId }, SECRET, '7d');
return { token, expiresIn: 604800 };
```

前端请求带 `Authorization: Bearer ${token}`；401 时清 token 并 `wx.login` 重走。

## 支付链路

```
前端 wx.requestPayment({ timeStamp, nonceStr, package, signType, paySign })
  ↑ 参数全部由服务端生成
用户确认支付
  → 微信异步通知 notify_url
  → 服务端验签 + 更新订单（幂等）
  → 前端轮询 / WebSocket 查订单状态
```

| 步骤 | 前端 | 服务端 |
|------|------|--------|
| 下单 | 传 skuId、数量 | 创建预支付单，调 unifiedorder |
| 调起支付 | `requestPayment` | 返回签名参数 |
| 结果 | 查单，不信客户端「成功」 | 以 notify 为准 |

**坑**：用户支付成功但前端回调 fail（切后台）——必须靠 **服务端 notify + 查单** 确认，不能仅信 `success` 回调。

## 订阅消息

订阅消息需要 **用户主动触发**（button `open-type="subscribe"`），不能启动就弹。

```xml
<button open-type="subscribe" bindtap="onSubscribe">
  订阅发货通知
</button>
```

服务端保存 `templateId + openid` 授权记录；发货时调 `subscribeMessage.send`，注意频次与类目审核。

## 安全清单

- [ ] AppSecret、商户 key 只在服务端
- [ ] 支付 notify 验签 + 幂等（订单号去重）
- [ ] JWT 有过期与 refresh 策略
- [ ] 敏感接口仍走服务端鉴权，不信任 openid 明文传参

## 与 H5 / App 打通

同一用户多端 identity 需要 **UnionID**（开放平台绑定）。BFF 层统一 `userId`，小程序只认 BFF token，不各端各搞一套 session。

## 自测清单

- [ ] 能口述 code → token 全流程
- [ ] 能解释为何支付结果以 notify 为准
- [ ] 订阅消息知道必须用户点击触发
- [ ] 画得出登录/支付时序图

---

**系列回顾**：[第 1 篇 · 架构与性能](/posts/wechat-mini-program-architecture) · [小程序专题](/topics/mini-program)
