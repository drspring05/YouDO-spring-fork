import { formatDateLabel, useDateFormat } from '../lib/dateFormat';
import { useMemo } from 'react';
import type { DeviceCalendarEvent } from '../lib/deviceCalendar';
import { readableTextColor } from '../lib/monthLayout';
import { dayColorsByLongestEvent, yearEndDay, yearMonths, yearStartDay } from '../lib/yearView';

interface Props {
  year: number;
  todayStr: string;
  /** phone-calendar events for the whole year (calendars switched off in Settings are already left out) */
  events: DeviceCalendarEvent[];
  /** a month was tapped: open it in the Month view */
  onOpenMonth: (year: number, month: number) => void;
  /** a day was tapped: open its month in the Month view with that day selected */
  onOpenDay: (date: string) => void;
}

/**
 * Twelve small months. A day with an event is filled with the color of the longest event on it; days without
 * events stay plain. No names or dots, so the year reads as a color map at a glance.
 */
export default function YearView({ year, todayStr, events, onOpenMonth, onOpenDay }: Props) {
  useDateFormat();
  const months = useMemo(() => yearMonths(year), [year]);
  const colors = useMemo(() => dayColorsByLongestEvent(events, yearStartDay(year), yearEndDay(year)), [events, year]);

  return (
    <div className="grid grid-cols-3 gap-2 bg-surface border border-subtle rounded-2xl shadow-card p-2" aria-label={`Year ${year}`}>
      {months.map((month) => {
        const name = new Date(year, month.month, 1).toLocaleDateString(undefined, { month: 'short' });
        const fullName = new Date(year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        return (
          <div
            key={month.key}
            onClick={() => onOpenMonth(year, month.month)}
            className="rounded-xl border border-subtle bg-elevated/40 p-1.5"
          >
            <button
              type="button"
              aria-label={`Open ${fullName}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenMonth(year, month.month);
              }}
              className={`block w-full text-left text-[11px] font-bold mb-1 px-0.5 ${
                todayStr.startsWith(month.key) ? 'text-primary-glow' : 'text-content-primary'
              }`}
            >
              {name}
            </button>
            <div className="grid grid-cols-7 gap-px">
              {month.cells.map((cell, index) => {
                if (!cell.date) return <span key={index} className="aspect-square" aria-hidden />;
                const color = colors[cell.date];
                const isToday = cell.date === todayStr;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    aria-label={formatDateLabel(cell.date, 'full')}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenDay(cell.date as string);
                    }}
                    className={`aspect-square rounded-[3px] grid place-items-center text-[7.5px] leading-none tabular-nums ${
                      color ? 'font-bold' : 'text-content-secondary'
                    } ${isToday ? 'ring-1 ring-primary' : ''}`}
                    style={color ? { backgroundColor: color, color: readableTextColor(color) } : undefined}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
