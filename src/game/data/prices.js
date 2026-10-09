// Price list, St. Petersburg private dentistry, 2025–2026 (mid-market reference, rubles).
// Sources: ProDoctorov and 32top aggregators (average pulpitis treatment ~14.6k in Moskovsky district,
// implant ~52k average, wisdom tooth removal ~11–12.5k), clinic price lists. Rounded for gameplay.
export const PRICES = {
  consult: { name: 'Консультация и осмотр', price: 1500, minutes: 15 },
  xray: { name: 'Прицельный снимок (визиограф)', price: 700, minutes: 5 },
  ct: { name: 'КЛКТ одной челюсти', price: 4000, minutes: 15 },
  anesthesia: { name: 'Анестезия (артикаин)', price: 900, minutes: 5 },
  rubberDam: { name: 'Изоляция коффердамом', price: 1200, minutes: 5 },
  cariesSmall: { name: 'Лечение кариеса, пломба', price: 6500, minutes: 40 },
  cariesDeep: { name: 'Лечение глубокого кариеса', price: 8500, minutes: 50 },
  cariesFront: { name: 'Художественная реставрация', price: 11500, minutes: 60 },
  endo1: { name: 'Лечение пульпита, 1 канал', price: 9500, minutes: 60 },
  endo2: { name: 'Лечение пульпита, 2 канала', price: 12500, minutes: 75 },
  endo3: { name: 'Лечение пульпита, 3 канала', price: 15500, minutes: 90 },
  endo4: { name: 'Лечение пульпита, 4 канала', price: 18500, minutes: 105 },
  retreat: { name: 'Надбавка за лечение периодонтита', price: 4500, minutes: 20 },
  tempFilling: { name: 'Временная пломба', price: 1500, minutes: 10 },
  extractSimple: { name: 'Удаление зуба, простое', price: 4500, minutes: 30 },
  extractComplex: { name: 'Удаление зуба, сложное', price: 8000, minutes: 45 },
  extractWisdom: { name: 'Удаление зуба мудрости', price: 12000, minutes: 50 },
  extractImpacted: { name: 'Удаление ретинированного зуба', price: 18000, minutes: 70 },
  hygiene: { name: 'Профгигиена: ультразвук, Air-Flow, полировка, фторирование', price: 7000, minutes: 50 },
  implantStd: { name: 'Имплантация (имплант Корея)', price: 42000, minutes: 70, implantCost: 13000 },
  implantPremium: { name: 'Имплантация (Straumann)', price: 76000, minutes: 70, implantCost: 36000 },
  healingAbutment: { name: 'Установка формирователя десны', price: 5000, minutes: 20 },
  implantCrown: { name: 'Коронка из диоксида циркония на имплант', price: 38000, minutes: 40, labCost: 12000 },
  sinusLift: { name: 'Открытый синус-лифтинг', price: 45000, minutes: 60 },
  boneGraft: { name: 'Костная пластика', price: 25000, minutes: 40 },
  crown: { name: 'Коронка металлокерамика', price: 22000, minutes: 60, labCost: 7000 },
};

// Share of material cost in revenue for the clinic's books.
export const MATERIAL_SHARE = 0.12;

export function formatRub(n) {
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}
