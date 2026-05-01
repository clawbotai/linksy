# Linksy Web

Linksy 的公开 Web 版本。这个项目只包含浏览器端能力，适合部署到 Vercel。

## 功能范围

- 导入已有转录逐字稿
- 转录历史管理
- 转录详情、复制纯文本或带时间戳文本
- 导出 TXT / Markdown / JSON
- 基于逐字稿生成可编辑脑图
- 使用浏览器 IndexedDB 持久化数据

## 开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

Vercel 部署时使用默认 Vite 配置即可，构建产物目录为 `dist`。
