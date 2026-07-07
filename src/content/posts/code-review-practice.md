---
title: "我如何做 Code Review"
description: "从正确性、可维护性、测试、性能和团队协作几个维度，整理 Code Review 的关注点。"
pubDate: 2026-05-24
category: "工程化"
tags: ["Code Review", "Team", "Quality"]
series: "工程化与质量体系"
seriesOrder: 1
draft: false
featured: false
cover: "/images/covers/code-review-practice.svg"
---

去年我们一个 PR 把 `localStorage` 当 session 存储，Review 时没人注意到 SameSite 变更后的 XSS 风险，上线三天后安全团队扫出来了。那次之后我把 Review 从「看代码风格」改成了**有清单、有分级、有 SLA** 的流程——这篇是我目前在 8 人前端团队里实际在用的做法。

## Review 分级：Blocking / Major / Nit

不是所有 comment 权重一样。我要求 Reviewer 在每条反馈前标注级别：

| 级别 | 含义 | 是否阻塞合并 |
|------|------|-------------|
| **Blocking** | 正确性、安全、数据丢失风险 | 必须改 |
| **Major** | 架构偏离、可维护性显著下降 | 强烈建议改，可协商 |
| **Nit** | 命名、格式、个人偏好 | 不阻塞 |

```ts
// ❌ Blocking：未处理 Promise rejection，静默吞掉支付失败
async function submitOrder() {
  await api.createOrder(payload); // 无 try/catch，无 loading/error UI
  router.push('/success');
}

// ✅ 期望写法
async function submitOrder() {
  setStatus('submitting');
  try {
    const order = await api.createOrder(payload);
    router.push(`/orders/${order.id}`);
  } catch (err) {
    setStatus('error');
    captureError(err, { step: 'createOrder', payload: sanitize(payload) });
  }
}
```

**Nit 示例**：「这里用 `handleClick` 不如 `onSubmitOrder` 语义清晰」——可以改，但不挡 PR。

团队约定：**Blocking 必须 24h 内响应**；Major 可以留 TODO issue 但要在 PR 描述里写清楚；Nit 超过 3 条同类风格建议时，应该沉淀成 ESLint rule 而不是反复口头说。

## 我实际在审什么（按优先级）

### 1. 正确性与边界

- 空值、分页边界、并发重复提交
- 异步竞态（后发的请求先返回）
- 权限：前端隐藏 ≠ 安全，但要检查是否误导用户

```tsx
// ❌ Major：useEffect 依赖缺失，切换 tab 后仍用旧 id 请求
useEffect(() => {
  fetchDetail(userId);
}, []); // userId 变了不会重新拉

// ✅
useEffect(() => {
  const ac = new AbortController();
  fetchDetail(userId, { signal: ac.signal });
  return () => ac.abort();
}, [userId]);
```

### 2. 可维护性与架构一致性

- 新逻辑是否落在正确的层（见 [组件分层](/posts/component-layering)）
- 是否重复造轮子（项目里已有 `usePagination` 又写一套）
- 类型是否「骗过编译器」（`as any`、过宽的 `Record<string, unknown>`）

### 3. 测试与可观测性

- 核心分支有没有单测；纯 UI 调整可以靠 Storybook + 截图
- 新接口/关键路径是否加了 error breadcrumb 或业务埋点
- 与 [CI 质量门禁](/posts/frontend-ci-quality-gates) 对齐：Coverage 下降的 PR 要解释

### 4. 性能（只审「会伤用户的」）

不纠结微优化，只看：

- 列表是否缺虚拟化（>200 行 DOM）
- 是否在 render 里创建新对象/函数导致子树全量重渲染
- 是否引入大依赖却没做 lazy load

## 真实 PR 审阅示例

假设同事提交了一个「表格批量导出」功能，节选 diff 和我的 comment：

```tsx
// PR 代码
const exportAll = () => {
  const rows = tableData; // 10 万行全在内存
  const csv = rows.map(r => Object.values(r).join(',')).join('\n');
  download(csv);
};
```

> **Blocking**：10 万行同步 `map` + 字符串拼接会阻塞主线程 2–3s，低端机直接 ANR。请改为分页拉取 + `Blob` + `URL.createObjectURL`，或走后端异步导出 + 轮询下载链接。
>
> **Major**：`tableData` 可能是筛选后的子集，导出「全部」应调 `/api/export` 并传当前 filter，而不是前端内存快照。
>
> **Nit**：函数名 `exportAll` 建议改为 `handleExportAll` 与事件 handler 命名一致。

这种 comment **具体、可执行、带原因**——比「这里有问题」有用一个数量级。

## Review 流程与 CI 联动

```
开发者开 PR
    ↓
CI 跑 lint / typecheck / test / bundle（自动）
    ↓
至少 1 名 Reviewer（核心模块 2 名）
    ↓
Blocking 清零 + CI 绿 → merge
    ↓
合并后 24h 内观察监控（错误率、LCP P75）
```

我们用的 PR 模板片段：

```markdown
## 变更说明
- [ ] 用户可见行为变化（附截图/录屏）
- [ ] 需要 QA 回归的路径：___

## Reviewer 请关注
- 并发/权限/金额 相关逻辑在第 ___ 行

## 自测
- [ ] 单测通过 / 新增用例：___
- [ ] 本地 Lighthouse LCP 无回退
```

**不要**在 Review 里争论 Prettier 已经管的事——把风格问题交给 `pnpm lint --fix` 和 pre-commit hook。

## 常见反模式

| 反模式 | 为什么有害 | 替代 |
|--------|-----------|------|
| 「LGTM」不看 diff | 知识无法流动 | 至少扫一遍 Blocking 清单 |
| Review 变成架构辩论 | PR 挂一周 | 大架构先开 RFC，PR 只审实现 |
| 只审不写的人 | 标准双标 | 轮值 Reviewer，每人每周至少 2 个 PR |
| 在 PR 里改需求 | scope creep | 新开 issue/PR |

## 度量：Review 有没有价值

我们每季度看三个数：

1. **Review 后 7 天内 revert 率** — 目标 < 2%
2. **Blocking comment 占比** — 太高说明上游设计/测试不足
3. **PR 从 open 到 merge 的中位时间** — 我们控制在 4h（小 PR）/ 1d（大 PR）

Code Review 的目标不是挑刺，而是**在合并前把线上事故的代价前移**。配合监控（见 [前端监控体系](/posts/frontend-monitoring-system)）和 CI 门禁，Review 才是最后一道人工防线，而不是唯一防线。
