---
title: "Vue 3 响应式系统原理深度解析"
description: "从 Object.defineProperty 到 Proxy，理解 track/trigger、effect 调度与 computed/watch 的实现机制。"
pubDate: 2026-06-28
category: "Vue"
tags: ["Vue", "Reactivity", "Proxy", "源码"]
series: "Vue 3 生态与架构"
draft: false
featured: true
---

Vue 3 用 Proxy 重写了响应式系统，这是高级前端面试中 Vue 方向的「必考底层」。理解它不仅能答面试题，更能指导你在大型 Vue 项目中避免响应式陷阱。

## Vue 2 vs Vue 3：为什么换 Proxy

Vue 2 的 `Object.defineProperty` 有三个根本限制：

1. **无法检测属性新增/删除** → 需要 `$set` / `$delete`
2. **数组变异方法需要重写** → `push`、`splice` 等被拦截
3. **深度监听需要递归遍历** → 初始化性能差

Vue 3 的 Proxy 可以拦截 13 种操作（get/set/delete/has/ownKeys 等），天然支持动态属性和数组索引。

## 核心实现：Reactive + Effect

```ts
// 简化的 Vue 3 响应式核心
let activeEffect: ReactiveEffect | null = null;

function track(target: object, key: string | symbol) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);
}

function trigger(target: object, key: string | symbol) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  dep?.forEach(effect => effect.scheduler ? effect.scheduler() : effect.run());
}

function reactive<T extends object>(target: T): T {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      trigger(target, key);
      return result;
    },
  });
}
```

## ref vs reactive 的设计哲学

| | ref | reactive |
|---|-----|----------|
| 适用类型 | 基本类型 + 对象 | 仅对象 |
| 访问方式 | `.value` | 直接访问 |
| 解构 | 保持响应式（RefImpl） | 丢失响应式 |
| 模板中 | 自动解包 | 直接使用 |

```ts
const count = ref(0);
const state = reactive({ name: 'Vue', items: [] });

// 解构 reactive 会丢失响应式
const { name } = state; // ❌ 不再响应式
const nameRef = toRef(state, 'name'); // ✅ 保持响应式
```

## computed 的实现：lazy effect

computed 本质是一个带有 `dirty` 标记的 effect：

```ts
// 简化逻辑
class ComputedRefImpl {
  private _dirty = true;
  private _value: any;

  get value() {
    if (this._dirty) {
      this._value = this._effect.run();
      this._dirty = false;
    }
    return this._value;
  }
}
```

只有当依赖变化时 `_dirty` 才重置为 true，下次访问才重新计算。这是 computed 比 method 性能更好的根本原因。

## watch vs watchEffect

- **watch**：惰性执行，需要明确指定数据源，可以访问新旧值
- **watchEffect**：立即执行，自动收集依赖，无法访问旧值

```ts
// watch：精确控制
watch(() => props.id, async (newId, oldId) => {
  data.value = await fetchData(newId);
}, { immediate: true });

// watchEffect：自动追踪
watchEffect(() => {
  console.log(`count is ${count.value}`);
});
```

## 响应式陷阱与最佳实践

1. **不要解构 reactive 对象** → 用 `toRefs` 或 `storeToRefs`（Pinia）
2. **大对象考虑 `shallowRef`** → 避免深度响应式的性能开销
3. **`markRaw` 标记不需要响应式的对象** → 第三方类实例、大型配置
4. **`readonly` 保护 props 传递的数据** → 防止子组件意外修改

## 面试追问：Vue 3 响应式 vs React

| 维度 | Vue 3 | React |
|------|-------|-------|
| 粒度 | 属性级自动追踪 | 组件级 setState 触发 |
| 更新方式 | 异步批量（微任务队列） | 18 自动 batching |
| 派生状态 | computed 自动缓存 | useMemo 手动声明 |
| 心智模型 | 可变数据 + 拦截 | 不可变数据 + 重渲染 |

## 项目中的实际应用

在大型 Vue 3 项目中，我会：

1. 用 Pinia 管理全局状态，组件内用 `ref/reactive` 管理局部状态
2. 列表数据用 `shallowRef` + 手动触发更新，避免 1000+ 项的深度响应式
3. 用 `computed` 做所有派生逻辑，避免在 template 中写复杂表达式
4. 用 Vue DevTools 的 Timeline 检查不必要的 effect 触发
