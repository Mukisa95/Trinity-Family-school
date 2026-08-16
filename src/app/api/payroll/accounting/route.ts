import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { requireAppUser } from "@/lib/server/app-auth";
import {
  getPayrollAccounting,
  payrollAccountingRangeSchema,
  requirePayrollAccess,
} from "@/lib/server/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    requirePayrollAccess(actor, "overview", "view_payroll");
    const range = payrollAccountingRangeSchema.parse({
      startDate: request.nextUrl.searchParams.get("startDate"),
      endDate: request.nextUrl.searchParams.get("endDate"),
    });
    const result = await getPayrollAccounting(
      getFirestore(getFirebaseAdminApp()),
      range,
    );
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load payroll accounting.";
    const status = ["AUTH_REQUIRED", "APP_AUTH_REQUIRED"].includes(message)
      ? 401
      : message === "PERMISSION_DENIED" || message === "ACCOUNT_INACTIVE"
        ? 403
        : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
