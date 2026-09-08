/** Older site settings used a display abbreviation for US Central time. */
export function publishingTimezone(value: string) {
  const zone = /^(CST|CDT|CT)$/i.test(value) ? "America/Chicago" : value;
  new Intl.DateTimeFormat("en-US", { timeZone: zone }).format();
  return zone;
}

/** ISO timestamp with a numeric offset, preserving the local date used in URLs. */
export function zonedTimestamp(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: publishingTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const offset = part("timeZoneName").replace("GMT", "") || "+00:00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}${offset}`;
}

/** Resolve an edited wall-clock time; reject nonexistent spring-forward times. */
export function timestampFromLocal(
  local: string,
  timezone: string,
  previous?: string,
) {
  const normalized = local.length === 16 ? `${local}:00` : local;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized))
    throw new Error("Enter a complete publication date and time.");
  const wall = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wall))
    throw new Error("Invalid publication date and time.");
  // Preserve the chosen occurrence of a repeated fall-back time when editing.
  const offsets = new Set<string>();
  if (previous?.includes("T"))
    offsets.add(zonedTimestamp(new Date(previous), timezone).slice(-6));
  for (const hours of [-24, 0, 24])
    offsets.add(
      zonedTimestamp(new Date(wall + hours * 3600000), timezone).slice(-6),
    );
  for (const offset of offsets) {
    const candidate = `${normalized}${offset}`;
    if (
      zonedTimestamp(new Date(candidate), timezone).slice(0, 19) === normalized
    )
      return candidate;
  }
  throw new Error(
    "That time does not exist in this timezone because the clocks move forward. Choose another time.",
  );
}

export function postUrl(publishedAt: string, slug: string) {
  return `/blog/${publishedAt.slice(0, 10).replaceAll("-", "/")}/${slug}/`;
}

export function formatPostDate(
  publishedAt: string,
  timezone: string,
  includeYear = true,
) {
  // Date-only legacy posts have no known time; keep their original calendar date.
  const date = new Date(
    `${publishedAt.slice(0, 10)}T12:00:00Z`,
  ).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
  if (!publishedAt.includes("T")) return date;
  const time = new Date(publishedAt).toLocaleTimeString("en-US", {
    timeZone: publishingTimezone(timezone),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${date} · ${time}`;
}
