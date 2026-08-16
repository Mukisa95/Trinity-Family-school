const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const rules = read("firestore.rules");
for (const collection of [
  "staffSalaryProfiles",
  "staffSalaryComponents",
  "staffSalaryPayments",
  "staffSalaryOccurrences",
  "staffSalaryAdjustments",
]) {
  assert(
    rules.includes(`match /${collection}/{documentPath=**}`),
    `${collection} needs an explicit Firestore rule.`,
  );
  assert(
    rules.includes(`collection != '${collection}'`),
    `${collection} must be excluded from the transitional catch-all rule.`,
  );
}

const permissions = read("src/types/permissions.ts");
const permissionService = read(
  "src/lib/services/granular-permissions.service.ts",
);
assert(
  permissions.includes("payroll: {"),
  "Payroll must be a granular permission module.",
);
assert(
  permissionService.includes("if (moduleId === 'payroll') return false;"),
  "Payroll must not inherit legacy module access.",
);

const server = read("src/lib/server/payroll.ts");
assert(
  server.includes("requirePayrollAccess"),
  "Every payroll route must use the payroll access guard.",
);
assert(
  server.includes("buildSalaryOccurrenceKey"),
  "Salary payments must use deterministic occurrence keys.",
);
assert(
  server.includes("occurrenceSnapshots = await Promise.all"),
  "Salary payment transaction must read all occurrences before writes.",
);

for (const route of [
  "src/app/api/payroll/overview/route.ts",
  "src/app/api/payroll/profiles/route.ts",
  "src/app/api/payroll/staff/[staffId]/route.ts",
  "src/app/api/payroll/staff/[staffId]/payments/route.ts",
  "src/app/api/payroll/staff/[staffId]/increase/route.ts",
]) {
  assert(
    read(route).includes("requireAppUser"),
    `${route} must authenticate the caller.`,
  );
  assert(
    read(route).includes("requirePayrollAccess"),
    `${route} must check a payroll permission.`,
  );
}

console.log("PAYROLL_CONTRACT_OK");
