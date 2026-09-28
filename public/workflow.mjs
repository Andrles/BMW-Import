// Compare the complete saved calculation, including company details and tariff snapshot.
// Property order must not make identical JSON objects different.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function sameQuote(quote, input, company, rates) {
  return JSON.stringify(canonical([quote.input, quote.company || {}, quote.rates])) ===
    JSON.stringify(canonical([input, company || {}, rates]));
}
export function fieldForError(message, input = {}) {
  const labels = [
    ['Цена автомобиля', 'price'], ['Курс покупки CNY', 'buyRate'],
    ['Курс ЦБ CNY', 'cny'], ['Курс ЦБ EUR', 'eur'],
    ['Мощность для утильсбора', 'kw'], ['Мощность для акциза', 'hp'],
    ['Объём двигателя', 'cc'], ['Доставка и страхование до границы', 'preBorder'],
    ['Доставка по России', 'postBorder'], ['Оформление и брокер', 'documents'],
    ['Прочие расходы', 'other'], ['Услуги компании', 'service'],
    ['Таможенная стоимость', 'customsOverride']
  ];
  const label = labels.find(([text]) => message.includes(text));
  if (label) return label[1];
  if (/изготовления|с 2020 года/i.test(message)) return input.productionDate || input.productionMonth ? 'productionYear' : 'productionMonth';
  if (/дат[ау] (официального )?курса/i.test(message)) return 'rateDate';
  if (/гибридной установки/.test(message)) return input.model === 'custom' ? 'type' : 'model';
  if (/сверку характеристик/.test(message)) return 'confirmSpecs';
  return null;
}
