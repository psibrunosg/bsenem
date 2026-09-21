export function normalizeUserProfile(user = {}) {
  const xpMaxCandidate = Number(user.xpMax ?? user.xp_max ?? 1000);
  const bestStreakCandidate = Number(user.bestStreak ?? user.best_streak ?? 0);

  return {
    ...user,
    id: Number(user.id),
    level: Number(user.level ?? 1),
    xp: Number(user.xp ?? 0),
    xpMax: Number.isFinite(xpMaxCandidate) && xpMaxCandidate > 0 ? xpMaxCandidate : 1000,
    streak: Number(user.streak ?? 0),
    bestStreak: Number.isFinite(bestStreakCandidate) ? bestStreakCandidate : 0,
  };
}
