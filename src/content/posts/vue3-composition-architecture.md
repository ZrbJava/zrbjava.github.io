---
title: "Vue 3 Composition API 架构设计实践"
description: "Composable 设计模式、逻辑复用边界、与 Options API 的迁移策略及大型项目模块组织。"
pubDate: 2026-06-29
category: "Vue"
tags: ["Vue", "Composition API", "Composable", "Architecture"]
series: "Vue 3 生态与架构"
draft: false
featured: false
---

Composition API 不是语法糖，而是一种**逻辑组织范式**。8 年经验的前端在 Vue 3 项目中最常见的失败模式是：把 Options API 的代码原样搬进 `setup()`，导致 500 行的 setup 函数。

## Composable 设计原则

一个好的 Composable 应该：

1. **单一职责**：一个 Composable 解决一个问题
2. **显式输入输出**：参数和返回值类型清晰
3. **可组合**：小 Composable 组合成大 Composable
4. **副作用可控**：明确何时创建/销毁资源

```ts
// ✅ 好的 Composable 设计
export function usePagination(options: {
  fetchFn: (page: number, size: number) => Promise<PaginatedResult>;
  pageSize?: number;
}) {
  const page = ref(1);
  const pageSize = ref(options.pageSize ?? 20);
  const total = ref(0);
  const data = ref<any[]>([]);
  const loading = ref(false);

  async function load() {
    loading.value = true;
    try {
      const result = await options.fetchFn(page.value, pageSize.value);
      data.value = result.items;
      total.value = result.total;
    } finally {
      loading.value = false;
    }
  }

  watch([page, pageSize], load, { immediate: true });

  return { page, pageSize, total, data, loading, refresh: load };
}
```

## 项目模块组织

```
src/
├── composables/          # 通用 Composable
│   ├── usePagination.ts
│   ├── usePermission.ts
│   └── useWebSocket.ts
├── features/             # 业务功能模块
│   ├── order/
│   │   ├── composables/useOrderForm.ts
│   │   ├── components/OrderForm.vue
│   │   └── api/orderApi.ts
│   └── user/
│       ├── composables/useUserProfile.ts
│       └── components/UserCard.vue
```

**规则：通用 Composable 放 `composables/`，业务 Composable 放 `features/*/composables/`。**

## 与 React Hooks 的对比

| 维度     | Vue Composable               | React Hook            |
| -------- | ---------------------------- | --------------------- |
| 调用限制 | 无限制（可在条件分支中调用） | 不可在条件/循环中调用 |
| 依赖追踪 | 自动（ref/reactive）         | 手动（deps 数组）     |
| 命名约定 | `use` 前缀                   | `use` 前缀            |
| 状态隔离 | 每次调用独立 ref             | 每次调用独立 state    |

Vue Composable 的一个独特优势：**可以在任何地方调用**，不受 Hooks 规则限制。

## Options API 迁移策略

不要一次性重写，按模块渐进迁移：

```
Phase 1: 新功能全部用 Composition API + <script setup>
Phase 2: 高频修改的旧模块逐步迁移
Phase 3: 稳定模块保持 Options API，不强制迁移
```

`<script setup>` 是推荐的默认写法：

```vue
<script setup lang="ts">
import { useOrderForm } from "./composables/useOrderForm";

const props = defineProps<{ orderId?: string }>();
const emit = defineEmits<{ submit: [order: Order] }>();

const { form, validate, submit, loading } = useOrderForm(props.orderId);

async function handleSubmit() {
  if (!(await validate())) return;
  const order = await submit();
  emit("submit", order);
}
</script>
```

## 常见反模式

1. **God Composable**：一个 `useApp()` 返回所有状态 → 拆分为领域 Composable
2. **Composable 中直接操作 DOM** → 封装为 `useElementSize` 等专用 Composable
3. **Composable 之间循环依赖** → 提取共享逻辑到第三个 Composable
4. **忽略 cleanup** → `onUnmounted` 中清理定时器、事件监听、WebSocket
