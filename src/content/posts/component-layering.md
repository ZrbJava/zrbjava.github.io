---
title: "大型项目中的组件分层与状态管理"
description: "总结复杂前端项目中组件职责、状态边界和跨模块协作的组织方式。"
pubDate: 2026-06-12
category: "React"
tags: ["React", "State Management", "Design System"]
series: "React 工程实践"
seriesOrder: 4
draft: false
featured: false
cover: "/images/covers/component-layering.svg"
---

接手一个 40 万行 React 中后台时，最先爆雷的不是性能，而是**没人说得清某个 state 该放哪**。同一个 `userList` 在 Page、Context、Redux 和 React Query 里各有一份，改一个 filter 四个地方不同步。重构后我们按下面的分层约定，**跨模块 bug 季度内下降约 60%**。

## 推荐目录结构

```
src/
├── app/                    # 路由、全局 Provider、ErrorBoundary
│   ├── routes.tsx
│   └── providers.tsx
├── pages/                  # 路由级页面，只做编排，少 UI 细节
│   └── order-list/
│       ├── index.tsx       # 组装 hooks + 布局
│       └── useOrderListPage.ts
├── features/               # 业务域模块（可独立理解的一块能力）
│   └── order/
│       ├── components/     # 仅 order 域使用的 UI
│       ├── hooks/
│       ├── api/
│       └── types.ts
├── shared/                 # 跨域复用（无业务名词）
│   ├── ui/                 # Button, Table, Modal（设计系统）
│   ├── hooks/              # useDebounce, useMediaQuery
│   └── utils/
└── entities/               # 可选：领域模型 + 规范化（user, product）
    └── user/
        ├── model.ts
        └── api.ts
```

**边界规则**：

- `pages/` **不能**被 `features/` import（防止反向依赖）
- `features/order` **不能** import `features/invoice` 内部文件；共享逻辑上提 `shared/` 或 `entities/`
- `shared/ui` **禁止**出现「订单」「审批」等业务词汇

## 四层职责

| 层 | 职责 | 示例 |
|----|------|------|
| **Page** | 路由参数、权限守卫、布局、组合 feature | `OrderListPage` 拉 `useOrderList` + 挂 Filter |
| **Feature** | 领域交互、业务组件、域内 hooks | `OrderTable`, `useCancelOrder` |
| **Shared UI** | 无业务、可 Storybook 独立展示 | `DataTable`, `ConfirmDialog` |
| **Data** | 请求、缓存、DTO→ViewModel | React Query hooks, `orderApi.ts` |

```tsx
// pages/order-list/index.tsx — 薄页面
export function OrderListPage() {
  const { filters, setFilters } = useOrderListFilters();
  const { data, isLoading } = useOrderListQuery(filters);

  return (
    <PageLayout title="订单列表">
      <OrderFilter value={filters} onChange={setFilters} />
      <OrderTable rows={data?.items ?? []} loading={isLoading} />
    </PageLayout>
  );
}
```

```tsx
// features/order/components/OrderTable.tsx — 业务 UI
export function OrderTable({ rows, loading }: Props) {
  const cancel = useCancelOrderMutation();
  return (
    <DataTable
      columns={orderColumns}
      data={rows}
      loading={loading}
      onRowAction={(id) => cancel.mutate(id)}
    />
  );
}
```

## 状态归属决策树

```
这个 state 是谁的「真相源」？
    │
    ├─ 服务端数据（列表、详情）→ React Query / SWR（不要抄进 Redux）
    │
    ├─ URL 可分享（筛选、分页、tab）→ URL searchParams
    │
    ├─ 跨多 feature 但限本页 → Page 层 useState + props
    │
    ├─ 跨路由、全局 UI（主题、侧边栏折叠）→ Context 或 Zustand 小 store
    │
    └─ 复杂域内表单/向导 → feature 内 useReducer 或 React Hook Form
```

**反例**：把「当前页表格排序」放全局 Redux——别的页面也挂载同一 reducer key，测试和调试都是噩梦。

### 与 React Query 的分工

```tsx
// entities/order/api.ts
export function useOrderListQuery(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => fetchOrders(filters),
    staleTime: 30_000,
  });
}

// 派生 UI 状态留在 feature
function useOrderListFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseFilters(searchParams);
  const setFilters = (next: OrderFilters) =>
    setSearchParams(serializeFilters(next));
  return { filters, setFilters };
}
```

服务器状态 **不要** 再 mirror 到 Zustand；只缓存 UI 态和乐观更新中间态。

## 反模式（我们真实踩过的）

### 1. 巨型 Page 组件

600 行的 `UserManagement.tsx` 里既有 API、又有 modal、又有表格列定义。

**拆法**：列定义 → `features/user/columns.tsx`；modal → `UserEditModal`；API → `useUserMutations`。

### 2. 「万能 hooks」文件夹

根目录 `hooks/useEverything.ts` 被 30 个模块引用，改一行全站回归。

**拆法**：hooks 跟 feature 走；只有真正通用的才进 `shared/hooks`。

### 3. 设计系统掺业务

`shared/ui/OrderStatusTag` 应该叫 `features/order/OrderStatusTag`。设计系统只接受 `variant: 'success' | 'warning'` 这种抽象。

## 跨模块协作

Feature 之间需要通信时，优先级：

1. **URL / 路由** — 最清晰（从订单跳发票带 `?orderId=`）
2. **事件总线（轻量）** — 极少用；`mitt` 发 `order:cancelled`
3. **共享 entity store** — 仅「当前登录用户」这类真正全局的

避免 feature A 直接 `import { InternalModal } from '../feature-b'`。

## 和权限、表单的关系

- 路由级权限在 `app/routes` 守卫（见 [权限系统](/posts/frontend-permission-system)）
- 按钮级在 feature 组件内 `usePermission('order:cancel')`
- 复杂表单状态留在 `features/xxx/forms`，不要提升到 Page（见 [复杂表单架构](/posts/react-complex-form-architecture)）

## 落地检查清单

- [ ] 新文件能一句话说清属于哪一层
- [ ] `features/*` 之间无直接 import
- [ ] 列表/详情数据来自 Query，无手写 `useEffect` fetch
- [ ] 可分享状态进 URL
- [ ] Page 文件 < 150 行，否则继续拆

分层的目的不是炫目录，而是**让改一处的人知道会影响谁**。清晰边界比「全局状态一把梭」更适合活过三个迭代周期的中后台。
