import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { requireAppUser } from "@/lib/server/app-auth";
import {
  requirePayrollAccess,
  scheduleSalaryIncrease,
} from "@/lib/server/payroll";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  try {
    const actor = await requireAppUser(request);
    requirePayrollAccess(actor, "detail", "increase_salary");
    const { staffId } = await params;
    const result = await scheduleSalaryIncrease(
      getFirestore(getFirebaseAdminApp()),
      actor,
      { ...(await request.json()), staffId },
    );
    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to schedule the salary increase.";
    const status = ["AUTH_REQUIRED", "APP_AUTH_REQUIRED"].includes(message)
      ? 401
      : message === "PERMISSION_DENIED" || message === "ACCOUNT_INACTIVE"
        ? 403
        : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
