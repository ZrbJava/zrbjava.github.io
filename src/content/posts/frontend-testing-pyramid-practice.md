---
title: "前端测试金字塔：单测、组件测与 E2E"
description: "Vitest + Testing Library 单元测试、MSW 契约、Playwright E2E 与 CI 门禁的落地配比。"
pubDate: 2026-07-15
category: "工程化"
tags: ["Testing", "Vitest", "Playwright", "MSW"]
series: "工程化与质量体系"
seriesOrder: 2
draft: false
featured: false
cover: "/images/covers/frontend-testing-pyramid-practice.svg"
---

> **前置阅读**：[Code Review 实践](/posts/code-review-practice) · **本专题第 2 篇**

测试不是「覆盖率 KPI」，而是 **让重构敢动手**。我们中后台项目的配比大致：**70% 单测 / 20% 组件测 / 10% E2E**，与 [CI 质量门禁](/posts/frontend-ci-quality-gates) 里的 PR 阻断规则配套。

## 金字塔

```
        E2E（关键路径 5–10 条）
      组件测（复杂表单、权限按钮）
    单测（utils、hooks、纯函数）
```

**不要**倒金字塔——全 E2E 慢且脆，全单测测不到路由与真实 DOM。

## 单测：Vitest

```ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './format';

describe('formatCurrency', () => {
  it('formats CNY with grouping', () => {
    expect(formatCurrency(1234.5, 'CNY')).toBe('¥1,234.50');
  });
});
```

优先测：**纯函数、hooks 逻辑（renderHook）、 reducer**。Mock _fetch 用 MSW，不要 mock 整个 axios 实现。

## 组件测：Testing Library

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('disables submit when form invalid', async () => {
  render(<OrderForm />);
  expect(screen.getByRole('button', { name: '提交' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('数量'), '1');
  expect(screen.getByRole('button', { name: '提交' })).toBeEnabled();
});
```

原则：**测行为不测实现**——不 snapshot 整棵 DOM，不断言 `state.count`。

## MSW 契约

```ts
http.get('/api/orders/:id', ({ params }) => {
  return HttpResponse.json({ code: 0, data: { id: params.id, status: 'paid' } });
});
```

与 [TypeScript 契约](/posts/typescript-api-contract-modeling) 结合：响应 body 可 zod parse 在 handler 里做 fixture 校验。

## E2E：Playwright

只覆盖 **钱、权限、发布** 相关路径，例如：

- 登录 → 创建订单 → 支付结果页
- 无权限用户看不到「删除」且 API 403

```ts
test('guest cannot access admin', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/login/);
});
```

CI 里 E2E 并行 2–3 workers，失败 artifact 存 trace。

## 与 Code Review 配合

| Review 点 | 测试要求 |
|-----------|----------|
| 新 util | 至少 1 个单测 |
| 新 API 集成 | MSW fixture + 1 组件测 |
| 新核心流程 | 考虑 E2E 或补 issue |

## 常见坑

1. **测 implementation details** — 改 class 名全挂
2. **waitFor 滥用** — 应用 `findBy*` 或正确 async
3. **CI 不跑测试** — 覆盖率只本地看
4. **flake E2E** — 缺 `data-testid`、动画未 `waitForLoadState`

## 自测清单

- [ ] 项目有 Vitest + Testing Library 基架
- [ ] 核心 util/hook 有单测
- [ ] API 用 MSW 或 contract fixture
- [ ] ≥1 条 Playwright 冒烟在 CI 跑

---

**系列回顾**：[第 1 篇 · Code Review](/posts/code-review-practice) · [质量体系专题](/topics/frontend-quality)
