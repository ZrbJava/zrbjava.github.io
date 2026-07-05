---
title: "React 状态管理方案对比与选型"
description: "Redux、Zustand、Jotai、Recoil、Context 的状态边界设计与大型项目选型决策树。"
pubDate: 2026-07-03
category: "React"
tags: ["React", "State Management", "Redux", "Zustand"]
series: "React 工程实践"
draft: false
featured: false
---

「你们项目用什么状态管理？」是高级前端面试的必答题。答案不是推荐某个库，而是展示**状态分类能力**和**选型决策过程**。

## 先分类，再选型

| 状态类型 | 特征 | 推荐方案 |
|----------|------|----------|
| 本地 UI 状态 | 开关、输入值、hover | useState / useReducer |
| 共享 UI 状态 | 主题、侧边栏、Modal | Context + useReducer |
| 服务端缓存 | API 数据、分页、失效 | TanStack Query / SWR |
| 全局客户端状态 | 用户信息、权限、购物车 | Zustand / Redux Toolkit |
| 原子化派生状态 | 表单字段间联动 | Jotai / Valtio |
| URL 状态 | 筛选、分页、Tab | nuqs / React Router searchParams |

**核心原则：不要把所有状态都放进全局 Store。**

## 方案深度对比

### Redux Toolkit（RTK）

适合：大型团队、复杂异步流程、需要时间旅行调试

```ts
// RTK Slice 示例
const userSlice = createSlice({
  name: 'user',
  initialState: { profile: null, loading: false },
  reducers: {
    setProfile: (state, action) => { state.profile = action.payload; },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUser.fulfilled, (state, action) => {
      state.profile = action.payload;
      state.loading = false;
    });
  },
});
```

优势：生态成熟、DevTools、RTK Query 一体化
劣势：模板代码多、学习曲线陡、小项目过度设计

### Zustand

适合：中等复杂度、快速迭代、不需要中间件生态

```ts
import { create } from 'zustand';

interface AuthStore {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  login: async (credentials) => {
    const user = await api.login(credentials);
    set({ user });
  },
  logout: () => set({ user: null }),
}));
```

优势：API 极简、无 Provider 包裹、TS 友好
劣势：缺少标准化异步模式、大型项目需自建规范

### Jotai

适合：原子化状态、细粒度订阅、表单联动

```ts
import { atom, useAtom } from 'jotai';

const priceAtom = atom(0);
const quantityAtom = atom(1);
const totalAtom = atom((get) => get(priceAtom) * get(quantityAtom));
```

优势：自动依赖追踪、避免不必要的重渲染
劣势：原子数量膨胀时难以维护

## 决策树

```
需要状态管理吗？
├── 只是组件内部 → useState
├── 跨 2-3 层组件 → 组合/Props 或 Context
├── 服务端数据 → TanStack Query
├── 全局 + 复杂异步 + 大团队 → Redux Toolkit
├── 全局 + 中等复杂度 → Zustand
└── 细粒度派生 + 表单联动 → Jotai
```

## 8 年经验的选型建议

1. **默认组合**：TanStack Query（服务端）+ Zustand（客户端全局）+ useState（本地）
2. **团队 > 15 人且状态逻辑复杂**：考虑 Redux Toolkit + RTK Query
3. **不要重复造轮子**：URL 状态、表单状态、缓存失效都有成熟方案
4. **状态迁移策略**：新功能用新方案，旧模块逐步迁移，避免大爆炸重写

## 面试加分表达

「我们之前全量 Redux，随着业务拆分发现 80% 的 Store 其实是服务端缓存。迁移到 TanStack Query + Zustand 后，Store 代码量减少 60%，首屏请求瀑布也消除了。」

这种表达展示了：**不是追新，而是基于问题演进架构**。
