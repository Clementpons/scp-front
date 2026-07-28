import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function readBody(req: Request): Promise<Buffer> {
  const body = await req.arrayBuffer();
  return Buffer.from(body);
}

// Format a Date as YYYY-MM-DD in LOCAL time.
// Do NOT use toISOString() for this: it converts to UTC first, and in
// timezones ahead of UTC (France) local midnight lands on the PREVIOUS day
// (e.g. July 31 00:00 UTC+2 → "…-07-30"), which silently drops the last
// day of the month from ?from&to API queries.
export function formatLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// First and last day of a month as YYYY-MM-DD (local), for ?from&to queries.
// `month` is 0-based, like Date#getMonth().
export function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: formatLocalDate(new Date(year, month, 1)),
    to: formatLocalDate(new Date(year, month + 1, 0)),
  };
}
