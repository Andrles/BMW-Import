// Purchase exchange rate is independent of the official customs rates.
export function rateReadiness(input) {
 const checked = input.rateCheckedDate === input.calcDate;
 const automatic = ['cbr', 'cache'].includes(input.rateState);
 const ready = (automatic && checked) || input.rateConfirmed === true;
 return {ready, checked, automatic, needsConfirmation: !ready};
}
export function needsRateRefresh(input, today) {
 return !input.cny || !input.eur || input.rateCheckedDate !== today;
}
export function tariffReminder(rates, today) {
 const days = Math.ceil((Date.parse(rates.validTo+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
 if(days < 0)return 'Срок таблицы ставок истёк. Для нового расчёта требуется обновление приложения.';
 if(days <= 90)return `Таблица ставок действует до ${rates.validTo.split('-').reverse().join('.')}. Перед расчётами на следующий период обновите приложение.`;
 return '';
}
