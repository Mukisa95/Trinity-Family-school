import { NextResponse } from 'next/server';
import { StaffService } from '@/lib/services/staff.service';

export async function GET() {
  try {
    const staff = await StaffService.getAllStaff();
    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const staff = await StaffService.createStaff(body);
    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('Error creating staff member:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
} 