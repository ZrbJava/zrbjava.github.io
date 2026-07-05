---
title: "React Fiber 与调和机制深度解析"
description: "从 Stack Reconciler 到 Fiber，理解 React 可中断渲染、优先级调度与 Diff 算法的完整链路。"
pubDate: 2026-07-01
category: "React"
tags: ["React", "Fiber", "Reconciliation", "Performance"]
series: "React 工程实践"
draft: false
featured: true
---

React 16 引入 Fiber 架构，本质上是为了解决 Stack Reconciler 的两个致命问题：**渲染过程不可中断**和**无法区分更新优先级**。作为 8 年经验的前端，理解 Fiber 不是背概念，而是要在面试和项目中回答「React 为什么需要可中断渲染」以及「Concurrent Mode 如何影响你的业务代码」。

## 为什么需要 Fiber

Stack Reconciler 采用递归遍历 Virtual DOM，一旦开始就无法暂停。当组件树很深或单次更新计算量大时，主线程会被长时间占用，导致输入延迟、动画掉帧。

Fiber 把递归拆成**可中断的工作单元**（Fiber Node），每个 Fiber 节点对应一个组件实例，通过 `child`、`sibling`、`return` 三个指针构成链表树，遍历变成循环：

```ts
// Fiber 节点的核心结构（简化）
type Fiber = {
  type: any;
  key: string | null;
  stateNode: any;
  return: Fiber | null;   // 父节点
  child: Fiber | null;    // 第一个子节点
  sibling: Fiber | null;  // 下一个兄弟节点
  alternate: Fiber | null; // 对应 current tree 的节点
  flags: number;          // 副作用标记
  lanes: Lanes;         // 优先级车道
};
```

## 双缓冲：current 与 workInProgress

React 维护两棵 Fiber 树：

- **current tree**：当前屏幕上渲染的内容
- **workInProgress tree**：正在构建的新树

更新完成后，两棵树指针互换（`root.current = finishedWork`），这个过程叫 **commit**，是不可中断的。而 **render 阶段**（构建 workInProgress tree）是可中断的。

## 调度优先级：Lane 模型

React 18 用 Lane（位掩码）表达优先级，不同事件触发不同 Lane：

| 触发源 | 典型 Lane | 优先级 |
|--------|-----------|--------|
| 离散输入（click） | SyncLane | 最高 |
| 连续输入（scroll） | ContinuousLane | 高 |
| 默认 setState | DefaultLane | 中 |
| Transition | TransitionLane | 低 |
| Suspense | RetryLane | 最低 |

`startTransition` 包裹的更新会被标记为 TransitionLane，React 可以在渲染过程中被更高优先级更新打断。

## Diff 算法三策略

React 的 Diff 基于两个假设：

1. 不同类型的元素会产生不同的树
2. 开发者可以通过 key 标识哪些子元素是稳定的

同层比较规则：

- **type 不同**：直接卸载旧树，挂载新树
- **type 相同**：复用 DOM，只更新 props
- **列表 diff**：从左到右比对，遇到 key 不一致时用 Map 查找可复用节点

```jsx
// key 的正确用法：稳定且唯一
{items.map(item => (
  <ListItem key={item.id} data={item} />
))}

// 错误：用 index 作为 key，在插入/删除时会导致状态错乱
{items.map((item, index) => (
  <ListItem key={index} data={item} />
))}
```

## 面试高频追问

**Q：useEffect 和 useLayoutEffect 的执行时机？**

- `useLayoutEffect` 在 DOM 变更后、浏览器绘制前同步执行
- `useEffect` 在浏览器绘制后异步执行
- SSR 场景下两者都不应在服务端执行副作用

**Q：React 18 的 Automatic Batching 是什么？**

React 18 之前，只有 React 事件处理器内的 setState 会批量更新。18 之后，Promise、setTimeout、原生事件中的多次 setState 也会合并为一次渲染。

**Q：如何向面试官展示 Fiber 的实际价值？**

结合项目案例：「我们的数据表格有 500+ 行，筛选时会卡顿。通过 `startTransition` 把筛选状态标记为低优先级，输入框响应从 300ms 降到 50ms。」

## 实践建议

1. 用 React DevTools Profiler 定位渲染瓶颈，而不是盲目 memo
2. 大列表用虚拟滚动（react-window / @tanstack/virtual）
3. 状态更新分「紧急」和「可延迟」，配合 `useDeferredValue`
4. 理解 Fiber 后，Concurrent Features（Suspense、Transitions）才有正确使用场景
