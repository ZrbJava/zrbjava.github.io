# 赵汝波的技术笔记

基于 [Astro](https://astro.build) 的个人技术博客，部署于 GitHub Pages。

- 线上地址：https://zhaorubo.top
- 仓库：https://github.com/ZrbJava/zrbjava.github.io

## 本地开发

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在 http://localhost:4321

## 构建

```bash
pnpm build
pnpm preview
```

构建时会通过 Playwright 渲染 Mermaid 图表。首次安装依赖会自动下载 Chromium。

如需指定站点 URL：

```bash
SITE_URL=https://zhaorubo.top pnpm build
```

## 部署

推送到 `main` 或 `dev` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

自定义域名 `zhaorubo.top` 需在 GitHub 仓库 Settings → Pages 中配置，并在阿里云 DNS 添加指向 GitHub 的解析记录。

## 内容结构

```
src/content/
  posts/     # 文章
  topics/    # 专题
  projects/  # 项目复盘
```

文章 frontmatter 支持可选 `cover` 字段，用于列表缩略图和详情页 banner：

```yaml
cover: "/images/covers/my-post.png"
```

未设置 cover 时，会按分类自动生成渐变色 banner。

## 技术栈

- Astro 7 + TypeScript
- Pagefind 全站搜索
- rehype-mermaid + Playwright
- GitHub Actions → GitHub Pages
