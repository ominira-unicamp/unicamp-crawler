import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Cheerio, CheerioAPI } from "cheerio";

export type Dom = CheerioAPI;
export const loadHtml = (html: string): Dom => cheerio.load(html);
export function normalizedText(
  value: Cheerio<AnyNode> | AnyNode | string | undefined,
): string {
  if (typeof value === "string")
    return value.replaceAll("\u00a0", " ").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const raw =
    "text" in value && typeof value.text === "function"
      ? value.text()
      : "data" in value
        ? (value.data ?? "")
        : "";
  return String(raw).replaceAll("\u00a0", " ").replace(/\s+/g, " ").trim();
}
export const absoluteUrl = (url: string, base: string): string =>
  new URL(url, base).toString();
