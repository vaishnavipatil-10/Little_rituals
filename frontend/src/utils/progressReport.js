export function dateLabel(date, options = { month: 'short', day: 'numeric' }) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });
}

export function makeProgressReport(data) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.parse(`${data.today}T00:00:00.000Z`) - (6 - index) * 86400000).toISOString().slice(0, 10);
    const entries = data.water.filter((entry) => entry.entry_date === date);
    const checkins = data.journal.filter((entry) => entry.entry_date === date && entry.skin_rating != null);
    const completions = data.completions.filter((entry) => entry.completed_on === date);
    const total = completions.reduce((sum, entry) => sum + entry.total_steps, 0);
    const complete = completions.reduce((sum, entry) => sum + entry.completed_steps, 0);
    return { date, day: dateLabel(date, { weekday: 'short' }), water: entries.length ? entries.reduce((sum, entry) => sum + entry.amount_ml, 0) : null, skin: checkins.length ? Number((checkins.reduce((sum, entry) => sum + entry.skin_rating, 0) / checkins.length).toFixed(1)) : null, routinePct: total ? Math.round(complete / total * 100) : null };
  });
  const ratings = data.journal.filter((entry) => entry.skin_rating != null);
  const avg = ratings.length ? (ratings.reduce((sum, entry) => sum + entry.skin_rating, 0) / ratings.length).toFixed(1) : null;
  const completed = data.completions.reduce((sum, item) => sum + item.completed_steps, 0);
  const possible = data.completions.reduce((sum, item) => sum + item.total_steps, 0);
  const weeklyJournal = data.journal.filter((entry) => entry.entry_date >= days[0].date);
  return { days, avg, checkins: data.journal.length, routinePct: possible ? Math.round(completed / possible * 100) : null, completedRoutines: data.completions.filter((entry) => entry.completed_steps > 0).length, weeklyJournal: weeklyJournal.length, waterDays: new Set(data.water.map((entry) => entry.entry_date)).size, totalWater: data.water.reduce((sum, entry) => sum + entry.amount_ml, 0) };
}

export function recentActivity(data) {
  const events = [
    ...data.journal.map((entry) => ({ date: entry.entry_date, text: `Journal check-in${entry.skin_rating ? ` · skin rating ${entry.skin_rating}/5` : ''}`, type: 'journal' })),
    ...data.water.map((entry) => ({ date: entry.entry_date, text: `Water logged · ${entry.amount_ml.toLocaleString()} ml`, type: 'water' })),
    ...data.completions.filter((entry) => entry.completed_steps > 0).map((entry) => ({ date: entry.completed_on, text: `Routine steps completed · ${entry.completed_steps} of ${entry.total_steps}`, type: 'routine' })),
  ];
  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
}
