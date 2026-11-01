import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  parseServerDate,
  formatRelativeTime,
  formatClockTime,
  formatListTime,
} from "../utils/formatTime";

// Regression for the reported bug: a comment written moments ago showed "5h"
// for a user in Karachi (UTC+5). The backend stores UTC without a timezone
// marker, and `new Date("YYYY-MM-DD HH:MM:SS")` reads that as LOCAL time.
describe("server timestamps are treated as UTC", () => {
  const originalTZ = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Asia/Karachi"; // UTC+5, the reporter's timezone
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it("parses the backend format as UTC, not local time", () => {
    expect(parseServerDate("2026-09-26 09:57:00.000").toISOString()).toBe("2026-09-26T09:57:00.000Z");
    expect(parseServerDate("2026-09-26 09:57:00").toISOString()).toBe("2026-09-26T09:57:00.000Z");
  });

  it("leaves timestamps that already carry a timezone alone", () => {
    expect(parseServerDate("2026-09-26T09:57:00Z").toISOString()).toBe("2026-09-26T09:57:00.000Z");
    expect(parseServerDate("2026-09-26T14:57:00+05:00").toISOString()).toBe("2026-09-26T09:57:00.000Z");
  });

  it("a comment from 3 minutes ago says '3m', not '5h'", () => {
    expect(formatRelativeTime("2026-09-26 09:57:00.000")).toBe("3m");
  });

  it("scales through hours and days correctly", () => {
    expect(formatRelativeTime("2026-09-26 09:59:40")).toBe("just now");
    expect(formatRelativeTime("2026-09-26 07:00:00")).toBe("3h");
    expect(formatRelativeTime("2026-09-24 10:00:00")).toBe("2d");
  });

  it("shows chat times as the viewer's real local clock time", () => {
    // 09:57 UTC is 2:57 PM in Karachi
    expect(formatClockTime("2026-09-26 09:57:00")).toMatch(/2:57\s?PM/i);
  });

  it("conversation list shows the clock today and 'Yesterday' the day before", () => {
    expect(formatListTime("2026-09-26 09:57:00")).toMatch(/2:57\s?PM/i);
    expect(formatListTime("2026-09-25 09:57:00")).toBe("Yesterday");
  });

  it("returns an empty string for missing/invalid input instead of crashing", () => {
    expect(formatRelativeTime(null)).toBe("");
    expect(formatClockTime("not a date")).toBe("");
  });
});
