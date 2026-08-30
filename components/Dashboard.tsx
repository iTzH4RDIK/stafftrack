'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '../lib/supabase-browser';

type Emp = {
  id: string;
  employee_code: string;
  name: string;
  phone: string | null;
  department: string | null;
  joining_date: string;
};

type Att = {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: string;
  marked_by: string | null;
};

const today = () =>
  new Date().toISOString().slice(0, 10);

const monthStart = () => {
  const d = new Date();

  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-01'
  );
};

const formatDate = (date: string) => {
  if (!date) return '—';

  return new Date(
    date + 'T00:00:00'
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const dayName = (date: string) => {
  return new Date(
    date + 'T00:00:00'
  ).toLocaleDateString('en-IN', {
    weekday: 'long',
  });
};

export default function Dashboard({
  email,
}: {
  email: string;
}) {
  const sb = supabaseBrowser();

  const [emps, setEmps] = useState<Emp[]>([]);
  const [atts, setAtts] = useState<Att[]>([]);

  const [date, setDate] = useState(today());
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] =
    useState('all');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [tab, setTab] = useState<
    'attendance' | 'employees' | 'reports'
  >('attendance');

  const [loading, setLoading] =
    useState(false);

  const [form, setForm] = useState({
    name: '',
    employee_code: '',
    phone: '',
    department: '',
    joining_date: today(),
  });

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    name: '',
    employee_code: '',
    phone: '',
    department: '',
    joining_date: today(),
  });

  const [selectedEmployee, setSelectedEmployee] =
    useState<Emp | null>(null);

  const [history, setHistory] =
    useState<Att[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [historyMonth, setHistoryMonth] =
    useState(
      monthStart().slice(0, 7)
    );

  const [editingAttendanceId, setEditingAttendanceId] =
    useState<string | null>(null);

  const [editingAttendanceStatus, setEditingAttendanceStatus] =
    useState('');

  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    setMsg('');

    const {
      data: employees,
      error: employeeError,
    } = await sb
      .from('employees')
      .select('*')
      .order('name');

    if (employeeError) {
      setMsg(
        'Employee loading error: ' +
          employeeError.message
      );
      setLoading(false);
      return;
    }

    setEmps((employees || []) as Emp[]);

    const {
      data: attendance,
      error: attendanceError,
    } = await sb
      .from('attendance')
      .select('*')
      .eq('attendance_date', date);

    if (attendanceError) {
      setMsg(
        'Attendance loading error: ' +
          attendanceError.message
      );
      setLoading(false);
      return;
    }

    setAtts((attendance || []) as Att[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [date]);

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        emps
          .map((e) => e.department)
          .filter(
            (d): d is string =>
              !!d && d.trim() !== ''
          )
      )
    ).sort();
  }, [emps]);

  const status = (id: string) =>
    atts.find(
      (a) => a.employee_id === id
    )?.status || '';

  const filtered = useMemo(() => {
    return emps.filter((e) => {
      const textMatch = (
        e.name +
        ' ' +
        e.employee_code +
        ' ' +
        (e.phone || '') +
        ' ' +
        (e.department || '')
      )
        .toLowerCase()
        .includes(search.toLowerCase());

      const departmentMatch =
        departmentFilter === 'all' ||
        e.department ===
          departmentFilter;

      const employeeStatus =
        status(e.id);

      const statusMatch =
        statusFilter === 'all' ||
        employeeStatus === statusFilter;

      return (
        textMatch &&
        departmentMatch &&
        statusMatch
      );
    });
  }, [
    emps,
    search,
    departmentFilter,
    statusFilter,
    atts,
  ]);

  const counts = useMemo(() => {
    return {
      p: atts.filter(
        (a) => a.status === 'present'
      ).length,

      a: atts.filter(
        (a) => a.status === 'absent'
      ).length,

      l: atts.filter(
        (a) => a.status === 'leave'
      ).length,

      h: atts.filter(
        (a) => a.status === 'half_day'
      ).length,

      unmarked:
        emps.length -
        atts.length,
    };
  }, [atts, emps]);

  const attendancePercentage =
    emps.length === 0
      ? 0
      : Math.round(
          (counts.p / emps.length) *
            100
        );

  async function mark(
    id: string,
    newStatus: string
  ) {
    setMsg('Updating attendance...');

    const {
      data: { user },
    } = await sb.auth.getUser();

    const { error } = await sb
      .from('attendance')
      .upsert(
        {
          employee_id: id,
          attendance_date: date,
          status: newStatus,
          marked_by: user?.id || null,
        },
        {
          onConflict:
            'employee_id,attendance_date',
        }
      );

    if (error) {
      setMsg(
        'Attendance error: ' +
          error.message
      );
      return;
    }

    setMsg(
      'Attendance updated successfully.'
    );

    await load();
  }

  async function add() {
    setMsg('');

    if (!form.name.trim()) {
      setMsg('Please enter employee name.');
      return;
    }

    if (!form.employee_code.trim()) {
      setMsg('Please enter Employee ID.');
      return;
    }

    setMsg('Adding employee...');

    const { error } = await sb
      .from('employees')
      .insert({
        name: form.name.trim(),
        employee_code:
          form.employee_code.trim(),
        phone:
          form.phone.trim() || null,
        department:
          form.department.trim() || null,
        joining_date:
          form.joining_date,
      });

    if (error) {
      setMsg(
        'Add employee error: ' +
          error.message
      );
      return;
    }

    setForm({
      name: '',
      employee_code: '',
      phone: '',
      department: '',
      joining_date: today(),
    });

    setMsg(
      'Employee added successfully.'
    );

    await load();
  }

  function startEdit(e: Emp) {
    setEditingId(e.id);

    setEditForm({
      name: e.name,
      employee_code: e.employee_code,
      phone: e.phone || '',
      department: e.department || '',
      joining_date: e.joining_date,
    });

    setMsg('');
  }

  function cancelEdit() {
    setEditingId(null);

    setEditForm({
      name: '',
      employee_code: '',
      phone: '',
      department: '',
      joining_date: today(),
    });

    setMsg('');
  }

  async function saveEdit() {
    if (!editingId) {
      setMsg(
        'No employee selected for editing.'
      );
      return;
    }

    if (!editForm.name.trim()) {
      setMsg(
        'Please enter employee name.'
      );
      return;
    }

    if (!editForm.employee_code.trim()) {
      setMsg(
        'Please enter Employee ID.'
      );
      return;
    }

    setMsg('Saving changes...');

    try {
      const { error } = await sb
        .from('employees')
        .update({
          name: editForm.name.trim(),
          employee_code:
            editForm.employee_code.trim(),
          phone:
            editForm.phone.trim() || null,
          department:
            editForm.department.trim() ||
            null,
          joining_date:
            editForm.joining_date,
        })
        .eq('id', editingId);

      if (error) {
        setMsg(
          'Save changes error: ' +
            error.message
        );
        return;
      }

      const {
        data: updatedEmployee,
        error: verifyError,
      } = await sb
        .from('employees')
        .select('*')
        .eq('id', editingId)
        .maybeSingle();

      if (verifyError) {
        setMsg(
          'Could not verify update: ' +
            verifyError.message
        );
        return;
      }

      if (!updatedEmployee) {
        setMsg(
          'Employee was not found after update.'
        );
        return;
      }

      setEmps((current) =>
        current.map((employee) =>
          employee.id === editingId
            ? (updatedEmployee as Emp)
            : employee
        )
      );

      setEditingId(null);

      setEditForm({
        name: '',
        employee_code: '',
        phone: '',
        department: '',
        joining_date: today(),
      });

      setMsg(
        'Employee updated successfully.'
      );
    } catch (error) {
      setMsg(
        'Save changes error: ' +
          (error instanceof Error
            ? error.message
            : String(error))
      );
    }
  }

  async function removeEmployee(
    id: string,
    name: string
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to permanently remove ${name}?`
      );

    if (!confirmed) return;

    setMsg('Removing employee...');

    try {
      const {
        error: attendanceError,
      } = await sb
        .from('attendance')
        .delete()
        .eq('employee_id', id);

      if (attendanceError) {
        setMsg(
          'Could not remove attendance records: ' +
            attendanceError.message
        );
        return;
      }

      const {
        error: employeeError,
      } = await sb
        .from('employees')
        .delete()
        .eq('id', id);

      if (employeeError) {
        setMsg(
          'Could not remove employee: ' +
            employeeError.message
        );
        return;
      }

      setEmps((current) =>
        current.filter(
          (employee) =>
            employee.id !== id
        )
      );

      setAtts((current) =>
        current.filter(
          (attendance) =>
            attendance.employee_id !== id
        )
      );

      if (editingId === id) {
        cancelEdit();
      }

      setMsg(
        `${name} removed successfully.`
      );
    } catch (error) {
      setMsg(
        'Remove employee error: ' +
          (error instanceof Error
            ? error.message
            : String(error))
      );
    }
  }

  async function openHistory(
    employee: Emp
  ) {
    setSelectedEmployee(employee);
    setHistoryLoading(true);
    setMsg('');

    const start =
      historyMonth + '-01';

    const endDate = new Date(
      Number(historyMonth.slice(0, 4)),
      Number(historyMonth.slice(5, 7)),
      0
    );

    const end =
      endDate.getFullYear() +
      '-' +
      String(
        endDate.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        endDate.getDate()
      ).padStart(2, '0');

    const {
      data,
      error,
    } = await sb
      .from('attendance')
      .select('*')
      .eq(
        'employee_id',
        employee.id
      )
      .gte(
        'attendance_date',
        start
      )
      .lte(
        'attendance_date',
        end
      )
      .order(
        'attendance_date',
        {
          ascending: false,
        }
      );

    if (error) {
      setMsg(
        'History error: ' +
          error.message
      );
      setHistoryLoading(false);
      return;
    }

    setHistory(
      (data || []) as Att[]
    );

    setHistoryLoading(false);
  }

  async function changeHistoryMonth(
    value: string
  ) {
    setHistoryMonth(value);

    if (!selectedEmployee) return;

    setHistoryLoading(true);

    const start =
      value + '-01';

    const endDate = new Date(
      Number(value.slice(0, 4)),
      Number(value.slice(5, 7)),
      0
    );

    const end =
      endDate.getFullYear() +
      '-' +
      String(
        endDate.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        endDate.getDate()
      ).padStart(2, '0');

    const {
      data,
      error,
    } = await sb
      .from('attendance')
      .select('*')
      .eq(
        'employee_id',
        selectedEmployee.id
      )
      .gte(
        'attendance_date',
        start
      )
      .lte(
        'attendance_date',
        end
      )
      .order(
        'attendance_date',
        {
          ascending: false,
        }
      );

    if (error) {
      setMsg(
        'History error: ' +
          error.message
      );
      setHistoryLoading(false);
      return;
    }

    setHistory(
      (data || []) as Att[]
    );

    setHistoryLoading(false);
  }

  async function updateHistoryAttendance(
    id: string
  ) {
    if (!editingAttendanceStatus) {
      return;
    }

    const { error } = await sb
      .from('attendance')
      .update({
        status:
          editingAttendanceStatus,
      })
      .eq('id', id);

    if (error) {
      setMsg(
        'Attendance update error: ' +
          error.message
      );
      return;
    }

    setHistory((current) =>
      current.map((a) =>
        a.id === id
          ? {
              ...a,
              status:
                editingAttendanceStatus,
            }
          : a
      )
    );

    setEditingAttendanceId(null);
    setEditingAttendanceStatus('');

    setMsg(
      'Attendance updated successfully.'
    );

    await load();
  }

  function historyStats() {
    const present =
      history.filter(
        (a) => a.status === 'present'
      ).length;

    const absent =
      history.filter(
        (a) => a.status === 'absent'
      ).length;

    const leave =
      history.filter(
        (a) => a.status === 'leave'
      ).length;

    const half =
      history.filter(
        (a) => a.status === 'half_day'
      ).length;

    const marked =
      present +
      absent +
      leave +
      half;

    const percentage =
      marked === 0
        ? 0
        : Math.round(
            ((present +
              half * 0.5) /
              marked) *
              100
          );

    return {
      present,
      absent,
      leave,
      half,
      marked,
      percentage,
    };
  }

  async function downloadExcel() {
    setMsg(
      'Generating Excel report...'
    );

    try {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!session?.access_token) {
        setMsg(
          'Please sign in again.'
        );
        return;
      }

      const month = monthStart();

      const response = await fetch(
        '/api/export?month=' +
          month,
        {
          method: 'GET',
          headers: {
            Authorization:
              'Bearer ' +
              session.access_token,
          },
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        setMsg(
          errorText ||
            'Failed to generate Excel report.'
        );

        return;
      }

      const blob =
        await response.blob();

      if (blob.size === 0) {
        setMsg(
          'The Excel file was empty.'
        );
        return;
      }

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          'a'
        );

      link.href = url;

      link.download =
        'attendance-' +
        month.slice(0, 7) +
        '.xlsx';

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        url
      );

      setMsg(
        'Excel report downloaded successfully.'
      );
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : 'Failed to generate Excel report.'
      );
    }
  }

  async function logout() {
    await sb.auth.signOut();

    window.location.href =
      '/login';
  }

  const selectedStats =
    historyStats();

  return (
    <main className="shell">

      <div className="top">
        <div>
          <div className="brand">
            StaffTrack
          </div>

          <div className="muted">
            Signed in as {email}
          </div>
        </div>

        <button
          className="btn secondary"
          onClick={logout}
        >
          Sign out
        </button>
      </div>

      <div
        className="toolbar"
        style={{
          marginBottom: 16,
        }}
      >
        <button
          className={
            'btn ' +
            (tab === 'attendance'
              ? ''
              : 'secondary')
          }
          onClick={() =>
            setTab('attendance')
          }
        >
          Attendance
        </button>

        <button
          className={
            'btn ' +
            (tab === 'employees'
              ? ''
              : 'secondary')
          }
          onClick={() =>
            setTab('employees')
          }
        >
          Employees
        </button>

        <button
          className={
            'btn ' +
            (tab === 'reports'
              ? ''
              : 'secondary')
          }
          onClick={() =>
            setTab('reports')
          }
        >
          Reports
        </button>
      </div>

      {msg && (
        <div
          className="success"
          style={{
            marginBottom: 12,
          }}
        >
          {msg}
        </div>
      )}

      {tab === 'attendance' && (
        <>
          <div
            className="toolbar"
            style={{
              marginBottom: 16,
            }}
          >
            <input
              className="input"
              style={{
                maxWidth: 180,
              }}
              type="date"
              value={date}
              onChange={(e) =>
                setDate(
                  e.target.value
                )
              }
            />

            <input
              className="input"
              style={{
                maxWidth: 300,
              }}
              placeholder="Search employee..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />

            <select
              className="input"
              style={{
                maxWidth: 220,
              }}
              value={
                departmentFilter
              }
              onChange={(e) =>
                setDepartmentFilter(
                  e.target.value
                )
              }
            >
              <option value="all">
                All departments
              </option>

              {departments.map(
                (department) => (
                  <option
                    key={department}
                    value={
                      department
                    }
                  >
                    {department}
                  </option>
                )
              )}
            </select>

            <select
              className="input"
              style={{
                maxWidth: 180,
              }}
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
            >
              <option value="all">
                All status
              </option>

              <option value="present">
                Present
              </option>

              <option value="absent">
                Absent
              </option>

              <option value="leave">
                Leave
              </option>

              <option value="half_day">
                Half-day
              </option>

              <option value="">
                Not marked
              </option>
            </select>
          </div>

          <div
            className="grid stats"
            style={{
              marginBottom: 16,
            }}
          >
            <div className="card">
              <b>{emps.length}</b>

              <div className="muted">
                Employees
              </div>
            </div>

            <div className="card">
              <b>{counts.p}</b>

              <div className="muted">
                Present
              </div>
            </div>

            <div className="card">
              <b>{counts.a}</b>

              <div className="muted">
                Absent
              </div>
            </div>

            <div className="card">
              <b>{counts.l}</b>

              <div className="muted">
                Leave
              </div>
            </div>

            <div className="card">
              <b>{counts.h}</b>

              <div className="muted">
                Half-day
              </div>
            </div>

            <div className="card">
              <b>
                {attendancePercentage}%
              </b>

              <div className="muted">
                Attendance
              </div>
            </div>
          </div>

          <div className="card tablewrap">

            <div
              className="toolbar"
              style={{
                justifyContent:
                  'space-between',
                marginBottom: 12,
              }}
            >
              <h3>
                Attendance —{' '}
                {formatDate(date)}
              </h3>

              {loading && (
                <span className="muted">
                  Loading...
                </span>
              )}
            </div>

            <table>
              <thead>
                <tr>
                  <th>
                    Employee
                  </th>

                  <th>ID</th>

                  <th>
                    Status
                  </th>

                  <th>
                    Mark
                  </th>
                </tr>
              </thead>

              <tbody>
                {filtered.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="muted"
                    >
                      No employees found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(
                    (e) => (
                      <tr
                        key={e.id}
                      >
                        <td>
                          <b>
                            {e.name}
                          </b>

                          <div className="muted">
                            {e.department ||
                              ''}
                          </div>
                        </td>

                        <td>
                          {
                            e.employee_code
                          }
                        </td>

                        <td>
                          {status(
                            e.id
                          ) ? (
                            <span
                              className={
                                'badge ' +
                                ({
                                  present:
                                    'p',
                                  absent:
                                    'a',
                                  leave:
                                    'l',
                                  half_day:
                                    'h',
                                } as any)[
                                  status(
                                    e.id
                                  )
                                ]
                              }
                            >
                              {status(
                                e.id
                              ).replace(
                                '_',
                                ' '
                              )}
                            </span>
                          ) : (
                            <span className="muted">
                              Not marked
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="toolbar">

                            <button
                              className="btn"
                              onClick={() =>
                                mark(
                                  e.id,
                                  'present'
                                )
                              }
                            >
                              P
                            </button>

                            <button
                              className="btn danger"
                              onClick={() =>
                                mark(
                                  e.id,
                                  'absent'
                                )
                              }
                            >
                              A
                            </button>

                            <button
                              className="btn secondary"
                              onClick={() =>
                                mark(
                                  e.id,
                                  'leave'
                                )
                              }
                            >
                              L
                            </button>

                            <button
                              className="btn secondary"
                              onClick={() =>
                                mark(
                                  e.id,
                                  'half_day'
                                )
                              }
                            >
                              ½
                            </button>

                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'employees' && (
        <div className="grid two">

          <div className="card">

            <h3>
              {editingId
                ? 'Edit employee'
                : 'Add employee'}
            </h3>

            <div className="formgrid">

              <div>
                <label className="label">
                  Full name
                </label>

                <input
                  className="input"
                  value={
                    editingId
                      ? editForm.name
                      : form.name
                  }
                  onChange={(e) => {
                    if (editingId) {
                      setEditForm({
                        ...editForm,
                        name:
                          e.target.value,
                      });
                    } else {
                      setForm({
                        ...form,
                        name:
                          e.target.value,
                      });
                    }
                  }}
                />
              </div>

              <div>
                <label className="label">
                  Employee ID
                </label>

                <input
                  className="input"
                  value={
                    editingId
                      ? editForm.employee_code
                      : form.employee_code
                  }
                  onChange={(e) => {
                    if (editingId) {
                      setEditForm({
                        ...editForm,
                        employee_code:
                          e.target.value,
                      });
                    } else {
                      setForm({
                        ...form,
                        employee_code:
                          e.target.value,
                      });
                    }
                  }}
                />
              </div>

              <div>
                <label className="label">
                  Phone
                </label>

                <input
                  className="input"
                  value={
                    editingId
                      ? editForm.phone
                      : form.phone
                  }
                  onChange={(e) => {
                    if (editingId) {
                      setEditForm({
                        ...editForm,
                        phone:
                          e.target.value,
                      });
                    } else {
                      setForm({
                        ...form,
                        phone:
                          e.target.value,
                      });
                    }
                  }}
                />
              </div>

              <div>
                <label className="label">
                  Department
                </label>

                <input
                  className="input"
                  value={
                    editingId
                      ? editForm.department
                      : form.department
                  }
                  onChange={(e) => {
                    if (editingId) {
                      setEditForm({
                        ...editForm,
                        department:
                          e.target.value,
                      });
                    } else {
                      setForm({
                        ...form,
                        department:
                          e.target.value,
                      });
                    }
                  }}
                />
              </div>

              <div>
                <label className="label">
                  Joining date
                </label>

                <input
                  className="input"
                  type="date"
                  value={
                    editingId
                      ? editForm.joining_date
                      : form.joining_date
                  }
                  onChange={(e) => {
                    if (editingId) {
                      setEditForm({
                        ...editForm,
                        joining_date:
                          e.target.value,
                      });
                    } else {
                      setForm({
                        ...form,
                        joining_date:
                          e.target.value,
                      });
                    }
                  }}
                />
              </div>

            </div>

            {!editingId ? (
              <button
                className="btn"
                style={{
                  marginTop: 14,
                }}
                onClick={add}
              >
                Add employee
              </button>
            ) : (
              <div
                className="toolbar"
                style={{
                  marginTop: 14,
                }}
              >
                <button
                  className="btn"
                  onClick={
                    saveEdit
                  }
                >
                  Save changes
                </button>

                <button
                  className="btn secondary"
                  onClick={
                    cancelEdit
                  }
                >
                  Cancel
                </button>
              </div>
            )}

          </div>

          <div className="card tablewrap">

            <h3>
              Employees
            </h3>

            <table>

              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>
                    Department
                  </th>
                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {emps.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="muted"
                    >
                      No employees yet.
                    </td>
                  </tr>
                ) : (
                  emps.map(
                    (e) => (
                      <tr
                        key={e.id}
                      >
                        <td>
                          <b>
                            {e.name}
                          </b>

                          <div className="muted">
                            {e.phone ||
                              'No phone'}
                          </div>
                        </td>

                        <td>
                          {
                            e.employee_code
                          }
                        </td>

                        <td>
                          {e.department ||
                            '—'}
                        </td>

                        <td>
                          <div className="toolbar">

                            <button
                              className="btn secondary"
                              onClick={() =>
                                openHistory(
                                  e
                                )
                              }
                            >
                              History
                            </button>

                            <button
                              className="btn secondary"
                              onClick={() =>
                                startEdit(
                                  e
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="btn danger"
                              onClick={() =>
                                removeEmployee(
                                  e.id,
                                  e.name
                                )
                              }
                            >
                              Remove
                            </button>

                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>

            </table>

          </div>

        </div>
      )}

      {tab === 'reports' && (
        <div className="grid two">

          <div className="card">

            <h3>
              Excel report
            </h3>

            <p className="muted">
              Download the current
              month's attendance as
              an Excel file.
            </p>

            <button
              className="btn"
              onClick={
                downloadExcel
              }
            >
              Download Excel
            </button>

          </div>

          <div className="card">

            <h3>
              Current statistics
            </h3>

            <div
              style={{
                marginTop: 12,
              }}
            >
              <p>
                <b>
                  Total employees:
                </b>{' '}
                {emps.length}
              </p>

              <p>
                <b>
                  Present today:
                </b>{' '}
                {counts.p}
              </p>

              <p>
                <b>
                  Absent today:
                </b>{' '}
                {counts.a}
              </p>

              <p>
                <b>
                  On leave:
                </b>{' '}
                {counts.l}
              </p>

              <p>
                <b>
                  Half-day:
                </b>{' '}
                {counts.h}
              </p>

              <p>
                <b>
                  Not marked:
                </b>{' '}
                {counts.unmarked}
              </p>

              <p>
                <b>
                  Attendance:
                </b>{' '}
                {attendancePercentage}%
              </p>
            </div>

          </div>

        </div>
      )}

      {selectedEmployee && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{
              width: 'min(950px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >

            <div
              className="toolbar"
              style={{
                justifyContent:
                  'space-between',
              }}
            >
              <div>
                <h2>
                  {
                    selectedEmployee.name
                  }
                </h2>

                <div className="muted">
                  ID:{' '}
                  {
                    selectedEmployee.employee_code
                  }
                  {' • '}
                  {
                    selectedEmployee.department ||
                    'No department'
                  }
                </div>
              </div>

              <button
                className="btn secondary"
                onClick={() => {
                  setSelectedEmployee(
                    null
                  );
                  setHistory([]);
                }}
              >
                Close
              </button>
            </div>

            <div
              className="toolbar"
              style={{
                marginTop: 16,
                marginBottom: 16,
              }}
            >
              <input
                className="input"
                type="month"
                value={
                  historyMonth
                }
                onChange={(e) =>
                  changeHistoryMonth(
                    e.target.value
                  )
                }
              />
            </div>

            <div
              className="grid stats"
              style={{
                marginBottom: 16,
              }}
            >
              <div className="card">
                <b>
                  {
                    selectedStats.present
                  }
                </b>

                <div className="muted">
                  Present
                </div>
              </div>

              <div className="card">
                <b>
                  {
                    selectedStats.absent
                  }
                </b>

                <div className="muted">
                  Absent
                </div>
              </div>

              <div className="card">
                <b>
                  {
                    selectedStats.leave
                  }
                </b>

                <div className="muted">
                  Leave
                </div>
              </div>

              <div className="card">
                <b>
                  {
                    selectedStats.half
                  }
                </b>

                <div className="muted">
                  Half-day
                </div>
              </div>

              <div className="card">
                <b>
                  {
                    selectedStats.percentage
                  }%
                </b>

                <div className="muted">
                  Attendance
                </div>
              </div>
            </div>

            {historyLoading ? (
              <p className="muted">
                Loading attendance history...
              </p>
            ) : (
              <div className="tablewrap">
                <table>

                  <thead>
                    <tr>
                      <th>
                        Date
                      </th>

                      <th>
                        Day
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="muted"
                        >
                          No attendance
                          records for
                          this month.
                        </td>
                      </tr>
                    ) : (
                      history.map(
                        (a) => (
                          <tr
                            key={a.id}
                          >
                            <td>
                              {formatDate(
                                a.attendance_date
                              )}
                            </td>

                            <td>
                              {dayName(
                                a.attendance_date
                              )}
                            </td>

                            <td>
                              <span
                                className={
                                  'badge ' +
                                  ({
                                    present:
                                      'p',
                                    absent:
                                      'a',
                                    leave:
                                      'l',
                                    half_day:
                                      'h',
                                  } as any)[
                                    a.status
                                  ]
                                }
                              >
                                {a.status.replace(
                                  '_',
                                  ' '
                                )}
                              </span>
                            </td>

                            <td>
                              {editingAttendanceId ===
                              a.id ? (
                                <div className="toolbar">

                                  <select
                                    className="input"
                                    value={
                                      editingAttendanceStatus
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setEditingAttendanceStatus(
                                        e.target.value
                                      )
                                    }
                                  >
                                    <option value="present">
                                      Present
                                    </option>

                                    <option value="absent">
                                      Absent
                                    </option>

                                    <option value="leave">
                                      Leave
                                    </option>

                                    <option value="half_day">
                                      Half-day
                                    </option>
                                  </select>

                                  <button
                                    className="btn"
                                    onClick={() =>
                                      updateHistoryAttendance(
                                        a.id
                                      )
                                    }
                                  >
                                    Save
                                  </button>

                                  <button
                                    className="btn secondary"
                                    onClick={() => {
                                      setEditingAttendanceId(
                                        null
                                      );
                                      setEditingAttendanceStatus(
                                        ''
                                      );
                                    }}
                                  >
                                    Cancel
                                  </button>

                                </div>
                              ) : (
                                <button
                                  className="btn secondary"
                                  onClick={() => {
                                    setEditingAttendanceId(
                                      a.id
                                    );

                                    setEditingAttendanceStatus(
                                      a.status
                                    );
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </td>

                          </tr>
                        )
                      )
                    )}
                  </tbody>

                </table>
              </div>
            )}

          </div>
        </div>
      )}

    </main>
  );
}