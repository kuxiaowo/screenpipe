// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com

// Regenerate the checked-in catalog from offline translations of display text.
// ICU variables, React nodes, paths, brands and executable identifiers stay intact.
import fs from "node:fs/promises";
import path from "node:path";
import { parse, printAST } from "@generaltranslation/icu";
import { appRoot } from "./config.mjs";
import { validateCatalog } from "./validate.mjs";

const [action, file] = process.argv.slice(2);
const read = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const source = await read(path.join(appRoot, ".localization/source/en.json"));
const native = await read(path.join(appRoot, ".localization/native/en.json"));
const glossary = await read(path.join(appRoot, "locales/zh-CN-glossary.json"));
const protectedText = /(https?:\/\/[^\s]+|`[^`]+`|<[^>]+>|\b(?:screenpipe|Screenpipe|Codex|ChatGPT|OpenAI|Whisper|Deepgram|Claude(?: Code)?|Gemini|Ollama|OpenCode|Tauri|MCP|ACP|API|JSON|CPU|GPU|RAM|FFmpeg|OpenBLAS|Windows|macOS|Linux|Google|Microsoft|GitHub|Zoom|Teams|Discord|Slack|Telegram|Notion|Todoist|OneDrive|PostHog|DirectML|Vulkan|ONNX|Ctrl|Cmd|Alt|Shift|Enter|Esc|Escape|Tab|Backspace|Space|Pi)\b|\b\w+[\/\\]\w[^\s]*|\b[a-zA-Z0-9_-]+\.(?:exe|json|md|toml|sqlite|ts|tsx|js|py|wav|mp3)\b)/g;
const units = new Set();
let translated = {};

function prose(text) {
  if (Object.hasOwn(glossary, text)) return glossary[text];
  const trim = text.trim();
  if (!trim || !/[A-Za-z]/.test(trim)) return text;
  if (action === "export") { units.add(trim); return text; }
  const value = (glossary[trim] ?? translated[trim] ?? trim).replaceAll("\u2581", " ").trim();
  return text.slice(0, text.indexOf(trim)) + value + text.slice(text.indexOf(trim) + trim.length);
}
function literal(text) {
  if (Object.hasOwn(glossary, text)) return glossary[text];
  return text.split(protectedText).map((part, index) => index % 2 ? part : prose(part)).join("");
}
function icu(text) {
  if (Object.hasOwn(glossary, text)) return glossary[text];
  if (/\b(?:bun|npm|cargo|screenpipe)\s+(?:install|record|search|auth|service|run|pipe)\b/.test(text)) return text;
  try {
    const nodes = parse(text, { requiresOtherClause: true, ignoreTag: true });
    function visit(nodes) {
      for (const node of nodes) {
        if (node.type === 0) node.value = literal(node.value);
        if (node.options) {
          if (node.type === 6) for (const key of Object.keys(node.options)) {
            if (!key.startsWith("=") && key !== "other") delete node.options[key];
          }
          for (const option of Object.values(node.options)) visit(option.value);
        }
        if (node.children) visit(node.children);
      }
    }
    visit(nodes);
    return printAST(nodes);
  } catch { return text; }
}
function rich(value) {
  if (typeof value === "string") return icu(value);
  if (Array.isArray(value)) return value.map(rich);
  if (!value || typeof value !== "object") return value;
  if (["code", "pre"].includes(value.t)) return value;
  const result = { ...value };
  if (Object.hasOwn(value, "c")) result.c = rich(value.c);
  if (value.d) {
    result.d = { ...value.d };
    for (const key of ["pl", "ti", "alt", "arl"]) {
      if (typeof value.d[key] === "string") result.d[key] = icu(value.d[key]);
    }
    if (value.d.b) result.d.b = Object.fromEntries(Object.entries(value.d.b)
      .filter(([key]) => value.d.t !== "p" || key === "other" || key.startsWith("="))
      .map(([key, branch]) => [key, rich(branch)]));
  }
  return result;
}
if (action === "build") translated = await read(file);
const frontend = Object.fromEntries(Object.entries(source).map(([id, value]) => [id, rich(value)]));
const nativeCatalog = Object.fromEntries(Object.entries(native).map(([id, value]) => [id, icu(value)]));
if (action === "export") {
  await fs.writeFile(file, JSON.stringify([...units].sort(), null, 2) + "\n");
  console.log(`Exported ${units.size} unique display-text segments`);
} else if (action === "build") {
  const front = validateCatalog(source, frontend, "en", "zh-CN");
  const back = validateCatalog(native, nativeCatalog, "en", "zh-CN");
  const failures = { ...front.fallbacks, ...back.fallbacks };
  if (Object.keys(failures).length) {
    await fs.writeFile(file + ".failures.json", JSON.stringify(failures, null, 2));
    throw new Error(`Invalid catalog entries: ${Object.keys(failures).length}; see ${file}.failures.json`);
  }
  await fs.writeFile(path.join(appRoot, "locales/zh-CN.json"), JSON.stringify({ frontend, native: nativeCatalog }, null, 2) + "\n");
  console.log(`Validated Chinese catalog: frontend ${front.translated}/${front.total}; native ${back.translated}/${back.total}`);
} else throw new Error("Usage: bun scripts/i18n/local-catalog.mjs export|build /absolute/path/to/translations.json");
