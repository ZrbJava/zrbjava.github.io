---
title: "React Fiber 与调和机制深度解析"
description: "从 Stack Reconciler 到 Fiber，理解 React 可中断渲染、优先级调度与 Diff 算法的完整链路。"
pubDate: 2026-07-01
category: "React"
tags: ["React", "Fiber", "Reconciliation", "Performance"]
series: "React 工程实践"
seriesOrder: 1
draft: false
featured: true
cover: "/images/covers/react-fiber-reconciliation-deep-dive.svg"
---

数据表格 800 行 + 多列筛选，每次 keystroke 触发全表重算，输入框延迟 300ms+。Profiler 显示 **SyncLane 下的 reconcile 占 180ms 主线程**。用 `startTransition` 把筛选降到 TransitionLane 后，输入 INP 回到 50ms 以内——理解 Fiber 不是为了面试背链表，而是为了**知道该把哪类更新标成可中断**。

## 为什么 Stack Reconciler 不够

递归遍历 VDOM，深度 200 时单次 reconcile 无法让出主线程。用户点击、输入与「重渲染整张表」抢同一条 Sync 路径，就会掉帧。

Fiber 把「一个组件的 reconcile」拆成 **Fiber 工作单元**，用 `child / sibling / return` 链表代替递归栈，配合 Scheduler **可中断、可恢复**。

```ts
type Fiber = {
  tag: WorkTag;
  type: any;
  key: null | string;
  stateNode: any;
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  alternate: Fiber | null;
  flags: Flags;
  lanes: Lanes;
  memoizedProps: any;
  memoizedState: any;
};
```

## 两阶段：render vs commit

| 阶段 | 可中断 | 做什么 |
|------|--------|--------|
| **render** | 是 | 构建 workInProgress 树，打 flags |
| **commit** | 否 | DOM 变更、useLayoutEffect、useEffect 调度 |

commit 又分三步（React 18）：

1. **before mutation** — getSnapshotBeforeUpdate
2. **mutation** — 插入/更新/删除 DOM
3. **layout** — useLayoutEffect

**useEffect** 在 paint 之后异步执行；测量布局应走 useLayoutEffect，但避免长时间阻塞。

## Scheduler 与 workLoop

```ts
// 概念简化：并发模式下时间片
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
  if (workInProgress !== null) {
    // 让出主线程，下次 requestIdleCallback / MessageChannel 继续
    return RootInProgress;
  }
  return RootCompleted;
}
```

`shouldYield()` 默认约 5ms 时间片——不是「每帧一次」，而是 **多次短 burst**。

## Lane 优先级（React 18）

| 触发源 | Lane | 行为 |
|--------|------|------|
| click、keydown | SyncLane | 同步完成 render+commit |
| scroll、mousemove | ContinuousLane | 可中断，但高于 default |
| setState（默认） | DefaultLane | 并发可中断 |
| startTransition | TransitionLane | 最低，常被饿死需配合 useDeferredValue |
| Suspense retry | RetryLane | 重试边界 |

```tsx
const [query, setQuery] = useState('');
const [deferredQuery, setDeferredQuery] = useState('');
const isPending = query !== deferredQuery;

const handleChange = (v: string) => {
  setQuery(v); // 输入框 Sync，立即更新
  startTransition(() => {
    setDeferredQuery(v); // 表格筛选 Transition
  });
};

const filtered = useMemo(
  () => heavyFilter(rows, deferredQuery),
  [rows, deferredQuery],
);
```

表格项目：**筛选 INP 300ms → 48ms**；表格本身仍慢，但输入不再卡。

## Diff 与 key

同层比较；列表用 key Map 复用。`key={index}` 在头部插入会导致 **state 错位**（输入框内容跟错行）。

React 19 相关：**Activity API**（原 Offscreen 演进）可保留隐藏子树的 state 并降低优先级；**useOptimistic** 适合 transition 内的乐观 UI。Concurrent 特性在 19 里更默认，但 Lane 模型仍是底层逻辑。

## 常见误区

| 误区 | 事实 |
|------|------|
| `memo` 万能 |  props 引用变仍 re-render；先 Profiler |
| Concurrent = 多线程 | 仍是单线程，只是可中断 |
| Transition 一定快 | 只保证 **高优任务先响应**，低优总时间可能更长 |

## 实践清单

1. Profiler 找 **Self time 高** 的组件，不是盲目 memo
2. 搜索/筛选/大列表过滤 → `startTransition` + `useDeferredValue`
3. 大列表 → 虚拟滚动（@tanstack/virtual）
4. 读性能问题先问：**这条更新在哪个 Lane？**

Fiber 的价值在于 **把「用户感知延迟」和「后台重计算」拆开**。面试能讲清 render/commit、Lane、Transition，再配一个表格筛选案例，比背 Fiber 链表指针更有说服力。
