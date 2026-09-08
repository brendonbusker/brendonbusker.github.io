import { describe, expect, it } from "vitest";
import {
  formatPostDate,
  postUrl,
  publishingTimezone,
  timestampFromLocal,
  zonedTimestamp,
} from "./dates";
import { postSchema } from "./schemas";

describe("publication times", () => {
  it("captures Central time across UTC midnight and daylight saving", () => {
    expect(publishingTimezone("CST")).toBe("America/Chicago");
    expect(zonedTimestamp(new Date("2026-09-08T04:59:59Z"), "CST")).toBe(
      "2026-09-07T23:59:59-05:00",
    );
    expect(
      zonedTimestamp(new Date("2026-01-08T05:59:59Z"), "America/Chicago"),
    ).toBe("2026-01-07T23:59:59-06:00");
  });
  it("converts edits, rejects nonexistent times, and preserves repeated times", () => {
    expect(timestampFromLocal("2026-09-07T20:31", "CST")).toBe(
      "2026-09-07T20:31:00-05:00",
    );
    expect(() => timestampFromLocal("2026-03-08T02:30", "CST")).toThrow(
      /does not exist/,
    );
    expect(
      timestampFromLocal(
        "2026-11-01T01:30",
        "CST",
        "2026-11-01T01:30:00-06:00",
      ),
    ).toBe("2026-11-01T01:30:00-06:00");
    expect(() => timestampFromLocal("2026-02-30T12:00", "CST")).toThrow();
  });
  it("keeps the local day in permanent links and does not invent times for legacy dates", () => {
    expect(postUrl("2026-09-07T23:59:59-05:00", "late-post")).toBe(
      "/blog/2026/09/07/late-post/",
    );
    expect(formatPostDate("2026-09-03", "CST")).toBe("September 3, 2026");
    expect(formatPostDate("2026-09-07T23:59:59-05:00", "CST")).toContain(
      "11:59 PM CDT",
    );
  });
  it("accepts real offset timestamps and legacy dates, but rejects invalid dates", () => {
    const schema = postSchema.shape.publishedAt;
    for (const value of [
      "2026-09-03",
      "2026-09-07T23:59:59-05:00",
      "2026-09-08T04:59:59.000Z",
    ])
      expect(schema.safeParse(value).success).toBe(true);
    for (const value of [
      "2026-02-30",
      "2026-09-07T24:00:00-05:00",
      "2026-09-07T12:00:00",
    ])
      expect(schema.safeParse(value).success).toBe(false);
  });
});
