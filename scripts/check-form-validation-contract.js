const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'docs', 'form-validation-inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const failures = [];

for (const form of inventory.forms) {
  const absolutePath = path.join(root, form.path);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${form.workflow}: missing ${form.path}`);
    continue;
  }
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (form.status !== 'migrated') failures.push(`${form.workflow}: inventory status is ${form.status}`);
  if (!source.includes('useFormValidation')) failures.push(`${form.workflow}: shared validation hook is not used`);
  if (!source.includes('FormErrorSummary')) failures.push(`${form.workflow}: foreground error summary is missing`);
  if (!source.includes('FieldError') && !source.includes('role="alert"')) failures.push(`${form.workflow}: inline field errors are missing`);
  for (const fieldId of form.requiredControlIds) {
    if (!source.includes(fieldId)) failures.push(`${form.workflow}: required control ID ${fieldId} is not present`);
  }
}

const sharedRequirements = [
  ['src/lib/utils/form-validation.ts', ['scrollIntoView', 'aria-invalid', 'queueMicrotask', 'active === false']],
  ['src/components/ui/form-feedback.tsx', ['role="alert"', 'aria-live="assertive"', 'sticky']],
  ['src/components/ui/input.tsx', ['aria-invalid:border-red-600']],
  ['src/components/ui/textarea.tsx', ['aria-invalid:border-red-600']],
  ['src/components/ui/select.tsx', ['aria-invalid:border-red-600']],
  ['src/components/common/date-picker.tsx', ['triggerProps']],
  ['src/components/ui/toast.tsx', ['z-[2000000]']],
];

for (const [relativePath, tokens] of sharedRequirements) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const token of tokens) {
    if (!source.includes(token)) failures.push(`${relativePath}: missing contract token ${token}`);
  }
}

if (failures.length) {
  console.error('FORM_VALIDATION_CONTRACT_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`FORM_VALIDATION_CONTRACT_OK (${inventory.forms.length} operational forms)`);
