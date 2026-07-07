---
title: "埋点数据分析：漏斗、留存与 A/B"
description: "事件模型、漏斗 SQL 思路、 cohort 留存、实验分流与前端埋点质量校验。"
pubDate: 2026-07-16
category: "数据工程"
tags: ["Analytics", "Funnel", "A/B Test", "Tracking"]
series: "数据埋点与增长"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/frontend-analytics-funnel-retention.svg"
---

> **前置阅读**：[前端埋点 SDK 设计](/posts/frontend-tracking-sdk-design) · **本专题第 2 篇**

埋点 SDK 解决 **采集合规与送达**；增长分析解决 **事件能不能回答业务问题**。这篇从前端视角讲漏斗、留存、A/B—— enough 和数分/PM 对齐口径，并知道埋点该怎么改。

## 事件模型回顾

```
用户行为 → track(event, properties)
         → 服务端清洗 → 数仓 fact 表
         → 漏斗 / 留存 / 实验 看板
```

必备字段（与 [SDK 文](/posts/frontend-tracking-sdk-design) 一致）：`event`、`userId`、`sessionId`、`timestamp`、`page`、`props` 业务维度。

**命名**：`object_action` 如 `order_submit_click`，禁止 `click1`、`test`。

## 漏斗分析

典型注册漏斗：

```
landing_view → signup_start → signup_complete → first_purchase
```

前端要确保：

1. 每步 **唯一事件**，不重复 fire（防抖 / once flag）
2. 失败步有 `signup_fail` + `reason` 枚举
3. 步骤间 **session 连续**，换页不丢 sessionId

数仓侧漏斗是 **有序事件在窗口内是否都出现**（如 7 天内）。前端改流程（加一步 OTP）必须 **版本化 funnel 定义**，否则环比失真。

## 留存（Cohort）

「注册后第 N 天仍活跃」需要 **anchor 事件**（如 `signup_complete`）+ **回访事件**（如 `app_open`）。

前端贡献：

- anchor 时间戳准确（服务端时间为准）
- 回访事件不过度触发（前台切换 ≠ 活跃，需产品定义）

## A/B 实验

```
用户进组（sticky assignment）
  → 前端读 variant（config / flag）
  → 渲染 B 版 UI
  → 曝光事件 experiment_exposure
  → 转化事件与对照组同一口径
```

| 要点 | 说明 |
|------|------|
| 分流 | 服务端或 edge 分，前端不 `Math.random()` 各自为政 |
| 曝光 | 看见 B 版才打 exposure，防未渲染算进组 |
| 指标 | 一个实验一个 primary metric |

```ts
track('experiment_exposure', {
  experimentId: 'checkout_btn_color',
  variant: 'green',
});
```

## 埋点质量校验

- **Schema 校验**：CI 里 event 必填字段检查
- **Debug 模式**：开发环境 console 表格式打印 payload
- **对账**：日活 DAU 与业务库注册数量级比对，偏差 >5% 告警

## 自测清单

- [ ] 能设计一个 3 步漏斗的事件名与 props
- [ ] 知道 anchor / return 事件在留存里的含义
- [ ] A/B 有 exposure 事件且 variant sticky
- [ ] 失败路径有独立事件 + reason

---

**系列回顾**：[第 1 篇 · 埋点 SDK](/posts/frontend-tracking-sdk-design) · [数据埋点专题](/topics/data-tracking)
