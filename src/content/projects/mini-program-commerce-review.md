---
title: "小程序商城从 0 到 1 工程复盘"
description: "复盘微信小程序商城的分包策略、支付链路、性能优化与 Taro 跨端落地的完整过程。"
pubDate: 2026-06-20
role: "小程序前端负责人"
stack: ["WeChat", "Taro", "Mini Program", "Payment"]
featured: true
---

## 项目背景

业务需要从 H5 商城迁移到微信小程序，支持商品浏览、购物车、微信支付，DAU 目标 10 万+。

## 核心难点

- 主包 2MB 限制 vs 功能完整性
- setData 性能导致列表卡顿
- 微信支付 + 登录 + 订阅消息的链路复杂度
- H5 代码复用 vs 小程序原生体验

## 方案设计

```mermaid
flowchart TB
  Main[主包: 首页/分类/购物车]
  Shop[分包A: 商品详情/搜索]
  User[分包B: 个人中心/订单]
  Pay[分包C: 支付/地址]
  Main --> Shop
  Main --> User
  Shop --> Pay
```

## 关键优化

| 优化            | 前    | 后    |
| --------------- | ----- | ----- |
| 主包体积        | 1.9MB | 1.1MB |
| 首屏时间        | 2.8s  | 1.6s  |
| 列表帧率        | 42fps | 58fps |
| setData 次数/秒 | 15    | 3     |

## 结果收益

- DAU 12 万，支付转化率提升 23%
- 列表虚拟滚动 + 组件级 setData 根治卡顿
- Taro 跨端代码复用率 70%

## 反思

小程序的性能模型和 Web 完全不同，不能简单「编译过去」，需要在架构层做组件拆分和 setData 治理。
