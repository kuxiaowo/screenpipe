# 简体中文本地版本

`zh-CN.json` 是随应用打包的前端与原生界面翻译。运行时完全离线；英文源码、用户输入、录音转录、AI 输出及可执行提示词保持原文。英语仍可通过语言选择器使用。

初稿由 Argos English → Chinese 1.9 模型在本地生成；常用导航、设置、录音、时间线和会议术语由 `zh-CN-glossary.json` 校对覆盖。模型不随应用发布，其他长说明仍应逐步人工校对。

官方模型来源：https://argos-net.com/v1/translate-en_zh-1_9.argosmodel

普通构建默认使用 `cached` 模式，读取已提交的中文词典，按当前源码重新验证 ICU 变量和 React 富文本结构。语言功能在包含中文词典的本地版中始终可用，不依赖 PostHog 的灰度开关。首次从未启用语言功能的系统默认设置启动时，会选择简体中文；已明确选择的英语会保留。

维护时可以直接修正 `zh-CN.json` 对应条目。批量更新可先执行 `bun run i18n:prepare`，再用 `bun scripts/i18n/local-catalog.mjs export <绝对路径>` 导出待翻译的公开界面文字。准备英文文字到中文文字的 JSON 映射后，用 `bun scripts/i18n/local-catalog.mjs build <绝对路径>` 生成并验证词典。技术名称、代码块和命令示例保留英文。

验证：

```sh
bun test scripts/i18n/prepare.test.ts
bun x vitest run lib/i18n/runtime.test.tsx lib/i18n/rollout.test.tsx lib/i18n/chinese.test.tsx
```
