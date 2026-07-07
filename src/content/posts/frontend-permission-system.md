---
title: "前端权限系统如何设计"
description: "从账号、角色、资源、操作和数据范围几个维度，梳理中后台权限系统的前端设计方式。"
pubDate: 2026-06-28
category: "前端架构"
tags: ["Permission", "Architecture", "React"]
series: "复杂前端系统设计"
draft: false
featured: false
cover: "/images/covers/frontend-permission-system.svg"
---

权限系统最容易翻车的地方，是前端把「隐藏按钮」当成安全边界。我们做过一套 200+ 权限点的中后台：**前端负责体验与引导，鉴权永远在 API**；在此前提下，用 RBAC + 数据范围把路由、菜单、操作、字段四层对齐，权限相关工单从每周 15+ 降到 2 以内。

## 权限模型

```
User ──N:M──▶ Role ──N:M──▶ Permission
                              │
                              ├─ resource: order
                              ├─ action: read | write | delete
                              └─ scope: self | dept | all（数据范围）
```

后端返回登录态 payload 示例：

```json
{
  "userId": "u_123",
  "roles": ["sales_manager"],
  "permissions": [
    "order:read:dept",
    "order:write:dept",
    "invoice:read:self"
  ],
  "menuTree": [...]
}
```

**命名约定**：`resource:action:scope`，避免 `canEditOrder` 这种不可枚举的字符串。

## 四层前端表达

| 层 | 实现 | 无权限 UX |
|----|------|-----------|
| 路由 | 路由守卫 + 404/403 页 | 直接拦在入口 |
| 菜单 | 服务端 menuTree 或前端 filter | 不展示入口 |
| 操作 | 按钮/菜单项 | 隐藏 vs 禁用 vs「申请权限」 |
| 字段 | 表单项 readOnly / 脱敏 | 展示 `***` 或占位 |

### PermissionProvider

```tsx
// app/permission/PermissionContext.tsx
type PermissionContextValue = {
  permissions: Set<string>;
  can: (perm: string) => boolean;
  canAny: (...perms: string[]) => boolean;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  const set = useMemo(() => new Set(permissions), [permissions]);
  const value = useMemo(
    () => ({
      permissions: set,
      can: (p: string) => set.has(p),
      canAny: (...ps: string[]) => ps.some((p) => set.has(p)),
    }),
    [set],
  );
  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission() {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('PermissionProvider missing');
  return ctx;
}
```

### 路由守卫

```tsx
// app/routes/ProtectedRoute.tsx
export function ProtectedRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can } = usePermission();
  const location = useLocation();

  if (!can(permission)) {
    return <Navigate to="/403" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// routes 配置
{
  path: '/orders',
  element: (
    <ProtectedRoute permission="order:read:dept">
      <OrderListPage />
    </ProtectedRoute>
  ),
}
```

### 操作级：组件封装

```tsx
// shared/permission/Can.tsx
export function Can({
  permission,
  fallback = null,
  mode = 'hide',
  children,
}: {
  permission: string;
  fallback?: React.ReactNode;
  mode?: 'hide' | 'disable';
  children: React.ReactElement;
}) {
  const { can } = usePermission();
  if (can(permission)) return children;

  if (mode === 'disable') {
    return cloneElement(children, { disabled: true });
  }
  return <>{fallback}</>;
}

// 使用
<Can permission="order:write:dept" mode="disable">
  <Button onClick={handleEdit}>编辑</Button>
</Can>
```

**UX 选择**：财务类「删除」用 `hide`；「导出」用 `disable` + Tooltip「联系管理员开通」——减少用户困惑。

### 字段级

```tsx
function OrderAmountField({ value }: { value: number }) {
  const { can } = usePermission();
  if (!can('order:read_amount:dept')) {
    return <span className="text-muted">***</span>;
  }
  return <span>{formatCurrency(value)}</span>;
}
```

字段权限必须和后端响应字段裁剪一致；**不要**前端藏了但 Network 里还能拉到明文。

## 与 BFF / API 的分工

```
浏览器 ──▶ BFF ──▶ 领域服务
              │
              ├─ 校验 JWT + 权限
              ├─ 按 scope 过滤 SQL / 查询条件
              └─ 裁剪响应字段
```

前端 `can('order:delete:all')` 为 true 时，DELETE 仍可能 403——例如订单已锁定。UI 要以 **API 错误码** 为准做 toast，不能假设前端判断永远正确。

## 权限字典与同步

| 问题 | 做法 |
|------|------|
| 前后端 permission 字符串不一致 | 单 repo OpenAPI + 代码生成，或共享 `permissions.json` |
| 新权限上线漏配角色 | 管理端 diff 告警 + 集成测试账号矩阵 |
| 测试账号难维护 | 脚本生成「纯 read / read+write / admin」三套 seed |

```ts
// scripts/seed-test-users.ts 片段
const MATRIX = [
  { role: 'viewer', perms: ['order:read:dept'] },
  { role: 'editor', perms: ['order:read:dept', 'order:write:dept'] },
];
```

E2E 用 Playwright **storageState 切换角色**，覆盖 403 路径。

## 灰度与动态权限

权限变更后不必强制登出：我们采用 **短 TTL access token + `/auth/permissions` 轮询**（Tab focus 时 refresh）。大变更（角色撤销）仍通过 WebSocket 推 `force_logout`。

## 常见坑

1. **菜单和路由各写一套白名单** — 改一处漏一处；以 `permissions` 推导 menu，或完全信任服务端 menuTree
2. **数据范围只在前端 filter** — 用户改 query 就越权；scope 必须进 API
3. **权限点爆炸** — 200 个按钮 200 个 perm；合并为 resource-level + 页面内细粒度 API 校验

## 检查清单

- [ ] 所有写操作 API 有服务端鉴权，前端 Can 只是 UX
- [ ] permission 字符串有文档且可搜索
- [ ] 403/404 页面可回到首页或申请权限
- [ ] E2E 至少 3 种角色 smoke
- [ ] 敏感字段 Network 里不可见

权限系统的核心不是藏按钮，而是**把业务授权模型无损映射到 UI**——模型清晰，组件层只是薄封装。
