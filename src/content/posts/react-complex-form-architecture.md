---
title: "React 复杂表单架构设计实践"
description: "从字段建模、状态隔离、联动规则和性能优化几个角度，拆解大型业务表单的工程设计。"
pubDate: 2026-07-04
updatedDate: 2026-07-04
category: "前端架构"
tags: ["React", "Form", "Architecture"]
series: "复杂前端系统设计"
draft: false
featured: false
cover: "/images/covers/react-complex-form-architecture.svg"
---

Insurance 投保页：120+ 字段、37 条联动规则、部分字段异步校验要调风控 API。第一版用受控组件 + 单个 `useState` 存全表单，**每次 keystroke 整页重渲染，INP 600ms+**。重构为 schema-driven + React Hook Form + 自研规则引擎后，**字段变更只重渲染相关控件，INP 降到 90ms 以内**。

## 为什么没选 Formily / 纯 JSON Schema

| 方案 | 不选 / 选的原因 |
|------|----------------|
| Formily | 能力全，但团队 React 栈深、学习曲线陡；120 字段里 30% 是定制 UI |
| 纯 JSON Schema + uiSchema | 联动表达力不够，复杂 `visibleWhen` 会变成字符串地狱 |
| **RHF + Zod + 自研 schema** | 类型安全、包体积小、字段级 subscription 原生支持 |

## 架构总览

```
FieldSchema[]  ──▶  FormProvider (RHF)
       │                    │
       ▼                    ▼
 RuleEngine ◀────── watch(fieldPaths)
       │
       ▼
 FieldRenderer ──▶ 具体控件 (Input / Select / Custom)
```

## 字段建模

```ts
// types/form-schema.ts
import { z } from 'zod';

export type FieldSchema = {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'custom';
  component?: React.ComponentType<FieldComponentProps>;
  options?: { label: string; value: string }[];
  rules?: z.ZodTypeAny;
  visibleWhen?: RuleExpr;
  disabledWhen?: RuleExpr;
  deps?: string[]; // 联动依赖字段
};

export type RuleExpr =
  | { op: 'eq'; field: string; value: unknown }
  | { op: 'and'; args: RuleExpr[] }
  | { op: 'or'; args: RuleExpr[] }
  | { op: 'in'; field: string; values: unknown[] };
```

```ts
// 示例：有社保时才显示社保号
{
  name: 'socialSecurityNo',
  label: '社保号',
  type: 'text',
  visibleWhen: { op: 'eq', field: 'hasSocialSecurity', value: true },
  rules: z.string().length(18, '请输入 18 位社保号'),
  deps: ['hasSocialSecurity'],
}
```

**原则**：schema 描述「是什么」，组件描述「怎么画」，规则引擎描述「何时生效」。

## 规则引擎

```ts
// lib/rule-engine.ts
export function evalRule(expr: RuleExpr, values: Record<string, unknown>): boolean {
  switch (expr.op) {
    case 'eq':
      return values[expr.field] === expr.value;
    case 'and':
      return expr.args.every((a) => evalRule(a, values));
    case 'or':
      return expr.args.some((a) => evalRule(a, values));
    case 'in':
      return expr.values.includes(values[expr.field]);
    default:
      return true;
  }
}

export function useFieldVisibility(schema: FieldSchema, watch: UseFormWatch<any>) {
  const deps = schema.deps ?? [];
  const values = watch(deps.length ? deps : []);
  return useMemo(() => {
    if (!schema.visibleWhen) return true;
    const snapshot = Object.fromEntries(deps.map((d, i) => [d, values[i]]));
    return evalRule(schema.visibleWhen, snapshot);
  }, [schema, values, deps]);
}
```

复杂业务后来把 `RuleExpr` 换成 **JSONLogic** 子集，运营可配；引擎接口不变。

## React Hook Form 集成

```tsx
// components/SchemaForm.tsx
const formSchema = z.object(
  Object.fromEntries(
    fields.map((f) => [f.name, f.rules ?? z.any()])
  )
);

export function SchemaForm({ fields, onSubmit }: Props) {
  const methods = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onBlur', // 避免 onChange 全表校验
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        {fields.map((field) => (
          <SchemaField key={field.name} schema={field} />
        ))}
      </form>
    </FormProvider>
  );
}
```

```tsx
// components/SchemaField.tsx — 字段级订阅
function SchemaField({ schema }: { schema: FieldSchema }) {
  const { control, watch } = useFormContext();
  const visible = useFieldVisibility(schema, watch);

  if (!visible) return null;

  return (
    <Controller
      name={schema.name}
      control={control}
      render={({ field, fieldState }) => (
        <FieldWrapper label={schema.label} error={fieldState.error?.message}>
          <DynamicInput schema={schema} field={field} />
        </FieldWrapper>
      )}
    />
  );
}
```

## 异步校验与防抖

风控 API 单次 200–800ms，不能每个字符都打：

```tsx
const validateIdCard = useMemo(
  () =>
    debounce(async (value: string) => {
      if (!value) return true;
      const res = await riskApi.verifyIdCard(value);
      return res.valid || res.message;
    }, 400),
  [],
);

<Controller
  name="idCard"
  rules={{ validate: validateIdCard }}
  ...
/>
```

**注意**：组件 unmount 时要 `debounce.cancel()`，避免 setState on unmounted。

## 长表单性能

### 1. 分步 + 虚拟化

Wizard 按步骤只 mount 当前 step 的字段；单页超长列表用 `@tanstack/react-virtual` 只渲染可见行。

### 2. 避免 watch 全表

```tsx
// ❌ 任意字段变都重算
const all = watch();

// ✅ 只订阅 deps
const hasSS = watch('hasSocialSecurity');
```

### 3. 派生状态用 useWatch + memo

```tsx
const premium = useWatch({ name: ['age', 'coverage', 'term'] });
const estimated = useMemo(
  () => calcPremium(premium),
  [premium],
);
```

## 四类状态边界

| 类型 | 存放 | 示例 |
|------|------|------|
| 输入状态 | RHF `control` | 用户 typing |
| 派生状态 | `useMemo` / 规则引擎 | 可见性、保费试算 |
| 远程状态 | React Query | 下拉选项、风控结果 |
| 提交流程 | 局部 `useState` | `submitting` / `serverError` |

不要把 `submitting` 塞进 Redux；和表单同生命周期即可。

## 测试策略

```tsx
// SchemaField.test.tsx
it('hides socialSecurityNo when hasSocialSecurity is false', async () => {
  render(<SchemaForm fields={FIELDS} onSubmit={vi.fn()} />);
  expect(screen.queryByLabelText('社保号')).not.toBeInTheDocument();
  await userEvent.click(screen.getByLabelText('有社保'));
  expect(screen.getByLabelText('社保号')).toBeInTheDocument();
});
```

联动规则单测覆盖 `evalRule`；E2E 覆盖完整提交与 API mock。

## 上线指标

- INP P75：600ms → 88ms
- 首屏 mount 字段 DOM：120 → 当前 step 约 25
- 运营改联动规则：发版 → 配置中心（JSONLogic 阶段）

复杂表单的问题不在输入框，而在**依赖、校验、权限、性能边界**同时成立。Schema 分离 + 字段级订阅 + 显式规则引擎，比「一个大 Form 组件」更扛业务变更。
