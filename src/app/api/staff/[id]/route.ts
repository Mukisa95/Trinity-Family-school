import { NextResponse } from 'next/server';
import { StaffService } from '@/lib/services/staff.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const staff = await StaffService.getStaffById(id);

    if (!staff) {
      return new NextResponse(JSON.stringify({ error: 'Staff member not found' }), {
        status: 404,
      });
    }

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const staff = await StaffService.updateStaff(id, body);
    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error updating staff member:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await StaffService.deleteStaff(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
    });
  }
} 