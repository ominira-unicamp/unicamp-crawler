import type { PageAdapter, ScrapeResult, ScrapingContext } from "./core.js";
import { loadHtml, normalizedText } from "./dom.js";
import { Parser } from "htmlparser2";

export const docentesPortalUrl =
  "https://portal.dados.unicamp.br/docentes?nome=&nome_programa=&nome_unidade=&origem=&pagina=1&sigla_unidade=&toggle_colaborador=&toggle_docente=on&toggle_pesquisador=&toggle_posdoc=&toggle_professor_senior=on";

export type ProfessorIdentifierSystem =
  | "LATTES"
  | "ORCID"
  | "SCOPUS"
  | "WEB_OF_SCIENCE"
  | "PUBLONS"
  | "GOOGLE_SCHOLAR"
  | "SCIELO"
  | "FAPESP";

export type ProfessorDataPortalIdentifier = {
  system: ProfessorIdentifierSystem;
  externalId: string;
};

export type ProfessorDataPortalRecord = {
  portalId: number;
  name: string;
  position?: string;
  unit?: { code?: string; name?: string };
  department?: string;
  email?: string;
  identifiers: ProfessorDataPortalIdentifier[];
  citationNames: string[];
  lattesAbstract?: string;
  latestTraining: Array<{
    startYear?: number;
    endYear?: number;
    degree?: string;
    institution?: string;
  }>;
  languages: Array<{
    name: string;
    comprehension?: string;
    speaking?: string;
    reading?: string;
    writing?: string;
  }>;
  keywords: Array<{ name: string; count?: number }>;
  coauthors: Array<{ name: string; count?: number }>;
};

type ProfessorListEntry = { portalId: number; name: string; url: string };

export type DocentesListPage = {
  entries: ProfessorListEntry[];
  nextUrl?: string;
};

export type DocentesInput = {
  url?: string;
  onRecord?: (record: ProfessorDataPortalRecord) => Promise<void> | void;
  onProgress?: (progress: { profiles: number; pages: number }) => Promise<void> | void;
  progress?: {
    isCompleted(portalId: number): Promise<boolean>;
    save(record: ProfessorDataPortalRecord): Promise<void>;
    saveFailure(portalId: number, name: string, error: unknown): Promise<void>;
  };
};

const profileId = /[?&]docente=(\d+)/;
const textValue = (element: ReturnType<ReturnType<typeof loadHtml>>): string =>
  normalizedText(element.first());

function profileUrl(id: number): string {
  return `https://portal.dados.unicamp.br/perfil?docente=${id}`;
}

export function parseDocentesListPage(
  html: string,
  input: DocentesInput = {},
): DocentesListPage {
  const $ = loadHtml(html);
  const entries: ProfessorListEntry[] = [];
  const seen = new Set<number>();
  $("a[href*='/perfil?docente='], a[href*='&docente=']").each((_, anchor) => {
    const href = $(anchor).attr("href") ?? "";
    const match = href.match(profileId);
    if (!match) return;
    const portalId = Number(match[1]);
    if (seen.has(portalId)) return;
    const container = $(anchor).closest("article, .views-row, li, .card");
    const name = textValue(container.find("h1, h2, h3, h4, .name").first()) ||
      textValue($(anchor));
    if (!name) return;
    seen.add(portalId);
    entries.push({
      portalId,
      name,
      url: new URL(href, input.url ?? docentesPortalUrl).toString(),
    });
  });
  const currentPage = Number(
    new URL(input.url ?? docentesPortalUrl).searchParams.get("pagina") ?? "1",
  );
  const numberedPages = $("a[href]").toArray()
    .flatMap((anchor) => {
      const href = $(anchor).attr("href") ?? "";
      const page = Number(new URL(href, input.url ?? docentesPortalUrl).searchParams.get("pagina"));
      return Number.isInteger(page) && page > currentPage ? [{ anchor, page }] : [];
    })
    .sort((left, right) => left.page - right.page)[0]?.anchor;
  const next = numberedPages ?? $("a[href]").toArray().find((anchor) => {
    const label = normalizedText($(anchor)).toLowerCase();
    return label === ">" || label === "next" || label.includes("próxima");
  });
  const nextHref = next ? $(next).attr("href") : undefined;
  return {
    entries,
    nextUrl: nextHref
      ? new URL(nextHref, input.url ?? docentesPortalUrl).toString()
      : undefined,
  };
}

export async function fetchDocentesListPage(
  input: DocentesInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? docentesPortalUrl);
}

export const docentesListPage: PageAdapter<DocentesInput, DocentesListPage> = {
  id: "docentes-lista",
  fetch: fetchDocentesListPage,
  parse: parseDocentesListPage,
};

export type ProfessorProfileInput = { portalId: number; url?: string };

function firstField($: ReturnType<typeof loadHtml>, selectors: string[]): string {
  for (const selector of selectors) {
    const value = textValue($(selector));
    if (value) return value;
  }
  return "";
}

function isUnitText(value: string): boolean {
  return value.length <= 240 &&
    /\b(?:FACULDADE|INSTITUTO|CENTRO|NÚCLEO|NUCLEO)\b/i.test(value) &&
    !/\b(?:DEPARTAMENTO|GRADUAÇÃO|MESTRADO|DOUTORADO|EXPERIÊNCIA)\b/i.test(value);
}

function unitField($: ReturnType<typeof loadHtml>): string {
  const labeled = $(".prf-fact").toArray().find((element) =>
    /^unidade$/i.test(normalizedText($(element).find(".prf-info-label").first())),
  );
  const labeledValue = labeled ? normalizedText($(labeled).find(".prf-info-value").first()) : "";
  if (labeledValue) return labeledValue;
  return [".unit", "[class*='unit']"].flatMap((selector) =>
    $(selector).toArray().map((element) => normalizedText($(element))),
  ).filter(isUnitText).sort((left, right) => left.length - right.length)[0] ?? "";
}

function numberFrom(value: string): number | undefined {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function listWithCount(
  $: ReturnType<typeof loadHtml>,
  selectors: string[],
): Array<{ name: string; count?: number }> {
  const values: Array<{ name: string; count?: number }> = [];
  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const item = $(element);
      const name = normalizedText(item.find(".name, .label, a").first()) ||
        normalizedText(item.clone().children().remove().end());
      if (!name) return;
      const count = numberFrom(
        item.attr("data-count") ?? item.attr("data-frequency") ??
          normalizedText(item.find(".count, .frequency, .number").first()),
      );
      if (!values.some((value) => value.name === name)) values.push({ name, count });
    });
    if (values.length > 0) return values;
  }
  return values;
}

function wordCloudValues(html: string, variableName: string): Array<{ name: string; count?: number }> {
  const section = html.match(new RegExp(`var\\s+${variableName}[\\s\\S]*?data:\\s*(\\[[\\s\\S]*?\\])`, "i"))?.[1] ?? "";
  const values: Array<{ name: string; count?: number }> = [];
  const itemPattern = /['"]name['"]\s*:\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1\s*,\s*['"]value['"]\s*:\s*(\d+)/g;
  for (const match of section.matchAll(itemPattern)) {
    const name = match[2].replace(/\\(['"])/g, "$1").trim();
    if (name) values.push({ name, count: Number(match[3]) });
  }
  return values;
}

function normalizeTrainingDegree(value: string): string | undefined {
  const normalized = value.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  if (/p[oó]s[ -]?doutor/i.test(normalized)) return "Pós-Doutorado";
  if (/doutor/i.test(normalized)) return "Doutorado";
  if (/mestre/i.test(normalized)) return "Mestrado";
  if (/graduad|gradua[cç][aã]o/i.test(normalized)) return "Graduação";
  return undefined;
}

function parseTrainingText(value: string): ProfessorDataPortalRecord["latestTraining"][number] | undefined {
  const normalized = value.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  const years = normalized.match(/\b(\d{4})(?:\.0)?\s*-\s*(\d{4})\b/);
  const withoutYears = normalized.replace(/\b\d{4}(?:\.0)?\s*-\s*\d{4}\b/, "").trim();
  const separator = withoutYears.indexOf(",");
  const degree = normalizeTrainingDegree(separator >= 0 ? withoutYears.slice(0, separator) : withoutYears);
  const institution = separator >= 0 ? withoutYears.slice(separator + 1).replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim() || undefined : undefined;
  if (!years) return undefined;
  return {
    startYear: years ? Number(years[1]) : undefined,
    endYear: years ? Number(years[2]) : undefined,
    degree,
    institution,
  };
}

function trainingFromProfile($: ReturnType<typeof loadHtml>): ProfessorDataPortalRecord["latestTraining"] {
  return $("#prf-formacao .profile-section-content > div, .training tr, [class*='formation'] tr").toArray()
    .map((element) => parseTrainingText(normalizedText($(element))) ?? {})
    .filter((item) => item.startYear || item.degree || item.institution);
}

function profileLanguages($: ReturnType<typeof loadHtml>): ProfessorDataPortalRecord["languages"] {
  return $(".lang-row").toArray().map((row) => {
    const item = $(row);
    const values = { name: normalizedText(item.find(".lang-name").first()) } as ProfessorDataPortalRecord["languages"][number];
    item.find(".lang-pill").each((_, pill) => {
      const text = normalizedText($(pill));
      const value = normalizedText($(pill).find("b").first()) || text.replace(/^.*?\s+/, "");
      if (/^compreende/i.test(text)) values.comprehension = value;
      if (/^fala/i.test(text)) values.speaking = value;
      if (/^lê/i.test(text)) values.reading = value;
      if (/^escreve/i.test(text)) values.writing = value;
    });
    return values;
  }).filter((language) => language.name);
}

function largeProfileLanguages(html: string): ProfessorDataPortalRecord["languages"] {
  const languages: ProfessorDataPortalRecord["languages"] = [];
  for (const match of html.matchAll(/<div\s+class="lang-row"[^>]*>([\s\S]*?)(?=<div\s+class="lang-row"|<\/div>\s*<\/div>\s*<\/div>)/gi)) {
    const block = match[1];
    const name = block.match(/class="lang-name"[^>]*>\s*([^<]+)/i)?.[1]?.trim();
    if (!name) continue;
    const value = (label: string) => block.match(new RegExp(`${label}[^<]*<b>\\s*([^<]+)`, "i"))?.[1]?.trim();
    languages.push({ name, comprehension: value("Compreende"), speaking: value("Fala"), reading: value("Lê"), writing: value("Escreve") });
  }
  return languages;
}

function languagesFromTable(
  $: ReturnType<typeof loadHtml>,
): ProfessorDataPortalRecord["languages"] {
  return $(".languages tr, [class*='language'] tr").toArray().map((row) => {
    const cells = $(row).find("th, td").toArray().map((cell) => normalizedText($(cell)));
    const values = cells.slice(1).join(" ").split(",").map((value) => value.trim());
    return {
      name: cells[0] ?? "",
      comprehension: values.find((value) => /compreende/i.test(value)),
      speaking: values.find((value) => /fala|speaks/i.test(value)),
      reading: values.find((value) => /lê|reads/i.test(value)),
      writing: values.find((value) => /escreve|writes/i.test(value)),
    };
  }).filter((language) => language.name);
}

function identifiersFromText(text: string): ProfessorDataPortalIdentifier[] {
  const patterns: Array<[ProfessorIdentifierSystem, RegExp]> = [
    ["LATTES", /lattes\.cnpq\.br\/(\d{8,})/gi],
    ["ORCID", /orcid(?:\.org|\s+id)?[^\d]*(\d{4}-\d{4}-\d{4}-[\dX]{4})/gi],
    ["SCOPUS", /scopus[^\d]*(\d{8,})/gi],
    ["WEB_OF_SCIENCE", /(?:researcherid|wos\/author\/record)[^A-Z0-9-]*([A-Z]-?\d{4}-\d{4})/gi],
    ["PUBLONS", /publons[^A-Z0-9-]*([A-Z0-9-]+)/gi],
    ["GOOGLE_SCHOLAR", /(?:scholar\.google\.com[^\s]*user=|google scholar[^A-Za-z0-9_-]*)([A-Za-z0-9_-]{6,})/gi],
    ["SCIELO", /scielo[^A-Z0-9-]*([A-Z0-9-]{4,})/gi],
    ["FAPESP", /fapesp[^\d]*(\d{2}\/\d{4,6}-\d)/gi],
  ];
  const found: ProfessorDataPortalIdentifier[] = [];
  for (const [system, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const externalId = match[1];
      if (externalId && !found.some((item) => item.system === system && item.externalId === externalId))
        found.push({ system, externalId });
    }
  }
  return found;
}

export function parseProfessorProfile(
  html: string,
  input: ProfessorProfileInput,
): ProfessorDataPortalRecord {
  if (html.length > 5 * 1024 * 1024)
    return parseLargeProfessorProfile(html, input);
  const $ = loadHtml(
    html.replace(/<script\b[^>]*>[\s\S]*?(?:<\/script>|$)/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style>|$)/gi, "")
      .replace(/<noscript\b[^>]*>[\s\S]*?(?:<\/noscript>|$)/gi, ""),
  );
  const body = normalizedText($("body"));
  const identifierSource = `${body} ${$("a").toArray().map((anchor) => $(anchor).attr("href") ?? "").join(" ")}`;
  const lines = $("body").text().split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const name = firstField($, ["h1", "h2"]) || `Professor ${input.portalId}`;
  const unitText = unitField($);
  const email = body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const position = firstField($, [".position", ".cargo", ".prf-role", "[class*='position']", "[class*='cargo']"]) ||
    lines.find((line) => /^(?:MS\d(?:\.\d)?|\d{1,2}|[IVX]+)?\s*[-—]\s*(?:PROFESSOR|PESQUISADOR|POS-DOUTORANDO)/i.test(line) ||
      /^(?:PROFESSOR|PESQUISADOR|POS-DOUTORANDO)/i.test(line));
  const inferredUnit = unitText || lines.find(isUnitText);
  const inferredDepartment = firstField($, [".department", ".departamento", ".prf-info-sub", "[class*='department']"]) ||
    lines.find((line) => /\bDEPARTAMENTO\b/i.test(line));
  const training = trainingFromProfile($);
  return {
    portalId: input.portalId,
    name,
    position: position || undefined,
    unit: inferredUnit ? { code: inferredUnit.match(/^([A-Z0-9]{2,8})\s*[-–—]/)?.[1], name: inferredUnit } : undefined,
    department: inferredDepartment || undefined,
    email,
    identifiers: identifiersFromText(identifierSource),
    citationNames: $(".prf-fact--wide .chip, .citations li, .citation-names li, [class*='citation'] li").toArray().map((element) => normalizedText($(element))).filter(Boolean),
    lattesAbstract: firstField($, [".lattes-abstract", ".abstract-lattes", "#prf-sobre .profile-section-content", "[class*='abstract']"]) || undefined,
    latestTraining: training,
    languages: profileLanguages($),
    keywords: wordCloudValues(html, "wordcloud_palavras_chave").length > 0
      ? wordCloudValues(html, "wordcloud_palavras_chave")
      : listWithCount($, [".keywords li", ".keyword li", "[class*='keyword'] li"]),
    coauthors: wordCloudValues(html, "wordcloud_co_autores").length > 0
      ? wordCloudValues(html, "wordcloud_co_autores")
      : listWithCount($, [".coauthors li", ".coauthor li", "[class*='coauthor'] li"]),
  };
}

type StreamFrame = {
  tag: string;
  className: string;
  text: string;
  count?: number;
};

function parseLargeProfessorProfile(
  html: string,
  input: ProfessorProfileInput,
): ProfessorDataPortalRecord {
  const stack: StreamFrame[] = [];
  const identifiers: ProfessorDataPortalIdentifier[] = [];
  const citationNames: string[] = [];
  const keywords: Array<{ name: string; count?: number }> = [];
  const coauthors: Array<{ name: string; count?: number }> = [];
  keywords.push(...wordCloudValues(html, "wordcloud_palavras_chave"));
  coauthors.push(...wordCloudValues(html, "wordcloud_co_autores"));
  let skipDepth = 0;
  let name = `Professor ${input.portalId}`;
  let position: string | undefined;
  let unit: { code?: string; name?: string } | undefined;
  let department: string | undefined;
  let email: string | undefined;
  let lattesAbstract: string | undefined;
  const addIdentifier = (value: string) => {
    for (const identifier of identifiersFromText(value))
      if (!identifiers.some((item) => item.system === identifier.system && item.externalId === identifier.externalId))
        identifiers.push(identifier);
    email ??= value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  };
  const parser = new Parser(
    {
      onopentag(tag, attributes) {
        addIdentifier(attributes.href ?? "");
        const className = attributes.class ?? "";
        if (skipDepth > 0 || /^(script|style|noscript)$/i.test(tag)) {
          skipDepth += 1;
          return;
        }
        stack.push({
          tag,
          className,
          text: "",
          count: Number(attributes["data-count"] ?? attributes["data-frequency"]),
        });
      },
      ontext(text) {
        if (skipDepth > 0) return;
        addIdentifier(text);
        for (const frame of stack) frame.text += text;
      },
      onclosetag(tag) {
        if (skipDepth > 0) {
          skipDepth -= 1;
          return;
        }
        const frame = stack.pop();
        if (!frame || frame.tag !== tag) return;
        const value = frame.text.replace(/\s+/g, " ").trim();
        if (!value) return;
        const classes = frame.className.toLowerCase();
        if (!position && /^(h1|h2)$/.test(tag)) name = value;
        if (!position && /position|cargo/.test(classes)) position = value;
        if (!unit && /\bunit\b/.test(classes) && isUnitText(value)) unit = { code: value.match(/^([A-Z0-9]{2,8})\s*[-–—]/)?.[1], name: value };
        if (!department && /department|departamento/.test(classes)) department = value;
        if (!lattesAbstract && /abstract/.test(classes)) lattesAbstract = value;
        const item = { name: value, count: Number.isFinite(frame.count) ? frame.count : undefined };
        if (tag === "li" && /citation/.test(classes)) citationNames.push(value);
        if (tag === "li" && /keyword/.test(classes)) keywords.push(item);
        if (tag === "li" && /coauthor/.test(classes)) coauthors.push(item);
        if (tag === "span" && /\bchip\b/.test(classes)) citationNames.push(value);
      },
    },
    { decodeEntities: true },
  );
  parser.write(html);
  parser.end();
  if (!unit) {
    const unitValue = html.match(/prf-info-label[^>]*>\s*Unidade[\s\S]*?prf-info-value[^>]*>\s*([^<]+)/i)?.[1]?.trim();
    if (unitValue) unit = { name: unitValue, code: unitValue.match(/^([A-Z0-9]{2,8})\s*[-–—]/)?.[1] };
  }
  if (!department)
    department = html.match(/prf-info-sub[^>]*>\s*([^<]+)/i)?.[1]?.trim();
  const trainingBlock = html.match(/id="prf-formacao"[\s\S]*?id="prf-palavras-chave"/i)?.[0] ?? "";
  const training = [...trainingBlock.matchAll(/\d{4}(?:\.0)?\s*-\s*\d{4}[\s\S]*?(?=<\/div>)/gi)]
    .map((match) => parseTrainingText(match[0]))
    .filter((item): item is ProfessorDataPortalRecord["latestTraining"][number] => Boolean(item));
  return {
    portalId: input.portalId,
    name,
    position,
    unit,
    department,
    email,
    identifiers,
    citationNames: [...new Set(citationNames)],
    lattesAbstract,
    latestTraining: training,
    languages: largeProfileLanguages(html),
    keywords,
    coauthors,
  };
}

export async function fetchProfessorProfile(
  input: ProfessorProfileInput,
  context: ScrapingContext,
): Promise<string> {
  return context.fetcher.fetch(input.url ?? profileUrl(input.portalId));
}

export const professorProfile: PageAdapter<ProfessorProfileInput, ProfessorDataPortalRecord> = {
  id: "docente-perfil",
  fetch: fetchProfessorProfile,
  parse: parseProfessorProfile,
};

export async function crawlDocentes(
  input: DocentesInput,
  context: ScrapingContext,
): Promise<ScrapeResult<ProfessorDataPortalRecord[]>> {
  const records: ProfessorDataPortalRecord[] = [];
  const seenPages = new Set<string>();
  const seenProfiles = new Set<number>();
  let url = input.url ?? docentesPortalUrl;
  while (!seenPages.has(url)) {
    seenPages.add(url);
    const page = await context.tryLoad(docentesListPage, { url });
    if (!page) break;
    for (const entry of page.data.entries) {
      if (seenProfiles.has(entry.portalId)) continue;
      seenProfiles.add(entry.portalId);
      if (input.progress && await input.progress.isCompleted(entry.portalId))
        continue;
      const profile = await context.tryLoad(professorProfile, entry);
      const profilePageMetadata = context.pages.at(-1);
      if (profilePageMetadata?.adapter === professorProfile.id)
        context.pages.pop();
      if (profile) {
        if (input.progress) await input.progress.save(profile.data);
        if (input.onRecord) await input.onRecord(profile.data);
        else records.push(profile.data);
        if (input.onProgress)
          await input.onProgress({
            profiles: seenProfiles.size,
            pages: seenPages.size,
          });
      } else if (input.progress) {
        await input.progress.saveFailure(
          entry.portalId,
          entry.name,
          "Falha ao carregar ou analisar o perfil",
        );
      }
    }
    if (!page.data.nextUrl) break;
    url = page.data.nextUrl;
  }
  return { data: records, issues: context.issues, pages: context.pages };
}
