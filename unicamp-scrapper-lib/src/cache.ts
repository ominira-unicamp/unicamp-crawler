import type { FetchOptions, PageFetcher, ScraperLogger } from "./core.js";

export interface PageCache {
  get(url: string): Promise<string | undefined>;
  set(url: string, html: string): Promise<void>;
}

export function createCachedPageFetcher(
  fetcher: PageFetcher,
  cache: PageCache,
  options: { logger?: ScraperLogger } = {},
): PageFetcher {
  const logger = options.logger;
  return {
    async fetch(url: string, options?: FetchOptions): Promise<string> {
      const startedAt = Date.now();
      const cached = await cache.get(url);
      if (cached !== undefined) {
        logger?.debug(
          {
            event: "scrape.cache.hit",
            url,
            durationMs: Date.now() - startedAt,
          },
          "Cache hit",
        );
        return cached;
      }
      logger?.debug({ event: "scrape.cache.miss", url }, "Cache miss");
      const html = await fetcher.fetch(url, options);
      await cache.set(url, html);
      return html;
    },
  };
}
