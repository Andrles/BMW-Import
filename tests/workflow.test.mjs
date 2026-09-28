import test from 'node:test';
import assert from 'node:assert/strict';
import {sameQuote, fieldForError} from '../public/workflow.mjs';
test('unchanged quote can reopen; changed price, company or tariff produces new quote', () => {
 const input={price:'200000', cny:'12', confirmSpecs:true};
 const company={name:'Company',contact:'Contact'};
 const rates={version:'test',vat:.22};
 const q={input,company,rates};
 assert.equal(sameQuote(q,{confirmSpecs:true,cny:'12',price:'200000'},{contact:'Contact',name:'Company'},{vat:.22,version:'test'}),true);
 for (const [i,c,r] of [[{...input,price:'200001'},company,rates],[input,{...company,contact:'New'},rates],[input,company,{...rates,vat:.20}]]) assert.equal(sameQuote(q,i,c,r),false);
});
test('validation directs operators to visible controls, not hidden dates', () => {
 assert.equal(fieldForError('Укажите дату изготовления.'),'productionMonth');
 assert.equal(fieldForError('Дата изготовления не может быть позже даты расчёта.',{productionDate:'2027-01-15'}),'productionYear');
 assert.equal(fieldForError('Укажите дату изготовления.',{productionMonth:'06'}),'productionYear');
 assert.equal(fieldForError('Укажите дату официального курса.'),'rateDate');
 assert.equal(fieldForError('Заполните поле «Цена автомобиля».'),'price');
 assert.equal(fieldForError('«Мощность для утильсбора, кВт»: введите неотрицательное число.'),'kw');
 assert.equal(fieldForError('Ставка по этому коду ТН ВЭД не загружена.'),null);
});
