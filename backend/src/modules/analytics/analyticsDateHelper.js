/**
 * Analytics Date & TimeRange Helper
 * Handles period presets, custom date ranges, previous period comparisons, and timezone offsets.
 */

export function parseDateRange(query = {}) {
  const period = (query.period || 'last_7_days').toLowerCase();
  const timezone = query.timezone || 'UTC';
  const now = new Date();

  let start = new Date(now);
  let end = new Date(now);
  let prevStart = new Date(now);
  let prevEnd = new Date(now);
  let label = 'Last 7 Days';

  switch (period) {
    case 'today': {
      label = 'Today';
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Previous period: Yesterday
      prevStart.setDate(start.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(end.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      break;
    }

    case 'yesterday': {
      label = 'Yesterday';
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);

      // Previous period: Day before yesterday
      prevStart.setDate(start.getDate() - 1);
      prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(end.getDate() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      break;
    }

    case 'last_7_days': {
      label = 'Last 7 Days';
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const diff = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diff);
      break;
    }

    case 'last_30_days': {
      label = 'Last 30 Days';
      start.setDate(now.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const diff = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diff);
      break;
    }

    case 'this_month': {
      label = 'This Month';
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Previous period: full last month
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }

    case 'last_month': {
      label = 'Last Month';
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      // Previous period: two months ago
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      break;
    }

    case 'this_year': {
      label = 'This Year';
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      prevStart = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
    }

    case 'custom': {
      label = 'Custom Range';
      if (query.startDate) {
        start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
      } else {
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
      }

      if (query.endDate) {
        end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }

      const diff = Math.max(1, end.getTime() - start.getTime());
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diff);
      break;
    }

    default: {
      label = 'Last 7 Days';
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const diff = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diff);
      break;
    }
  }

  // MySQL formatted strings (YYYY-MM-DD HH:MM:SS)
  const toSql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

  return {
    period,
    label,
    startDate: start,
    endDate: end,
    startDateSql: toSql(start),
    endDateSql: toSql(end),
    prevStartDate: prevStart,
    prevEndDate: prevEnd,
    prevStartDateSql: toSql(prevStart),
    prevEndDateSql: toSql(prevEnd),
    timezone
  };
}

/**
 * Calculates percentage change between current and previous values
 */
export function calculateDelta(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);

  if (p === 0) {
    if (c === 0) return { delta: 0, direction: 'neutral' };
    return { delta: 100, direction: 'up' };
  }

  const diff = ((c - p) / p) * 100;
  const rounded = Number(diff.toFixed(1));

  return {
    delta: Math.abs(rounded),
    direction: rounded > 0 ? 'up' : (rounded < 0 ? 'down' : 'neutral')
  };
}

/**
 * Generates an array of date strings between start and end (inclusive)
 */
export function generateDateSeries(startDate, endDate) {
  const dates = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10)); // 'YYYY-MM-DD'
    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}
