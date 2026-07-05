---
title: "Pinia 状态管理设计与大型 Vue 项目实践"
description: "Pinia Store 设计模式、模块化拆分、持久化策略与 Vuex 迁移的完整指南。"
pubDate: 2026-06-30
category: "Vue"
tags: ["Vue", "Pinia", "State Management"]
series: "Vue 3 生态与架构"
draft: false
featured: false
---

Pinia 是 Vue 3 官方推荐的状态管理方案，解决了 Vuex 的 TypeScript 支持和模块嵌套问题。在高级前端面试中，你需要展示的不只是 API 用法，而是**Store 如何与业务模块对齐**。

## Pinia vs Vuex 核心差异

| 维度 | Vuex 4 | Pinia |
|------|--------|-------|
| Mutation | 必需 | 无（直接修改 state） |
| Module | 嵌套命名空间 | 扁平 Store |
| TypeScript | 需要大量类型体操 | 原生 TS 支持 |
| DevTools | 支持 | 支持 |
| SSR | 需要额外配置 | 内置支持 |
| 体积 | ~3KB | ~1.5KB |

## Store 设计模式

### 按领域拆分

```ts
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile | null>(null);
  const permissions = ref<string[]>([]);

  const isAdmin = computed(() => permissions.value.includes('admin'));

  async function fetchProfile() {
    profile.value = await userApi.getProfile();
    permissions.value = await userApi.getPermissions();
  }

  return { profile, permissions, isAdmin, fetchProfile };
});
```

### Setup Store vs Options Store

```ts
// Setup Store（推荐，Composition API 风格）
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([]);
  const total = computed(() => items.value.reduce((sum, i) => sum + i.price, 0));
  function addItem(item: CartItem) { items.value.push(item); }
  return { items, total, addItem };
});

// Options Store（Vuex 迁移友好）
export const useSettingsStore = defineStore('settings', {
  state: () => ({ theme: 'light' as 'light' | 'dark' }),
  actions: {
    toggleTheme() { this.theme = this.theme === 'light' ? 'dark' : 'light'; },
  },
});
```

## 持久化策略

```ts
// 使用 pinia-plugin-persistedstate
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  return { token };
}, {
  persist: {
    key: 'auth',
    storage: sessionStorage, // 敏感数据用 sessionStorage
    paths: ['token'],         // 只持久化必要字段
  },
});
```

**安全原则：**

- Token 存 sessionStorage，不存 localStorage
- 敏感 Store 不持久化
- 持久化数据需要版本号和迁移策略

## 组件中使用 Store

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
// ✅ 解构响应式 state
const { profile, isAdmin } = storeToRefs(userStore);
// ✅ action 可以直接解构
const { fetchProfile } = userStore;
</script>
```

## 大型项目治理

1. **Store 不超过 15 个**：超过说明拆分粒度有问题
2. **Store 之间不互相 import**：通过 Composable 组合
3. **异步逻辑放 actions/composables**：Store 只做状态容器
4. **用 `$reset` 和 `$patch` 批量更新**：避免多次触发响应式

## Vuex 迁移路径

```
1. 安装 Pinia，与 Vuex 共存
2. 新模块直接用 Pinia
3. 旧 Vuex module 逐个迁移：
   - state → ref/reactive
   - getters → computed
   - mutations → 直接修改（Pinia 无 mutation）
   - actions → 同名函数
4. 全部迁移后移除 Vuex
```

## 面试追问

**Q：Pinia 为什么不需要 mutation？**

Pinia 的设计哲学是「mutation 是 Vuex 为了 DevTools 时间旅行而引入的复杂度」。Pinia 通过 `$patch` 和 DevTools 集成实现了同样的调试能力，同时简化了 API。

**Q：Pinia 和 Composable 的边界？**

- 跨组件共享 → Pinia Store
- 单组件或父子组件 → Composable
- 服务端数据 → TanStack Query / useFetch
