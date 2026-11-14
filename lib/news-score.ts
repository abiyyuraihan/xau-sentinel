// Penilaian judul berita berbasis kamus kata kunci.
// dir: +1 = secara umum mendukung emas, -1 = menekan emas.
// Ini pendekatan kasar: tidak memahami konteks, sarkasme, atau berita lama yang
// diangkat ulang. Gunakan sebagai penyaring awal, lalu baca beritanya sendiri.

export type LexiconRule = { tag: string; dir: -1 | 1; weight: number; re: RegExp };

export const LEXICON: LexiconRule[] = [
  {
    tag: "Geopolitik memanas",
    dir: 1,
    weight: 3,
    re: /\b(war|invasion|invade[sd]?|air ?strikes?|missiles?|nuclear|attack(s|ed)?|strikes? on|bomb(s|ed|ing)?|troops|military action|escalat\w+|coup|blockade|retaliat\w+|martial law|assassinat\w+|hostilities)\b/i,
  },
  {
    tag: "Geopolitik mereda",
    dir: -1,
    weight: 2,
    re: /\b(ceasefire|cease-fire|truce|peace (deal|talks|agreement|plan|accord)|de-?escalat\w+)\b/i,
  },
  {
    tag: "Sanksi dan perang dagang",
    dir: 1,
    weight: 2,
    re: /\b(sanctions?|tariffs?|trade war|export (ban|controls?)|embargo)\b/i,
  },
  {
    tag: "Tekanan sistem keuangan",
    dir: 1,
    weight: 2,
    re: /\b(bank (failure|run|collapse)|defaults?|debt ceiling|government shutdown|downgrade[sd]?|recession|financial crisis|contagion|bailout|market (crash|rout|turmoil|sell-?off))\b/i,
  },
  {
    tag: "The Fed melunak",
    dir: 1,
    weight: 2,
    re: /\b(rate cuts?|cuts? (interest )?rates|cut rates|dovish|monetary easing|lower(s|ed|ing)? (interest )?rates|quantitative easing)\b/i,
  },
  {
    tag: "The Fed mengetat",
    dir: -1,
    weight: 2,
    re: /\b(rate hikes?|hikes? (interest )?rates|raises? (interest )?rates|hawkish|higher for longer|tightening|no rush to cut)\b/i,
  },
  {
    tag: "Dolar atau yield naik",
    dir: -1,
    weight: 1.5,
    re: /\b(dollar (rall\w+|surges?|jumps?|strengthens?|climbs?|gains?|firms?|rises?)|yields? (surge|jump|rise|climb|spike)s?|stronger dollar)\b/i,
  },
  {
    tag: "Dolar atau yield turun",
    dir: 1,
    weight: 1.5,
    re: /\b(dollar (slides?|falls?|weakens?|drops?|slips?|tumbles?|sinks?)|yields? (fall|drop|slide|slip|tumble|sink)s?|weaker dollar)\b/i,
  },
  {
    tag: "Permintaan emas",
    dir: 1,
    weight: 1.5,
    re: /\b((gold|bullion) (hits|sets|reaches|surges|soars|jumps|rallies|climbs|rises|gains|extends gains)|safe[- ]haven (demand|bid|flows?|buying)|central banks? (buy\w*|purchas\w+|add\w*) gold|gold etf inflows?)\b|\b(gold|bullion)\b.{0,40}\brecord\b/i,
  },
  {
    tag: "Tekanan jual emas",
    dir: -1,
    weight: 1.5,
    re: /\b((gold|bullion) (falls|drops|slides|slips|tumbles|plunges|retreats|sinks|eases|dips|loses)|gold etf outflows?)\b/i,
  },
];

const URGENT = /\b(breaking|urgent|emergency|just in|flash|live updates?)\b/i;

export type Scored = { score: number; tags: string[]; urgent: boolean };

export function scoreHeadline(title: string): Scored {
  const tags: string[] = [];
  let score = 0;
  for (const rule of LEXICON) {
    if (rule.re.test(title)) {
      tags.push(rule.tag);
      score += rule.dir * rule.weight;
    }
  }
  const urgent = URGENT.test(title);
  if (urgent) score *= 1.5;
  score = Math.max(-6, Math.min(6, score));
  return { score: Math.round(score * 10) / 10, tags, urgent };
}
