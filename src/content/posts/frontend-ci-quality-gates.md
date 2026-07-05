---
title: "前端 CI/CD 质量门禁设计"
description: "Lint、Type Check、Unit Test、E2E、Bundle 分析的流水线设计与分支策略。"
pubDate: 2026-06-24
category: "工程化"
tags: ["CI/CD", "Quality", "Testing", "DevOps"]
series: "前端工程化体系"
draft: false
featured: false
---

质量门禁是前端工程化的「最后防线」。高级前端不仅要会写代码，还要设计**让团队无法提交烂代码**的自动化体系。

## CI 流水线设计

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile

      # Stage 1: 静态检查（最快，先跑）
      - name: Lint
        run: pnpm lint
      - name: Type Check
        run: pnpm typecheck

      # Stage 2: 单元测试
      - name: Unit Test
        run: pnpm test -- --coverage
      - name: Coverage Gate
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "Coverage $COVERAGE% below 80% threshold"
            exit 1
          fi

      # Stage 3: 构建验证
      - name: Build
        run: pnpm build
      - name: Bundle Size Check
        run: pnpm bundlesize

      # Stage 4: E2E（可选，merge 前）
      - name: E2E Test
        run: pnpm e2e
```

## 质量门禁层级

```
Level 1 — 提交时（pre-commit hook）
  ├── lint-staged（ESLint + Prettier）
  ├── TypeScript 类型检查（变更文件）
  └── Commit Message 规范（commitlint）

Level 2 — PR 时（CI）
  ├── 全量 Lint + Type Check
  ├── 单元测试 + 覆盖率门禁
  ├── 构建成功
  └── Bundle Size 不超限

Level 3 — Merge 后（CD）
  ├── 部署 Preview 环境
  ├── E2E 测试
  ├── Lighthouse CI 性能门禁
  └── 自动部署 Staging

Level 4 — 发布时
  ├── 人工 Approval
  ├── Canary 发布（5% → 50% → 100%）
  └── 自动回滚监控
```

## 关键工具配置

### lint-staged

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css,json,md}": ["prettier --write"]
  }
}
```

### Bundle Size 监控

```json
{
  "bundlesize": [
    { "path": "./dist/js/*.js", "maxSize": "250kb" },
    { "path": "./dist/css/*.css", "maxSize": "50kb" }
  ]
}
```

### Lighthouse CI

```js
// lighthouserc.js
module.exports = {
  ci: {
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["error", { maxNumericValue: 2000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
      },
    },
  },
};
```

## 分支策略

```
main ──────────── 生产环境
  ↑
develop ───────── Staging 环境
  ↑
feature/xxx ───── Preview 环境（每个 PR 自动部署）
```

**规则：**

- `main` 只能通过 PR merge，需要 2 人 Review + CI 全绿
- `feature` 分支从 `develop` 拉出，PR 到 `develop`
- Hotfix 从 `main` 拉出，PR 到 `main` + cherry-pick 到 `develop`

## 覆盖率策略

| 代码类型 | 覆盖率目标 | 测试类型         |
| -------- | ---------- | ---------------- |
| 工具函数 | 90%+       | Unit Test        |
| 组件     | 70%+       | Component Test   |
| 页面流程 | 核心路径   | E2E Test         |
| API 层   | 80%+       | Integration Test |

**不追求 100% 覆盖率**，重点覆盖：

- 核心业务逻辑
- 边界条件和错误处理
- 历史 Bug 回归
