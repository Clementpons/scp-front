"use client";

// Vue "cinéma" (inspirée de Pathé) : le client choisit d'abord un type de
// biplace, puis navigue de semaine en semaine ; chaque jour est une ligne
// affichant ses horaires disponibles sous forme de cartes.
// Composant de test UX — l'affichage mensuel historique reste BaptemeCalendar.

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";
import { cn, formatLocalDate } from "@/lib/utils";
import {
  BAPTEME_CATEGORIES,
  CATEGORY_CONFIG,
  formatTime,
  formatMoniteurNames,
  getDateKey,
  type Bapteme,
} from "./BaptemeCalendar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday-based week
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatEndTime(bapteme: Bapteme): string {
  const end = new Date(bapteme.date);
  end.setMinutes(end.getMinutes() + bapteme.duration);
  return end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLong(date: Date): string {
  return date
    .toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^./, (c) => c.toUpperCase());
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `Du ${fmt(monday, false)} au ${fmt(sunday, true)}`;
}

const MAX_AUTO_ADVANCE_WEEKS = 26;

// ─── Scrollable slot row ──────────────────────────────────────────────────────
// Mobile: single horizontal scrolling row, with a right-edge fade + chevron
// hinting that more slots are reachable (hidden once scrolled to the end).
// Desktop (sm+): wrapping grid with capped height and vertical scroll.

function ScrollableSlotRow({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHint = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  };

  useEffect(() => {
    updateScrollHint();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={updateScrollHint}
        className="flex gap-3 overflow-x-auto pb-1.5 sm:gap-2 sm:flex-wrap sm:overflow-x-hidden sm:max-h-[150px] sm:overflow-y-auto sm:pr-1 sm:pb-0"
      >
        {children}
      </div>
      {canScrollRight && (
        <div className="sm:hidden pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/70 to-transparent flex items-center justify-end">
          <ChevronRight className="w-4 h-4 text-slate-400 animate-pulse" />
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BaptemeWeekCalendar({
  onSlotSelect,
  selectedSlot,
  getBaptemePrice,
  initialCategory,
}: {
  onSlotSelect: (slot: Bapteme, category: string) => void;
  selectedSlot: Bapteme | null;
  getBaptemePrice: (cat: string) => number;
  initialCategory?: string;
}) {
  const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const [selectedType, setSelectedType] = useState<string>(() =>
    initialCategory && BAPTEME_CATEGORIES.some((c) => c.id === initialCategory)
      ? initialCategory
      : BAPTEME_CATEGORIES[0].id,
  );
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [weekBaptemes, setWeekBaptemes] = useState<Bapteme[]>([]);
  const [loading, setLoading] = useState(false);

  // Per-week cache (all categories fetched at once → switching type is instant)
  const weekCache = useRef<Map<string, Bapteme[]>>(new Map());
  // On first load, jump ahead to the first week that has slots for the type
  const autoAdvanceRemaining = useRef(MAX_AUTO_ADVANCE_WEEKS);

  const currentMonday = getMonday(new Date());
  const isAtCurrentWeek = weekStart.getTime() <= currentMonday.getTime();

  const slotsForType = (baptemes: Bapteme[]) =>
    baptemes.filter((b) => b.categories.includes(selectedType));

  const maybeAutoAdvance = (baptemes: Bapteme[]) => {
    if (autoAdvanceRemaining.current <= 0) return;
    if (slotsForType(baptemes).length > 0) {
      autoAdvanceRemaining.current = 0;
      return;
    }
    autoAdvanceRemaining.current -= 1;
    if (autoAdvanceRemaining.current > 0) {
      setWeekStart((prev) => addDays(prev, 7));
    }
  };

  // Fetch baptemes for the visible week
  useEffect(() => {
    const weekKey = getDateKey(weekStart);

    if (weekCache.current.has(weekKey)) {
      const cached = weekCache.current.get(weekKey)!;
      setWeekBaptemes(cached);
      maybeAutoAdvance(cached);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);

    const from = formatLocalDate(weekStart);
    const to = formatLocalDate(addDays(weekStart, 6));

    fetch(
      `${process.env.NEXT_PUBLIC_BACKOFFICE_URL}/api/baptemes?from=${from}&to=${to}`,
      { signal: ctrl.signal, headers: { "x-api-key": process.env.NEXT_PUBLIC_API_KEY || "" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) return;
        const baptemes: Bapteme[] = data.data;
        weekCache.current.set(weekKey, baptemes);
        setWeekBaptemes(baptemes);
        maybeAutoAdvance(baptemes);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Erreur chargement baptêmes:", err);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getDateKey(weekStart)]);

  const goToWeek = (offset: number) => {
    autoAdvanceRemaining.current = 0;
    setWeekStart((prev) => getMonday(addDays(prev, offset * 7)));
  };

  // Back to the current week, whatever its content (no auto-advance)
  const goToCurrentWeek = () => {
    autoAdvanceRemaining.current = 0;
    setWeekStart(getMonday(new Date()));
  };

  // Build the 7 day rows with their slots for the selected type
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const key = getDateKey(date);
    const slots = slotsForType(weekBaptemes)
      .filter((b) => {
        const d = new Date(b.date);
        d.setHours(0, 0, 0, 0);
        return getDateKey(d) === key;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { date, key, isPast: date < today, isToday: key === getDateKey(today), slots };
  });

  const weekHasSlots = days.some((d) => !d.isPast && d.slots.length > 0);
  const typeCfg = CATEGORY_CONFIG[selectedType];
  const typeHex = typeCfg?.bgBarHex ?? "#94a3b8";

  return (
    <div className="space-y-4">

      {/* ── 1. Type de biplace ── */}
      <div>
        <p className="text-sm font-semibold text-slate-600 mb-2">1. Choisissez votre formule</p>
        <div className="flex flex-wrap gap-2">
          {BAPTEME_CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat.id];
            const active = selectedType === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedType(cat.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-all",
                  active ? "text-white shadow-md" : "bg-white text-slate-700 hover:shadow-sm",
                )}
                style={{
                  borderColor: cfg?.bgBarHex,
                  backgroundColor: active ? cfg?.bgBarHex : undefined,
                }}
              >
                {active && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />}
                <span className="font-semibold">{cat.name}</span>
                <span className={cn("text-xs", active ? "text-white/80" : "text-slate-400")}>
                  {cat.durationLabel}
                </span>
                <span className={cn("text-xs font-bold", active ? "text-white" : "")}
                  style={{ color: active ? undefined : cfg?.bgBarHex }}
                >
                  {getBaptemePrice(cat.id)}€
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2. Semaine ── */}
      <div>
        <p className="text-sm font-semibold text-slate-600 mb-2">2. Choisissez votre créneau</p>
        <div className="border border-slate-200 rounded-xl overflow-hidden">

          {/* Week navigation */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={isAtCurrentWeek}
                onClick={() => goToWeek(-1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isAtCurrentWeek}
                onClick={goToCurrentWeek}
              >
                <Calendar className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Cette semaine</span>
              </Button>
            </div>
            <div className="flex items-center gap-2 text-center">
              <h3 className="font-semibold text-sm sm:text-base text-slate-800">
                {formatWeekLabel(weekStart)}
              </h3>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
            <Button variant="outline" size="sm" onClick={() => goToWeek(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Day rows */}
          <div className="divide-y divide-slate-100">
            {days.map((day) => (
              <div
                key={day.key}
                className={cn("px-3 py-3.5 sm:py-2.5", day.isPast && "bg-slate-50/60")}
              >
                <div className="flex items-baseline justify-between mb-2 sm:mb-1.5">
                  <h4
                    className={cn(
                      "text-sm font-bold",
                      day.isPast ? "text-slate-300" : "text-slate-700",
                    )}
                  >
                    {formatDayLong(day.date)}
                    {day.isToday && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </h4>
                  {!loading && !day.isPast && day.slots.length > 0 && (
                    <span className="text-xs text-slate-400 shrink-0">
                      {day.slots.length} créneau{day.slots.length > 1 ? "x" : ""}
                    </span>
                  )}
                </div>

                {day.isPast ? (
                  <p className="text-xs text-slate-300">—</p>
                ) : loading ? (
                  /* Skeleton cards while the week is being fetched */
                  <div className="flex gap-3 sm:gap-2 overflow-hidden">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[58px] w-[128px] sm:h-[46px] sm:w-[112px] shrink-0 rounded-lg bg-slate-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : day.slots.length === 0 ? (
                  <p className="text-xs text-slate-400">Aucun créneau</p>
                ) : (
                  /* Horizontal scroll on mobile, wrapping + vertical scroll on desktop */
                  <ScrollableSlotRow>
                    {day.slots.map((bapteme) => {
                      const isAvail = bapteme.availablePlaces > 0;
                      const isSelected = selectedSlot?.id === bapteme.id;
                      const moniteurNames = formatMoniteurNames(bapteme);
                      return (
                        <button
                          key={bapteme.id}
                          type="button"
                          disabled={!isAvail}
                          onClick={() => onSlotSelect(bapteme, selectedType)}
                          className={cn(
                            "rounded-lg border-2 px-4 py-3 text-left transition-all min-w-[128px] shrink-0 sm:px-3 sm:py-1.5 sm:min-w-[112px]",
                            isSelected
                              ? "text-white shadow-md"
                              : "bg-white hover:shadow-md",
                            !isAvail && "opacity-45 cursor-not-allowed",
                          )}
                          style={{
                            borderColor: typeHex,
                            backgroundColor: isSelected ? typeHex : undefined,
                          }}
                        >
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className="text-lg sm:text-base font-extrabold leading-none"
                              style={{ color: isSelected ? "#fff" : typeHex }}
                            >
                              {formatTime(bapteme.date)}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-medium",
                                isSelected ? "text-white/75" : "text-slate-400",
                              )}
                            >
                              → {formatEndTime(bapteme)}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "mt-1.5 sm:mt-0.5 flex items-center gap-1.5 text-[10px] font-medium",
                              isSelected ? "text-white/85" : "text-slate-500",
                            )}
                          >
                            <span>
                              {isAvail
                                ? `${bapteme.availablePlaces} place${bapteme.availablePlaces > 1 ? "s" : ""}`
                                : "Complet"}
                            </span>
                            {moniteurNames && (
                              <>
                                <span className={isSelected ? "text-white/50" : "text-slate-300"}>·</span>
                                <span className="truncate max-w-[110px]">{moniteurNames}</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </ScrollableSlotRow>
                )}
              </div>
            ))}
          </div>
        </div>

        {!loading && !weekHasSlots && (
          <div className="text-center py-4">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">
              Aucun créneau cette semaine pour cette formule — naviguez avec les flèches.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
