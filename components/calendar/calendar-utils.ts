export function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

export function endOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  );
}

export function addDays(
  date: Date,
  amount: number,
) {
  const result = new Date(date);

  result.setDate(result.getDate() + amount);

  return result;
}

export function addMonths(
  date: Date,
  amount: number,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1,
  );
}

export function addWeeks(date: Date, amount: number) {
  return addDays(date, amount * 7);
}

export function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

export function getConsecutiveDays(start: Date, count: number) {
  return Array.from({ length: count }, (_, index) =>
    addDays(start, index),
  );
}

export function getCalendarGridStart(
  date: Date,
) {
  const firstDay = startOfMonth(date);

  return addDays(
    firstDay,
    -firstDay.getDay(),
  );
}

export function getCalendarGridEnd(
  date: Date,
) {
  const lastDay = endOfMonth(date);

  return addDays(
    lastDay,
    6 - lastDay.getDay(),
  );
}

export function getCalendarDays(
  date: Date,
) {
  const start = getCalendarGridStart(date);
  const end = getCalendarGridEnd(date);

  const days: Date[] = [];

  let currentDate = start;

  while (currentDate <= end) {
    days.push(currentDate);

    currentDate = addDays(currentDate, 1);
  }

  return days;
}

export function isSameDay(
  firstDate: Date,
  secondDate: Date,
) {
  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth() &&
    firstDate.getDate() ===
      secondDate.getDate()
  );
}

export function isSameMonth(
  firstDate: Date,
  secondDate: Date,
) {
  return (
    firstDate.getFullYear() ===
      secondDate.getFullYear() &&
    firstDate.getMonth() ===
      secondDate.getMonth()
  );
}

export function formatMonthHeading(
  date: Date,
) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateKey(
  date: Date,
) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
