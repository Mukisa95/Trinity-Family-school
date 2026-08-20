import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFieldValidation,
  getValidationError,
  isEmptyFormValue,
  updateFieldErrorState,
  validateForm,
} from '../src/lib/utils/form-validation';

test('empty-value semantics preserve valid zero and false values', () => {
  assert.equal(isEmptyFormValue(undefined), true);
  assert.equal(isEmptyFormValue(null), true);
  assert.equal(isEmptyFormValue('   '), true);
  assert.equal(isEmptyFormValue([]), true);
  assert.equal(isEmptyFormValue(0), false);
  assert.equal(isEmptyFormValue(false), false);
  assert.equal(isEmptyFormValue(['value']), false);
});

test('optional empty values are valid while required whitespace is rejected', () => {
  const optional = createFieldValidation('notes', ' ', 'Notes');
  const required = createFieldValidation('surname', ' ', 'Surname', true, {
    message: 'Enter the pupil\u2019s surname.',
  });
  assert.equal(getValidationError(optional, [optional]), undefined);
  assert.equal(getValidationError(required, [required]), 'Enter the pupil\u2019s surname.');
});

test('custom validators run after required validation succeeds', () => {
  const amount = createFieldValidation('amount', 0, 'Amount', true, {
    validate: (value) => Number(value) > 0 ? undefined : 'Enter an amount greater than zero.',
  });
  assert.equal(getValidationError(amount, [amount]), 'Enter an amount greater than zero.');
});

test('inactive conditional fields are ignored', () => {
  const hidden = createFieldValidation('otherType', '', 'Other type', true, {
    active: false,
  });
  assert.equal(validateForm([hidden]).isValid, true);
});

test('blur-style field validation adds an error and correction clears it immediately', () => {
  const invalid = createFieldValidation('surname', ' ', 'Surname', true, { message: 'Enter the surname.' });
  const withError = updateFieldErrorState({}, invalid, [invalid]);
  assert.equal(withError.surname.message, 'Enter the surname.');

  const corrected = createFieldValidation('surname', 'ODEKE', 'Surname', true, { message: 'Enter the surname.' });
  const cleared = updateFieldErrorState(withError, corrected, [corrected]);
  assert.deepEqual(cleared, {});
});

test('multiple errors retain declaration order and human-readable labels', () => {
  const fields = [
    createFieldValidation('first', '', 'First field', true),
    createFieldValidation('second', '', 'Second field', true),
  ];
  const result = validateForm(fields);
  assert.deepEqual(result.errors.map(({ id, label }) => ({ id, label })), [
    { id: 'first', label: 'First field' },
    { id: 'second', label: 'Second field' },
  ]);
  assert.equal(result.firstMissingFieldId, 'first');
});

test('field-specific validation remains separate from general submission failures', () => {
  const fields = [createFieldValidation('name', '', 'Name', true)];
  const result = validateForm(fields);
  assert.equal(result.errors.length, 1);
  assert.equal('submissionError' in result, false);
});
