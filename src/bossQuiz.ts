export type BossQuizQuestion = {
  id?: string;
  question: string;
  answers: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

function isBossQuizQuestion(x: unknown): x is BossQuizQuestion {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.question !== 'string' || !o.question.trim()) return false;
  if (!Array.isArray(o.answers) || o.answers.length !== 4) return false;
  if (!o.answers.every((a) => typeof a === 'string')) return false;
  const ci = o.correctIndex;
  if (typeof ci !== 'number' || ci !== Math.floor(ci) || ci < 0 || ci > 3) return false;
  return true;
}

export function parseBossQuiz(raw: unknown): BossQuizQuestion[] {
  if (!raw || typeof raw !== 'object') return [];
  const qs = (raw as { questions?: unknown }).questions;
  if (!Array.isArray(qs)) return [];
  const out: BossQuizQuestion[] = [];
  for (const item of qs) {
    if (!isBossQuizQuestion(item)) continue;
    out.push(item);
  }
  return out;
}
