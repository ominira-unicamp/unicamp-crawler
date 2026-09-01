export type CardapiosRangeOptions = {
  firstDate?: string;
  lastDate?: string;
  pastDays?: number;
  futureDays?: number;
};

export function resolveCardapiosRange(
  options: CardapiosRangeOptions,
  now = new Date(),
) {
  const hasExactRange =
    options.firstDate !== undefined || options.lastDate !== undefined;
  const hasRelativeRange =
    options.pastDays !== undefined || options.futureDays !== undefined;

  if (hasExactRange && hasRelativeRange)
    throw new Error(
      "Datas exatas não podem ser combinadas com uma janela relativa",
    );
  if (hasExactRange) {
    if (!options.firstDate || !options.lastDate)
      throw new Error("--first-date e --last-date devem ser informados juntos");
    return { firstDate: options.firstDate, lastDate: options.lastDate };
  }

  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const pastDays = options.pastDays ?? 0;
  const futureDays = options.futureDays ?? 0;
  return {
    firstDate: new Date(today - pastDays * 86_400_000)
      .toISOString()
      .slice(0, 10),
    lastDate: new Date(today + futureDays * 86_400_000)
      .toISOString()
      .slice(0, 10),
  };
}
