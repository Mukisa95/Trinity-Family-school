import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { requireAppUser } from "@/lib/server/app-auth";
import { getPayrollOverview, requirePayrollAccess } from "@/lib/server/payroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    requirePayrollAccess(actor, "overview", "view_payroll");
    return NextResponse.json({
      success: true,
      ...(await getPayrollOverview(getFirestore(getFirebaseAdminApp()))),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load payroll.";
    const status = ["AUTH_REQUIRED", "APP_AUTH_REQUIRED"].includes(message)
      ? 401
      : message === "PERMISSION_DENIED" || message === "ACCOUNT_INACTIVE"
        ? 403
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
