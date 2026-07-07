---
title: "LLM RAG 前端架构设计"
description: "检索增强生成的完整前端链路：文档上传、向量检索、上下文注入与引用溯源 UI 设计。"
pubDate: 2026-07-05
category: "AI 工程"
tags: ["AI", "RAG", "LLM", "Vector"]
series: "AI 应用开发体系"
draft: false
featured: true
aiLevel: "进阶"
aiOrder: 3
cover: "/images/covers/llm-rag-frontend-architecture.svg"
---

> **前置阅读**：[AI SDK 流式集成](/posts/ai-sdk-streaming-integration) · **体系第 3 篇**

企业知识库问答里，**无引用回答的 👎 率是带引用的 3.2 倍**。前端职责不只是 Chat UI，而是把 **upload → chunk → embed → retrieve → cite** 整条链路做成可感知、可审计的体验。下面是我们内部 RAG 产品的架构与关键实现。

## 端到端链路

```
上传 PDF/MD
  → 分片 (512 tokens, overlap 64)
  → Embedding 任务队列
  → 向量库 (pgvector)
用户提问
  → Query rewrite（可选）
  → Hybrid search (BM25 + vector)
  → Rerank top 8 → 注入 Prompt
  → LLM 流式回答 + citation markers [1][2]
  → 前端渲染 + 点击跳转 PDF 高亮
```

P95 延迟：检索 420ms + 首 token 800ms（GPT-4o-mini）。

## 文档上传与索引 UI

```tsx
type IndexPhase = 'uploading' | 'parsing' | 'chunking' | 'embedding' | 'indexed' | 'failed';

type DocJob = {
  id: string;
  name: string;
  phase: IndexPhase;
  progress: number; // 0-100
  error?: string;
};

function DocumentUploader() {
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { docId, uploadUrl } = await api.createUpload({ name: file.name, size: file.size });
      await fetch(uploadUrl, { method: 'PUT', body: file });
      await api.startIndex(docId);
      return docId;
    },
    onSuccess: (docId) => {
      pollJob(docId, (job) => {
        queryClient.setQueryData(['docJob', docId], job);
      });
    },
  });

  return (
    <Dropzone onDrop={(files) => files.forEach((f) => upload.mutate(f))}>
      <JobList jobs={jobs} />
    </Dropzone>
  );
}
```

**SSE 优于轮询**（我们后来改的）：`/api/docs/:id/events` 推 `phase` + `progress`，embedding 阶段按 chunk 批次更新进度条。

### 大文件与失败重试

- 前端直传 OSS，不经 BFF  body 限制
- `failed` 态展示「重试索引」只跑 embedding，不重新上传
- 病毒扫描 / 类型校验在 `createUpload` 同步返回

## Chat + 引用溯源

```tsx
interface Citation {
  id: string;
  docId: string;
  docTitle: string;
  page?: number;
  charStart?: number;
  charEnd?: number;
  snippet: string;
  score: number;
}

function RAGMessage({ answer, citations }: RAGResponse) {
  const parsed = useMemo(() => injectCitationLinks(answer, citations), [answer, citations]);

  return (
    <article>
      <StreamingMarkdown content={parsed.html} />
      <CitationRail>
        {citations.map((c, i) => (
          <CitationChip
            key={c.id}
            index={i + 1}
            title={c.docTitle}
            score={c.score}
            onClick={() => openDocViewer(c)}
          />
        ))}
      </CitationRail>
    </article>
  );
}
```

`openDocViewer`：PDF.js 打开 `page`，scroll 到 `charStart` 高亮 snippet。**不要**新 tab 裸链 PDF——无高亮时用户以为「胡编」。

### 幻觉 UI 处理

- 模型输出 `[3]` 但 citations 只有 2 条 → 前端 strip 无效 marker，日志告警 Prompt 版本
- `confidence < 0.6` 显示「未在知识库找到足够依据，以下为模型推断」横幅
- 检索失败 → 显式「未引用知识库」标签，不假装有来源

## 检索设置（前端暴露）

```tsx
<SettingsPanel>
  <Select label="检索模式" value={mode} options={['semantic', 'keyword', 'hybrid']} />
  <Slider label="引用条数" value={topK} min={1} max={10} />
  <Toggle label="包含对话历史" checked={includeHistory} />
</SettingsPanel>
```

设置写入 `sessionStorage`，请求体带给 `/api/chat`——便于 A/B 与客诉复现。

## API 与缓存

```ts
// TanStack Query — 相同问题 5min 内不重复检索
useQuery({
  queryKey: ['rag-search', question, settings],
  queryFn: () => api.search({ question, ...settings }),
  staleTime: 5 * 60_000,
  enabled: !!question,
});
```

流式回答 **不缓存**；仅缓存 retrieval 结果用于「展开引用」侧栏。

## 与纯 Chat 的差异（落地）

| 维度 | 纯 Chat | RAG |
|------|---------|-----|
| 中间态 | 「思考中」 | 「检索知识库…」→「生成回答…」 |
| 错误 | 重试 | 检索失败可降级纯 LLM + 明确标注 |
| 合规 | 一般 | 引用必须可点击审计 |

## 性能与无障碍

- 检索 > 300ms 显示 skeleton citation 占位
- 流式 Markdown 用 sanitized renderer（防 XSS）
- Citation chip：`aria-label="引用 1：员工手册 第 12 页"`

## 指标

- 有 citation 的回答 👎 率：8% vs 无 citation 26%
- 索引失败率：2.1%（主要是扫描版 PDF 无文本层 → OCR 队列）
- 点击 citation 转化率：41%（用户真的在核实）

RAG 前端的核心是 **让「依据」可见、可点、可追责**。upload/chunk/embed 进度、invalid citation 处理、PDF 高亮，比多一个模型参数更能建立信任。

## 自测清单

- [ ] 能画出 upload → chunk → embed → retrieve → generate 链路
- [ ] Citation UI 可点击溯源，检索失败有降级提示
- [ ] 上传/索引进度对用户可见
- [ ] 流式 Markdown 经 sanitize
- [ ] 能说明「无 citation 时如何提示幻觉风险」

全部打勾 → 进入 **[第 4 篇：Agent UI 设计模式](/posts/ai-agent-ui-design-patterns)**。
