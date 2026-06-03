import { format, addDays } from 'date-fns';

export interface UgandaHoliday {
  id: string;
  title: string;
  date: string;
  description: string;
  isFixed: boolean;
}

// Function to calculate Easter Sunday for a given year
function calculateEaster(year: number): Date {
  // Using the algorithm for Western Easter calculation
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = Math.floor((h + l - 7 * m + 114) / 31);
  const p = (h + l - 7 * m + 114) % 31;
  
  return new Date(year, n - 1, p + 1);
}

export function getUgandaPublicHolidays(year: number): UgandaHoliday[] {
  const holidays: UgandaHoliday[] = [];
  
  // Fixed holidays
  const fixedHolidays = [
    {
      title: "New Year's Day",
      month: 0, // January
      day: 1,
      description: "The first day of the year in the Gregorian calendar"
    },
    {
      title: "Liberation Day",
      month: 0, // January
      day: 26,
      description: "Commemorates the National Resistance Movement's victory in 1986"
    },
    {
      title: "International Women's Day",
      month: 2, // March
      day: 8,
      description: "Celebrates women's social, economic, cultural and political achievements"
    },
    {
      title: "Labour Day",
      month: 4, // May
      day: 1,
      description: "International Workers' Day celebrating the contributions of workers"
    },
    {
      title: "Uganda Martyrs Day",
      month: 5, // June
      day: 3,
      description: "Commemorates the Uganda Martyrs who died for their faith between 1885-1887"
    },
    {
      title: "Heroes Day",
      month: 5, // June
      day: 9,
      description: "Honors those who contributed to Uganda's liberation and development"
    },
    {
      title: "Independence Day",
      month: 9, // October
      day: 9,
      description: "Celebrates Uganda's independence from British colonial rule in 1962"
    },
    {
      title: "Christmas Day",
      month: 11, // December
      day: 25,
      description: "Christian celebration of the birth of Jesus Christ"
    },
    {
      title: "Boxing Day",
      month: 11, // December
      day: 26,
      description: "The day after Christmas, traditionally a day for giving gifts to service workers"
    }
  ];

  // Add fixed holidays
  fixedHolidays.forEach((holiday, index) => {
    const date = new Date(year, holiday.month, holiday.day);
    holidays.push({
      id: `uganda-holiday-${year}-${index}`,
      title: holiday.title,
      date: format(date, 'yyyy-MM-dd'),
      description: holiday.description,
      isFixed: true
    });
  });

  // Calculate Easter-based holidays
  const easter = calculateEaster(year);
  
  // Good Friday (2 days before Easter)
  const goodFriday = addDays(easter, -2);
  holidays.push({
    id: `uganda-holiday-${year}-good-friday`,
    title: "Good Friday",
    date: format(goodFriday, 'yyyy-MM-dd'),
    description: "Christian observance commemorating the crucifixion of Jesus Christ",
    isFixed: false
  });

  // Easter Monday (1 day after Easter)
  const easterMonday = addDays(easter, 1);
  holidays.push({
    id: `uganda-holiday-${year}-easter-monday`,
    title: "Easter Monday",
    date: format(easterMonday, 'yyyy-MM-dd'),
    description: "Christian celebration, the day after Easter Sunday",
    isFixed: false
  });

  // Sort holidays by date
  holidays.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return holidays;
}

// Get holidays for multiple years (useful for calendar spanning multiple years)
export function getUgandaHolidaysForYears(startYear: number, endYear: number): UgandaHoliday[] {
  const allHolidays: UgandaHoliday[] = [];
  
  for (let year = startYear; year <= endYear; year++) {
    allHolidays.push(...getUgandaPublicHolidays(year));
  }
  
  return allHolidays;
}

// Get current year holidays
export function getCurrentYearUgandaHolidays(): UgandaHoliday[] {
  const currentYear = new Date().getFullYear();
  return getUgandaPublicHolidays(currentYear);
}

// Check if a date is a Uganda public holiday
export function isUgandaPublicHoliday(date: string, year?: number): UgandaHoliday | null {
  const checkYear = year || new Date(date).getFullYear();
  const holidays = getUgandaPublicHolidays(checkYear);
  
  return holidays.find(holiday => holiday.date === date) || null;
} 