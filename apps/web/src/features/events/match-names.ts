/** Names a new match starts with: one at random, for the organiser to keep or change */
export const MATCH_NAMES = [
  'Кубок двора',
  'Матч века',
  'Битва титанов',
  'Дерби района',
  'Классико по-нашему',
  'Лига чемпионов двора',
  'Чемпионат подъезда',
  'Золотой мяч',
  'Финал года',
  'Вечерний разгон',
  'Футбол после работы',
  'Схватка у ворот',
  'Последний свисток',
  'Матч без замен',
  'Ветераны в деле',
  'Сборная офиса',
] as const;

export const randomMatchName = (random = Math.random) =>
  MATCH_NAMES[Math.floor(random() * MATCH_NAMES.length)] ?? MATCH_NAMES[0];
