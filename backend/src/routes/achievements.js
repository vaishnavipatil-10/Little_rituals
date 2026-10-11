import { Router } from 'express';

export const achievementsRouter = Router();

const PAGE_SIZE = 500;
const MAX_PAGES = 200;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

async function readAllRows(buildQuery) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await buildQuery().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    const result = data || [];
    rows.push(...result);
    if (result.length < PAGE_SIZE) return rows;
  }
  throw new Error('Achievement history row limit exceeded.');
}

function longestStreak(values) {
  const dates = [...new Set(values)].sort();
  let best = { days: 0, start: null, end: null };
  let start = null;
  let previous = null;
  let currentDays = 0;
  for (const date of dates) {
    const current = Date.parse(`${date}T00:00:00.000Z`);
    if (previous === null || current - previous !== 86400000) {
      start = date;
      currentDays = 1;
    } else currentDays += 1;
    if (currentDays > best.days) best = { days: currentDays, start, end: date };
    previous = current;
  }
  return best;
}

function fail(res, error) {
  console.error('Achievements request failed', error);
  return res.status(500).json({ error: { code: 'ACHIEVEMENTS_FAILED', message: 'Your achievements could not be loaded. Please try again.' } });
}

achievementsRouter.get('/', async (req, res) => {
  const today = req.query.today === undefined ? new Date().toISOString().slice(0, 10) : req.query.today;
  if (!validDate(today)) return res.status(400).json({ error: { code: 'INVALID_ACHIEVEMENT_DATE', message: 'Choose a valid calendar date.' } });
  try {
    const [completions, journalEntries] = await Promise.all([
      readAllRows(() => req.supabase.from('routine_completions').select('completed_on, completed_steps, total_steps').eq('user_id', req.user.id).lte('completed_on', today).order('completed_on')),
      readAllRows(() => req.supabase.from('journal_entries').select('entry_date').eq('user_id', req.user.id).lte('entry_date', today).order('entry_date')),
    ]);
    const routineDays = [...new Set(completions.filter((item) => item.total_steps > 0 && item.completed_steps >= item.total_steps).map((item) => item.completed_on))].sort();
    const journalDays = [...new Set(journalEntries.map((entry) => entry.entry_date))].sort();
    const routineStreak = longestStreak(routineDays);
    const journalStreak = longestStreak(journalDays);
    const badges = [
      { id: 'first-routine', title: 'First ritual complete', description: 'Completed every saved step in a routine on one day.', earned: routineDays.length >= 1, earnedOn: routineDays[0] || null },
      { id: 'seven-journal-days', title: 'Seven little reflections', description: 'Saved journal entries on seven different days.', earned: journalDays.length >= 7, earnedOn: journalDays.length >= 7 ? journalDays[6] : null },
      { id: 'routine-week', title: 'A week of care', description: 'Completed all saved steps in at least one routine on seven consecutive days.', earned: routineStreak.days >= 7, earnedOn: routineStreak.days >= 7 ? routineStreak.end : null },
      { id: 'journal-month', title: 'A month of checking in', description: 'Saved a journal entry on 30 consecutive days.', earned: journalStreak.days >= 30, earnedOn: journalStreak.days >= 30 ? journalStreak.end : null },
    ];
    const certificates = [
      { id: 'routine-seven-day-certificate', title: 'Seven-day ritual certificate', eligible: routineStreak.days >= 7, startDate: routineStreak.days >= 7 ? routineStreak.end && new Date(Date.parse(`${routineStreak.end}T00:00:00.000Z`) - 6 * 86400000).toISOString().slice(0, 10) : null, endDate: routineStreak.days >= 7 ? routineStreak.end : null },
      { id: 'journal-thirty-day-certificate', title: 'Thirty-day journal certificate', eligible: journalStreak.days >= 30, startDate: journalStreak.days >= 30 ? journalStreak.end && new Date(Date.parse(`${journalStreak.end}T00:00:00.000Z`) - 29 * 86400000).toISOString().slice(0, 10) : null, endDate: journalStreak.days >= 30 ? journalStreak.end : null },
    ];
    return res.json({ today, counts: { completedRoutineDays: routineDays.length, journalDays: journalDays.length }, streaks: { routine: routineStreak, journal: journalStreak }, badges, certificates });
  } catch (error) { return fail(res, error); }
});
