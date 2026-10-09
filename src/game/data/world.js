// Employers, districts, personal costs, courses and equipment for the career and business layers.
// Clinic names are fictional. Numbers are gameplay approximations of the St. Petersburg market:
// hh.ru median dentist pay in SPb was 123k ₽ (2025); state clinics 100–150k ₽; private clinics
// usually pay doctors a percentage, keeping up to 60% of the revenue.

export const EMPLOYERS = [
  {
    id: 'gp12', name: 'Городская стоматологическая поликлиника', short: 'Госполиклиника', district: 'Невский район', metro: 'Ломоносовская',
    pay: { type: 'salary', salary: 98000 }, priceFactor: 0.0, oms: true, patientsPerDay: 7, brand: 'Поликлиника',
    req: { rating: 0, reputation: 0 }, upholstery: [96, 124, 140],
    note: 'Пациенты по ОМС: лечение бесплатно для них, у вас оклад. Много пациентов, мало времени на каждого.',
  },
  {
    id: 'kupchino', name: 'Сеть «Улыбка на Купчинской»', short: 'Улыбка', district: 'Фрунзенский район', metro: 'Купчино',
    pay: { type: 'percent', percent: 0.25 }, priceFactor: 0.85, patientsPerDay: 6, brand: 'Улыбка',
    req: { rating: 0, reputation: 0 }, upholstery: [214, 120, 72],
    note: 'Эконом-сегмент, большой поток. 25% от выручки по вашим пациентам.',
  },
  {
    id: 'neva', name: 'Клиника «Невская стоматология»', short: 'Невская', district: 'Василеостровский район', metro: 'Василеостровская',
    pay: { type: 'percent', percent: 0.3 }, priceFactor: 1.0, patientsPerDay: 5, brand: 'Невская стоматология',
    req: { rating: 4.3, reputation: 20 }, upholstery: [44, 112, 117],
    note: 'Средний сегмент, вид на Неву. 30% от выручки.',
  },
  {
    id: 'aurora', name: 'Премиальная клиника «Аврора»', short: 'Аврора', district: 'Петроградский район', metro: 'Петроградская',
    pay: { type: 'percent', percent: 0.35 }, priceFactor: 1.45, patientsPerDay: 4, brand: 'Аврора',
    req: { rating: 4.7, reputation: 55 }, upholstery: [40, 40, 46],
    note: 'Премиум. Пациенты требовательные и платят больше. 35% от выручки.',
  },
];

export const DISTRICTS = [
  { id: 'central', name: 'Центральный', metro: 'Площадь Восстания', rent: 4800, demand: 1.25, income: 1.45 },
  { id: 'petrograd', name: 'Петроградский', metro: 'Петроградская', rent: 4200, demand: 1.15, income: 1.4 },
  { id: 'vo', name: 'Василеостровский', metro: 'Василеостровская', rent: 3300, demand: 1.05, income: 1.15 },
  { id: 'moscow', name: 'Московский', metro: 'Московская', rent: 2900, demand: 1.1, income: 1.1 },
  { id: 'primorsky', name: 'Приморский', metro: 'Комендантский проспект', rent: 2300, demand: 1.2, income: 1.0 },
  { id: 'vyborg', name: 'Выборгский', metro: 'Парнас', rent: 1900, demand: 1.15, income: 0.9 },
  { id: 'frunze', name: 'Фрунзенский', metro: 'Купчино', rent: 1800, demand: 1.1, income: 0.85 },
  { id: 'nevsky', name: 'Невский', metro: 'Ломоносовская', rent: 1800, demand: 1.05, income: 0.85 },
];

export const LIVING = {
  rent: 34000,  // studio flat
  living: 26000, // food, transport, phone
};

export const COURSES = [
  { id: 'endo', name: 'Современная эндодонтия', price: 45000, days: 2, gives: { endo: 12 }, unlocks: ['endoAdvanced'], text: 'Протоколы ирригации, апекслокация, поиск дополнительных каналов (MB2).' },
  { id: 'aesthetic', name: 'Художественная реставрация', price: 38000, days: 2, gives: { therapy: 10 }, text: 'Послойная техника, подбор цвета по шкале VITA.' },
  { id: 'surgery', name: 'Ординатура: стоматология хирургическая', price: 420000, days: 10, gives: { surgery: 20 }, unlocks: ['complexExtraction'], text: 'Два года обучения в реальности; в игре сжато. Открывает сложные удаления и курсы имплантологии.' },
  { id: 'implant', name: 'Имплантология: базовый курс', price: 120000, days: 3, requires: ['surgery'], gives: { implant: 20 }, unlocks: ['implant'], text: 'Планирование по КЛКТ, протоколы сверления, установка имплантов.' },
  { id: 'sinus', name: 'Синус-лифтинг и костная пластика', price: 150000, days: 3, requires: ['implant'], gives: { implant: 12 }, unlocks: ['sinusLift'], text: 'Работа при дефиците кости верхней челюсти.' },
  { id: 'communication', name: 'Психология общения с пациентом', price: 18000, days: 1, gives: { communication: 15 }, text: 'Как снимать тревогу, объяснять план лечения и цену.' },
];

// Equipment catalogue for an own clinic (rubles, gameplay approximations)
export const EQUIPMENT = [
  { id: 'unitEco', name: 'Стоматологическая установка (эконом)', price: 650000, perChair: true, quality: 0.9 },
  { id: 'unitMid', name: 'Стоматологическая установка (средний класс)', price: 1600000, perChair: true, quality: 1.0 },
  { id: 'unitPremium', name: 'Стоматологическая установка (премиум)', price: 3200000, perChair: true, quality: 1.08 },
  { id: 'autoclave', name: 'Автоклав класса B', price: 420000, required: true },
  { id: 'visio', name: 'Радиовизиограф', price: 380000, required: true },
  { id: 'compressor', name: 'Безмасляный компрессор и аспирация', price: 260000, required: true },
  { id: 'endo', name: 'Эндомотор с апекслокатором', price: 190000 },
  { id: 'microscope', name: 'Дентальный микроскоп', price: 2400000 },
  { id: 'physio', name: 'Физиодиспенсер и набор для имплантации', price: 450000 },
  { id: 'ct', name: 'Конусно-лучевой томограф (КЛКТ)', price: 6500000 },
];

export const STAFF = [
  { id: 'assistant', name: 'Ассистент стоматолога', salary: 62000 },
  { id: 'admin', name: 'Администратор', salary: 58000 },
  { id: 'nurse', name: 'Медсестра стерилизации', salary: 52000 },
  { id: 'doctor', name: 'Врач-стоматолог (30% от выручки)', percent: 0.3 },
  { id: 'hygienist', name: 'Гигиенист (30% от выручки)', percent: 0.3 },
];

export const CLINIC_RULES = {
  firstChairArea: 14, // m² per main dental unit (SP 2.1.3678-20)
  extraChairArea: 10, // m² per additional unit
  supportArea: 22,    // sterilisation room, waiting area, WC
  licenseFee: 7500,   // state duty
  licenseDays: 10,    // working days for review since May 2025
  renovationPerM2: 28000,
};
