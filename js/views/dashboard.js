import { fetchComplianceData } from '../services/training-service.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/**
 * Determine compliance status for (employee, module).
 *
 * Returns: 'qualified' | 'expiring_soon' | 'expired' | 'failed' | 'not_started'
 */
function getComplianceStatus(employeeId, module, assessments, sessions) {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);

  if (module.assessment_type === 'scored_quiz') {
    // Find latest passing assessment for this employee + module
    const relevant = assessments
      .filter(a => a.trainee_id === employeeId && a.module_id === module.id && a.passed)
      .sort((a, b) => b.assessment_date.localeCompare(a.assessment_date));

    if (relevant.length === 0) {
      // Check if they have a failed attempt
      const failed = assessments.find(a => a.trainee_id === employeeId && a.module_id === module.id && !a.passed);
      return failed ? 'failed' : 'not_started';
    }

    const latest = relevant[0];
    if (!latest.expiry_date) return 'qualified';
    if (latest.expiry_date < today) return 'expired';
    if (latest.expiry_date <= soonStr) return 'expiring_soon';
    return 'qualified';
  } else {
    // Attendance only — find latest session with all_topics_covered
    const relevant = sessions
      .filter(s => s.trainee_id === employeeId && s.module_id === module.id && s.all_topics_covered)
      .sort((a, b) => b.session_date.localeCompare(a.session_date));

    if (relevant.length === 0) return 'not_started';

    const latest = relevant[0];
    // Apply refresher period
    const sessionDate = new Date(latest.session_date + 'T00:00:00');
    sessionDate.setMonth(sessionDate.getMonth() + module.refresher_period_months);
    const expiryStr = sessionDate.toISOString().slice(0, 10);

    if (expiryStr < today) return 'expired';
    if (expiryStr <= soonStr) return 'expiring_soon';
    return 'qualified';
  }
}

function statusToCell(status) {
  switch (status) {
    case 'qualified': return { cls: 'matrix-cell-green', icon: '\u2713' };
    case 'expiring_soon': return { cls: 'matrix-cell-yellow', icon: '\u26A0' };
    case 'expired': return { cls: 'matrix-cell-red', icon: '\u2717' };
    case 'failed': return { cls: 'matrix-cell-red', icon: '\u2717' };
    case 'not_started': return { cls: 'matrix-cell-grey', icon: '\u2014' };
    default: return { cls: 'matrix-cell-grey', icon: '?' };
  }
}

export async function render(el) {
  el.innerHTML = `
    <div class="page-header">
      <h1>Training Compliance</h1>
    </div>

    <div class="filter-bar">
      <input type="text" id="search-input" class="search-input" placeholder="Search by name...">
    </div>

    <div id="matrix-container">
      <div class="loading">Loading compliance data...</div>
    </div>
  `;

  const container = el.querySelector('#matrix-container');
  const searchInput = el.querySelector('#search-input');

  let data;
  try {
    data = await fetchComplianceData();
  } catch (err) {
    container.innerHTML = `<div class="error-banner"><p>Failed to load data: ${esc(err.message)}</p></div>`;
    return;
  }

  const { employees, modules, assessments, sessions } = data;

  if (modules.length === 0) {
    container.innerHTML = `
      <p class="empty-state">No active training modules. <a href="#/modules/new" class="btn-link">Create one</a> to get started.</p>
    `;
    return;
  }

  function renderMatrix() {
    const search = searchInput.value.toLowerCase().trim();
    let filtered = employees;
    if (search) {
      filtered = filtered.filter(e => e.full_name.toLowerCase().includes(search));
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-state">No employees found.</p>';
      return;
    }

    // Build matrix
    const rows = filtered.map(emp => {
      const cells = modules.map(mod => {
        const status = getComplianceStatus(emp.id, mod, assessments, sessions);
        return { status, ...statusToCell(status) };
      });
      return { emp, cells };
    });

    container.innerHTML = `
      <div class="matrix-container">
        <table class="matrix-table">
          <thead>
            <tr>
              <th>Employee</th>
              ${modules.map(m => `<th class="module-header" title="${esc(m.module_name)}">${esc(m.module_name)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td class="employee-name" data-id="${row.emp.id}">${esc(row.emp.full_name)}</td>
                ${row.cells.map((cell, i) => `
                  <td class="matrix-cell ${cell.cls}" data-emp="${row.emp.id}" data-mod="${modules[i].id}" title="${modules[i].module_name}: ${cell.status.replace('_', ' ')}">${cell.icon}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Click handlers
    container.querySelectorAll('.employee-name').forEach(td => {
      td.addEventListener('click', () => {
        window.location.hash = '#/employee/' + td.dataset.id;
      });
    });
    container.querySelectorAll('.matrix-cell').forEach(td => {
      td.addEventListener('click', () => {
        window.location.hash = '#/employee/' + td.dataset.emp;
      });
    });
  }

  searchInput.addEventListener('input', renderMatrix);
  renderMatrix();
}
