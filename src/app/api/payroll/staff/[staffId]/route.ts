import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { requireAppUser } from "@/lib/server/app-auth";
import { getStaffPayroll, requirePayrollAccess } from "@/lib/server/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  try {
    const actor = await requireAppUser(request);
    requirePayrollAccess(actor, "detail", "view_payment_history");
    const { staffId } = await params;
    const result = await getStaffPayroll(
      getFirestore(getFirebaseAdminApp()),
      staffId,
    );
    if (!result)
      return NextResponse.json(
        { success: false, error: "Salary profile not found." },
        { status: 404 },
      );
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the salary profile.";
    const status = ["AUTH_REQUIRED", "APP_AUTH_REQUIRED"].includes(message)
      ? 401
      : message === "PERMISSION_DENIED" || message === "ACCOUNT_INACTIVE"
        ? 403
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
