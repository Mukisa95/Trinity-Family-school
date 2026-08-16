import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { requireAppUser } from "@/lib/server/app-auth";
import {
  createSalaryProfile,
  requirePayrollAccess,
} from "@/lib/server/payroll";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAppUser(request);
    requirePayrollAccess(actor, "setup", "create_salary");
    const result = await createSalaryProfile(
      getFirestore(getFirebaseAdminApp()),
      actor,
      await request.json(),
    );
    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create the salary profile.";
    const status = ["AUTH_REQUIRED", "APP_AUTH_REQUIRED"].includes(message)
      ? 401
      : message === "PERMISSION_DENIED" || message === "ACCOUNT_INACTIVE"
        ? 403
        : message.includes("already exists")
          ? 409
          : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
