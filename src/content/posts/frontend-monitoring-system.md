---
title: "前端监控体系：错误、性能与用户行为"
description: "从错误采集、性能指标、用户行为和告警策略几个角度，搭建可用于排障的监控体系。"
pubDate: 2026-06-02
category: "工程化"
tags: ["Monitoring", "Engineering", "Observability"]
series: "性能优化与可观测性"
draft: false
featured: false
---

监控体系的价值在于缩短问题发现和定位时间。

## 采集什么

基础采集包括 JS 错误、资源错误、接口错误、Web Vitals、页面访问路径和关键业务事件。

## 如何使用

监控数据不能只堆在平台里。它需要和版本、环境、用户、页面、接口、设备信息关联，才能支持有效排障。
