import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { Resend } from 'resend';
import { supabaseAdmin } from '../../../lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
// Protect the cron route
const authHeader = req.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;

console.log('CRON DEBUG:', {
  hasAuthorizationHeader: !!authHeader,
  hasCronSecret: !!cronSecret,
  authorizationStartsWithBearer:
    authHeader?.startsWith('Bearer ') ?? false,
});

if (
  !cronSecret ||
  authHeader !== `Bearer ${cronSecret}`
) {
  return new NextResponse('Unauthorized', {
    status: 401,
  });
}

    const to = process.env.REPORT_TO_EMAIL;
    const from = process.env.REPORT_FROM_EMAIL;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!to || !from || !resendApiKey) {
      return new NextResponse(
        'Missing email environment variables',
        {
          status: 500,
        }
      );
    }

    // Get the previous month
    const now = new Date();

    const previousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    const year = previousMonth.getFullYear();
    const month = previousMonth.getMonth();

    const startDate = new Date(
      year,
      month,
      1
    );

    const endDate = new Date(
      year,
      month + 1,
      0
    );

    const start = startDate
      .toISOString()
      .slice(0, 10);

    const end = endDate
      .toISOString()
      .slice(0, 10);

    const monthName = previousMonth.toLocaleString(
      'en-US',
      {
        month: 'long',
        year: 'numeric',
      }
    );

    // Get all active employees
    const {
      data: employees,
      error: employeesError,
    } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('active', true)
      .order('name');

    if (employeesError) {
      console.error(
        'Employees error:',
        employeesError
      );

      return new NextResponse(
        'Employees database error: ' +
          employeesError.message,
        {
          status: 500,
        }
      );
    }

    // Get attendance for the entire previous month
    const {
      data: attendance,
      error: attendanceError,
    } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .gte('attendance_date', start)
      .lte('attendance_date', end);

    if (attendanceError) {
      console.error(
        'Attendance error:',
        attendanceError
      );

      return new NextResponse(
        'Attendance database error: ' +
          attendanceError.message,
        {
          status: 500,
        }
      );
    }

    // Create Excel workbook
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

    // Add every employee
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

    // Bold header
    worksheet.getRow(1).font = {
      bold: true,
    };

    // Convert Excel to Base64 for Resend
    const attachment = Buffer.from(
      await workbook.xlsx.writeBuffer()
    ).toString('base64');

    // Send email
    const resend = new Resend(
      resendApiKey
    );

    const result =
      await resend.emails.send({
        from,
        to,
        subject:
          `StaffTrack Monthly Attendance Report — ${monthName}`,
        text:
          `Attached is the complete StaffTrack employee attendance report for ${monthName}.`,
        attachments: [
          {
            filename:
              `attendance-${year}-${String(
                month + 1
              ).padStart(2, '0')}.xlsx`,
            content: attachment,
          },
        ],
      });

    console.log(
      'Monthly attendance report sent:',
      result
    );

    return NextResponse.json({
      success: true,
      message:
        `Monthly attendance report for ${monthName} sent successfully.`,
      email: to,
    });
  } catch (error) {
    console.error(
      'Monthly report error:',
      error
    );

    return new NextResponse(
      'MONTHLY REPORT ERROR: ' +
        (error instanceof Error
          ? error.message
          : String(error)),
      {
        status: 500,
      }
    );
  }
}