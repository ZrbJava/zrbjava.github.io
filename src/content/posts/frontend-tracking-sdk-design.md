---
title: "前端埋点 SDK 架构设计：从规范到治理"
description: "事件命名规范、自研埋点 SDK、自动/手动/可视化采集、数据治理与漏斗分析的完整工程体系。"
pubDate: 2026-07-05
category: "数据工程"
tags: ["Tracking", "Analytics", "SDK", "Growth"]
series: "数据埋点与增长"
seriesOrder: 1
draft: false
featured: false
cover: "/images/covers/frontend-tracking-sdk-design.svg"
---

Growth 团队要求「活动页加转化漏斗」，工程侧发现 **同一按钮 3 种 event 名、PII 明文进日志**。自研 SDK + Schema 校验 + 可视化圈选上线后，**无效事件从 18% 降到 2%**，新活动埋点从 2 天缩到 2 小时。

## 架构

```
自动 PV/Click ──┐
手动 track ────┼──▶ SDK Core ──▶ IndexedDB 队列 ──▶ 批量上报 ──▶ 网关清洗
可视化圈选 ────┘
```

## 命名规范

```
{域}.{页面}.{动作}.{对象}
commerce.checkout.click.pay_button
```

**禁止** `click1`、`test_event`。CI 校验 event 在白名单 registry。

## SDK Core（生产级）

```ts
class TrackingSDK {
  private queue: Event[] = [];
  private db: IDBDatabase | null = null;
  private flushing = false;

  async init(config: SDKConfig) {
    this.db = await openDB('track_queue');
    await this.restoreQueueFromIDB();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush({ useBeacon: true });
    });
    setInterval(() => this.flush(), config.flushInterval ?? 5000);
  }

  track(event: string, properties?: Record<string, unknown>) {
    const err = validateSchema(event, properties);
    if (err) {
      console.warn('[track]', err);
      return;
    }
    const ev = this.buildEvent(event, properties);
    this.queue.push(ev);
    if (this.queue.length >= 20) void this.flush();
  }

  async flush(opts?: { useBeacon?: boolean }) {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, 50);
    try {
      const body = JSON.stringify(batch);
      if (opts?.useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/track/batch', body);
      } else {
        await fetch('/api/track/batch', { method: 'POST', body, keepalive: true });
      }
      await this.clearIDBBatch(batch);
    } catch {
      this.queue.unshift(...batch);
      await this.persistToIDB(batch);
    } finally {
      this.flushing = false;
    }
  }

  private buildEvent(event: string, properties?: Record<string, unknown>) {
    return {
      event_id: crypto.randomUUID(),
      event,
      timestamp: Date.now(),
      user_id: this.getUserId(),
      session_id: this.getSessionId(),
      properties: { ...this.commonProps(), ...sanitize(properties) },
    };
  }
}
```

**Offline**：失败写 IndexedDB，下次启动重试。`sendBeacon` 应对 tab 关闭。

## 可视化圈选 DOM 路径

```ts
function getSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part += `#${CSS.escape(node.id)}`;
      parts.unshift(part);
      break;
    }
    const parent = node.parentElement;
    if (parent) {
      const siblings = [...parent.children].filter((c) => c.tagName === node!.tagName);
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
}
```

圈选配置存服务端，SDK 按 selector 委托 click。**冲突时** manual track 优先。

## 三种采集模式

| 模式 | 适用 | 注意 |
|------|------|------|
| 自动 | PV、路由 | SPA 监听 history |
| 手动 | 转化、金额 | code review 必审 |
| 圈选 | 运营迭代 | 需版本号 + 审计 |

## 治理

1. **Schema**：ajv 校验 properties 类型
2. **去重**：`event_id` 网关 24h 去重
3. **采样**：`page_scroll` 类 10%
4. **隐私**：手机号 hash；GDPR 区域 opt-out 开关

## 漏斗与 A/B（前端侧）

```ts
track('experiment.exposure', { exp_id: 'checkout_btn', variant: 'B' });
```

实验 variant 进 commonProps，分析端 join 转化事件。

埋点是数据工程：**规范、SDK 可靠性、治理比多 track 一行重要**。没有 Schema 的埋点债，六个月后会还。
