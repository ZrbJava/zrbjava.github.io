---
title: "LLM RAG 前端架构设计"
description: "检索增强生成的完整前端链路：文档上传、向量检索、上下文注入与引用溯源 UI 设计。"
pubDate: 2026-07-05
category: "AI 工程"
tags: ["AI", "RAG", "LLM", "Vector"]
series: "AI 时代的前端开发"
draft: false
featured: true
---

RAG（Retrieval-Augmented Generation）是当前 AI 应用最主流的架构模式。前端工程师在 RAG 系统中的角色是**设计知识交互界面**和**实现引用溯源体验**。

## RAG 完整链路

```
用户提问
  ↓
Query 改写/扩展
  ↓
向量检索（Embedding Search）→ Top-K 相关文档片段
  ↓
上下文注入 Prompt
  ↓
LLM 生成回答（带引用）
  ↓
前端渲染：回答 + 引用来源 + 置信度
```

## 前端架构设计

```
┌─────────────────────────────────────────────┐
│                  Chat UI                     │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐│
│  │ 对话区   │  │ 引用面板  │  │ 知识库管理  ││
│  │ 流式回答 │  │ 来源文档  │  │ 上传/索引  ││
│  └─────────┘  └──────────┘  └────────────┘│
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              API Layer                      │
│  /api/chat     /api/upload    /api/search  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Backend Services                  │
│  Embedding → Vector DB → LLM → Response   │
└─────────────────────────────────────────────┘
```

## 引用溯源 UI 设计

RAG 回答的可信度取决于引用质量，前端需要清晰展示来源：

```tsx
interface RAGResponse {
  answer: string;
  citations: Citation[];
  confidence: number;
}

interface Citation {
  id: string;
  source: string; // 文档名
  page?: number; // 页码
  snippet: string; // 引用片段
  score: number; // 相似度分数
}

function RAGMessage({ response }: { response: RAGResponse }) {
  return (
    <div>
      <MarkdownContent content={response.answer} />
      <div className="citations">
        <h4>参考来源</h4>
        {response.citations.map((cite) => (
          <CitationCard
            key={cite.id}
            source={cite.source}
            snippet={cite.snippet}
            score={cite.score}
            onClick={() => openSource(cite)}
          />
        ))}
      </div>
      <ConfidenceBadge score={response.confidence} />
    </div>
  );
}
```

## 文档上传与索引状态

```tsx
function DocumentUploader() {
  const [files, setFiles] = useState<UploadFile[]>([]);

  async function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    // 1. 上传文件
    const { docId } = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    // 2. 轮询索引状态
    const status = await pollIndexStatus(docId);
    // pending → processing → indexed → failed
  }

  return (
    <DropZone onDrop={handleUpload}>
      {files.map((f) => (
        <FileStatus key={f.id} name={f.name} status={f.indexStatus} />
      ))}
    </DropZone>
  );
}
```

## Prompt 工程前端化

前端可以暴露有限的 Prompt 控制给用户：

```tsx
function SearchSettings() {
  return (
    <SettingsPanel>
      <Select label="检索模式" options={["精确", "语义", "混合"]} />
      <Slider label="引用数量" min={1} max={10} defaultValue={5} />
      <Toggle label="包含历史对话上下文" />
      <Select label="回答风格" options={["简洁", "详细", "技术"]} />
    </SettingsPanel>
  );
}
```

## 性能与 UX 考量

1. **检索延迟**：显示「正在检索知识库...」中间态
2. **大文档预览**：引用点击后懒加载 PDF/文档片段
3. **缓存策略**：相同问题缓存检索结果（TanStack Query staleTime）
4. **降级方案**：检索失败时退化为纯 LLM 回答，并标注「未引用知识库」

## 与纯 Chat 的架构差异

| 维度       | 纯 Chat  | RAG Chat                |
| ---------- | -------- | ----------------------- |
| 上下文来源 | 对话历史 | 对话历史 + 检索文档     |
| 回答可信度 | 依赖模型 | 引用溯源                |
| 前端复杂度 | 低       | 中（引用 UI、文档管理） |
| 延迟       | 低       | 中（多一次检索）        |
| 知识更新   | 无法更新 | 上传新文档即可          |
