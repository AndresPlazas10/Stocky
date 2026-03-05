import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceInput } from '../src/utils/formatters.js';

test('convierte miles con punto a numero entero', () => {
  assert.equal(parsePriceInput('5.000'), 5000);
});

test('acepta numero sin separador', () => {
  assert.equal(parsePriceInput('5000'), 5000);
});

test('convierte formato es-CO con coma decimal', () => {
  assert.equal(parsePriceInput('1.500,50'), 1500.5);
});

test('mantiene formato decimal con punto cuando no es separador de miles', () => {
  assert.equal(parsePriceInput('1500.50'), 1500.5);
});

test('limpia texto COP y espacios', () => {
  assert.equal(parsePriceInput(' 5.000 COP '), 5000);
});
