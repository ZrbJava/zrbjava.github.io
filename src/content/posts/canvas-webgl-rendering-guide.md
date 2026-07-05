---
title: "Canvas 2D 与 WebGL 渲染性能指南"
description: "Canvas 绘制优化、WebGL 渲染管线、OffscreenCanvas 与大数据量图形渲染的性能策略。"
pubDate: 2026-06-12
category: "可视化"
tags: ["Canvas", "WebGL", "Performance", "Rendering"]
series: "可视化与图形编程"
draft: false
featured: true
---

可视化是高级前端的重要方向。Canvas 和 WebGL 的性能优化不同于 DOM 操作，需要理解**像素级渲染**的特殊性。

## Canvas 2D 性能优化

### 减少绘制调用

```js
// ❌ 每次循环都设置样式
for (const point of points) {
  ctx.fillStyle = point.color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ✅ 按颜色分组批量绘制
const groups = groupBy(points, 'color');
for (const [color, group] of Object.entries(groups)) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const p of group) ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
}
```

### 脏矩形（Dirty Rectangle）

只重绘变化区域，而非整个 Canvas：

```js
class DirtyRectRenderer {
  private dirtyRegions: Rect[] = [];

  markDirty(rect: Rect) {
    this.dirtyRegions.push(rect);
  }

  render() {
    if (this.dirtyRegions.length === 0) return;
    const bounds = mergeRects(this.dirtyRegions);
    ctx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h);
    this.drawRegion(bounds);
    this.dirtyRegions = [];
  }
}
```

### OffscreenCanvas + Worker

将绘制逻辑移到 Worker，避免阻塞主线程：

```js
// main.ts
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('render-worker.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);

// render-worker.js
self.onmessage = (e) => {
  const ctx = e.data.canvas.getContext('2d');
  // 在 Worker 中绘制，不阻塞 UI
};
```

## WebGL 渲染管线

```
JavaScript → Vertex Shader → Rasterization → Fragment Shader → Framebuffer
              (顶点处理)      (光栅化)        (像素着色)         (输出)
```

### 基础 WebGL 绘制

```js
// 1. 创建 Shader Program
const program = createProgram(vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

// 2. 创建 Buffer 并传入顶点数据
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// 3. 设置 attribute 并绘制
const posLoc = gl.getAttribLocation(program, 'a_position');
gl.enableVertexAttribArray(posLoc);
gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
```

## Canvas 2D vs WebGL 选型

| 维度 | Canvas 2D | WebGL |
|------|-----------|-------|
| 学习曲线 | 低 | 高 |
| 性能上限 | 中（万级元素） | 高（百万级顶点） |
| 3D 支持 | 无 | 原生 |
| 适用场景 | 图表、标注、简单动画 | 3D、粒子、大数据可视化 |
| 库生态 | ECharts, Fabric.js | Three.js, PixiJS, regl |

**选型建议：**

- 2D 图表 → ECharts / Canvas 2D
- 2D 游戏/动画 → PixiJS (WebGL)
- 3D 场景 → Three.js
- 简单绑定/标注 → Canvas 2D

## 大数据量可视化策略

1. **数据降采样**：10 万点 → 显示 2000 个聚合点
2. **LOD（Level of Detail）**：缩放级别决定渲染精度
3. **虚拟化**：只渲染视口内的数据
4. **WebGL Instancing**：一次 Draw Call 渲染大量相同物体
5. **Texture 数据传递**：把数据存纹理，GPU 并行读取

```js
// WebGL Instanced Drawing — 一次绘制 10000 个矩形
gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 10000);
```

## 性能监控

```js
// 使用 stats.js 监控 FPS
const stats = new Stats();
document.body.appendChild(stats.dom);

function animate() {
  stats.begin();
  render();
  stats.end();
  requestAnimationFrame(animate);
}
```

目标基准：

- 静态图表：60 FPS
- 交互动画：≥ 30 FPS
- 数据更新：< 16ms per frame
