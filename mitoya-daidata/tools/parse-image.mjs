#!/usr/bin/env node
// Parses 台データ screenshot(s) into data/history.json using Claude's vision.
// Source-agnostic: works for LINE broadcast screenshots, manually-captured
// pscube.jp (or any other hall data site) screenshots, etc. — anything a
// person captured by hand while actually viewing the page themselves.
// Usage:
//   ANTHROPIC_API_KEY=... node parse-image.mjs --date 2026-09-22 img1.jpg [img2.jpg ...]
// If --date is omitted, the date is taken from the first image's filename
// (expects a leading YYYY-MM-DD).
//
// This is the ingestion half of the "drop an image, get structured data"
// pipeline: it does the OCR/structuring, then upserts the day's record into
// data/history.json (replacing any existing entry for the same date so a
// re-run/correction is safe).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const HERE = dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = resolve(HERE, "../data/history.json");
const STORE_NAME = process.env.STORE_NAME || "丸三三刀屋店";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const SCHEMA_PROMPT = `あなたはパチンコ・パチスロ店の「台データ」画像を構造化データに変換するアシスタントです。
渡される画像は、LINE公式アカウントで配信された台データの表のスクリーンショットの場合と、
pscube.jp等のホールデータサイトを人が実際に開いて手動で撮影したスクリーンショットの場合が
あります。画像は「複数台が並んだ一覧表」の場合と「1台だけの詳細画面（グラフ付きなど）」の
場合の両方があり得ます。後者の場合はその1台を配列の要素1件として扱ってください。

以下のJSONスキーマに厳密に従ったJSON配列だけを出力してください。説明文やコードフェンスは不要です。

各要素（1台につき1オブジェクト）:
{
  "unit_no": "台番号(文字列)",
  "model": "機種名(文字列)",
  "genre": "pachinko" または "slot"（判別できない場合は空文字）,
  "diff": 差枚または差玉(符号付き整数。マイナスはマイナス表記),
  "total_games": 総回転数またはゲーム数(整数。読み取れなければnull),
  "counts": { "BB": 0, "RB": 0 } のようなボーナス等の回数のオブジェクト（画像にある項目名をそのままキーにする。例: "大当り", "ART", "CZ", "スタート" など。読み取れなければ空オブジェクト {} },
  "note": "その他の備考(確率表記など)。なければ空文字"
}

読み取れない値は null または空文字/空オブジェクトにしてください。数値はカンマなしの数値型で出力してください。
画像が複数枚渡された場合、同じ台が重複していれば1つにまとめてください。`;

function parseArgs(argv) {
  const args = { date: null, images: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--date") {
      args.date = argv[++i];
    } else {
      args.images.push(argv[i]);
    }
  }
  return args;
}

function dateFromFilename(path) {
  const m = basename(path).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function mimeFor(path) {
  const ext = path.toLowerCase().split(".").pop();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext] || "image/jpeg";
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

function normalizeMachine(m) {
  return {
    unit_no: String(m.unit_no ?? "").trim(),
    model: String(m.model ?? "").trim(),
    genre: m.genre === "pachinko" || m.genre === "slot" ? m.genre : "",
    diff: Number.isFinite(m.diff) ? Math.round(m.diff) : 0,
    total_games: Number.isFinite(m.total_games) ? Math.round(m.total_games) : null,
    counts: typeof m.counts === "object" && m.counts !== null ? m.counts : {},
    note: String(m.note ?? ""),
  };
}

async function callVision(images) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content = [{ type: "text", text: SCHEMA_PROMPT }];
  for (const img of images) {
    const data = readFileSync(img).toString("base64");
    content.push({
      type: "image",
      source: { type: "base64", media_type: mimeFor(img), data },
    });
  }
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
  return extractJson(text);
}

function upsertHistory(date, machines) {
  let history = [];
  if (existsSync(HISTORY_PATH)) {
    history = JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
  }
  history = history.filter((d) => d.date !== date);
  history.push({ date, store: STORE_NAME, machines });
  history.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + "\n");
}

async function main() {
  const { date: dateArg, images } = parseArgs(process.argv.slice(2));
  if (!images.length) {
    console.error("Usage: node parse-image.mjs [--date YYYY-MM-DD] <image...>");
    process.exit(1);
  }
  const date = dateArg || dateFromFilename(images[0]);
  if (!date) {
    console.error("日付を特定できません。--date YYYY-MM-DD を指定するか、ファイル名にYYYY-MM-DDを含めてください。");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY が設定されていません。");
    process.exit(1);
  }

  console.log(`解析中: ${images.join(", ")} (date=${date})`);
  const raw = await callVision(images);
  if (!Array.isArray(raw)) throw new Error("モデル出力がJSON配列ではありません");
  const machines = raw.map(normalizeMachine).filter((m) => m.unit_no || m.model);

  upsertHistory(date, machines);
  console.log(`${date}: ${machines.length}台のデータを data/history.json に反映しました`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
