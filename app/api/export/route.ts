import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', {
        status: 401,
      });
    }

    const token = authorization.substring(7);

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new NextResponse('Invalid or expired login session.', {
        status: 401,
      });
    }

    const month =
      req.nextUrl.searchParams.get('month') ||
      new Date().toISOString().slice(0, 7) + '-01';

    const start = new Date(month);

    const end = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0
    );

    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    const {
      data: employees,
      error: employeesError,
    } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('active', true)
      .order('name');

    if (employeesError) {
      return new NextResponse(
        'Employees database error: ' +
          employeesError.message,
        {
          status: 500,
        }
      );
    }

    const {
      data: attendance,
      error: attendanceError,
    } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate);

    if (attendanceError) {
      return new NextResponse(
        'Attendance database error: ' +
          attendanceError.message,
        {
          status: 500,
        }
      );
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'StaffTrack';
    workbook.created = new Date();

    const worksheet =
      workbook.addWorksheet('Attendance');

    worksheet.columns = [
      {
        header: 'Employee ID',
        key: 'employee_code',
        width: 18,
      },
      {
        header: 'Employee',
        key: 'name',
        width: 25,
      },
      {
        header: 'Department',
        key: 'department',
        width: 20,
      },
      {
        header: 'Present',
        key: 'present',
        width: 12,
      },
      {
        header: 'Absent',
        key: 'absent',
        width: 12,
      },
      {
        header: 'Leave',
        key: 'leave',
        width: 12,
      },
      {
        header: 'Half Day',
        key: 'half_day',
        width: 12,
      },
      {
        header: 'Marked Days',
        key: 'marked',
        width: 15,
      },
      {
        header: 'Attendance %',
        key: 'percentage',
        width: 18,
      },
    ];

    for (const employee of employees || []) {
      const employeeAttendance =
        (attendance || []).filter(
          (record) =>
            record.employee_id === employee.id
        );

      const count = (status: string) =>
        employeeAttendance.filter(
          (record) =>
            record.status === status
        ).length;

      const present = count('present');
      const absent = count('absent');
      const leave = count('leave');
      const halfDay = count('half_day');

      const markedDays =
        employeeAttendance.length;

      const percentage =
        markedDays > 0
          ? Math.round(
              ((present + halfDay * 0.5) /
                markedDays) *
                10000
            ) / 100
          : 0;

      worksheet.addRow({
        employee_code:
          employee.employee_code,
        name: employee.name,
        department:
          employee.department || '',
        present,
        absent,
        leave,
        half_day: halfDay,
        marked: markedDays,
        percentage,
      });
    }

    worksheet.getRow(1).font = {
      bold: true,
    };

    const buffer =
      await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

        'Content-Disposition':
          `attachment; filename="attendance-${startDate.slice(
            0,
            7
          )}.xlsx"`,

        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error(
      'Excel export error:',
      error
    );

    return new NextResponse(
      'EXPORT ERROR: ' +
        (error instanceof Error
          ? error.message
          : String(error)),
      {
        status: 500,
      }
    );
  }
}