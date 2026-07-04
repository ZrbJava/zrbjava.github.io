---
title: "大型项目中的组件分层与状态管理"
description: "总结复杂前端项目中组件职责、状态边界和跨模块协作的组织方式。"
pubDate: 2026-06-12
category: "React"
tags: ["React", "State Management", "Design System"]
series: "React 工程实践"
draft: false
featured: false
---

组件分层的目的不是制造目录层级，而是降低协作成本。

## 常见分层

- 页面层：负责路由和业务流程编排
- 业务组件层：负责领域对象的交互表达
- 基础组件层：负责稳定、通用、低业务耦合的 UI 能力
- 数据层：负责请求、缓存和领域模型转换

## 状态归属

状态应该放在“最理解它生命周期”的地方。全局状态不是共享的默认答案，很多状态只需要局部存在。
