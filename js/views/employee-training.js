import { fetchEmployee, fetchAllSessions, fetchAllAssessments, fetchAllModules } from '../services/training-service.js';
import { formatDateShort } from '../utils/date-utils.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function render(el, employeeId) {
  const [employee, allSessions, allAssessments, modules] = await Promise.all([
    fetchEmployee(employeeId),
    fetchAllSessions(),
    fetchAllAssessments(),
    fetchAllModules(),
  ]);

  const sessions = allSessions.filter(s => s.trainee_id === employeeId);
  const assessments = allAssessments.filter(a => a.trainee_id === employeeId);

  // Build module name map
  const moduleMap = {};
  modules.forEach(m => { moduleMap[m.id] = m.module_name; });

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${esc(employee.full_name)}</h1>
        <p class="page-subtitle">Training History</p>
      </div>
      <div class="header-actions">
        <a href="#/session/new" class="btn btn-primary">Log Session</a>
        <a href="#/assessment/new" class="btn btn-secondary">Log Assessment</a>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-section">
        <h2>Training Sessions (${sessions.length})</h2>
        ${sessions.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Module</th>
                <th>All Covered</th>
                <th>Trainer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${sessions.map(s => `
                <tr class="clickable-row" data-href="#/session/${s.id}">
                  <td>${formatDateShort(s.session_date)}</td>
                  <td>${esc(s.training_modules?.module_name || moduleMap[s.module_id] || '\u2014')}</td>
                  <td>${s.all_topics_covered ? '<span class="score-pass">\u2713 Yes</span>' : '<span class="score-fail">\u2717 No</span>'}</td>
                  <td>${esc(s.trainer_name)}</td>
                  <td>${s.gdrive_pdf_link ? `<a href="${esc(s.gdrive_pdf_link)}" target="_blank" class="btn-link">Drive</a>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="empty-state">No training sessions recorded.</p>'}
      </div>

      <div class="detail-section">
        <h2>Assessments (${assessments.length})</h2>
        ${assessments.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Module</th>
                <th>Score</th>
                <th>Result</th>
                <th>Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${assessments.map(a => `
                <tr class="clickable-row" data-href="#/assessment/${a.id}">
                  <td>${formatDateShort(a.assessment_date)}</td>
                  <td>${esc(a.training_modules?.module_name || moduleMap[a.module_id] || '\u2014')}</td>
                  <td><span class="${a.passed ? 'score-pass' : 'score-fail'}">${a.score_achieved}/${a.max_score}</span></td>
                  <td><span class="badge ${a.passed ? 'badge-pass' : 'badge-fail'}">${a.passed ? 'PASS' : 'FAIL'}</span></td>
                  <td>${a.expiry_date ? formatDateShort(a.expiry_date) : '\u2014'}</td>
                  <td>${a.gdrive_pdf_link ? `<a href="${esc(a.gdrive_pdf_link)}" target="_blank" class="btn-link">Drive</a>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p class="empty-state">No assessments recorded.</p>'}
      </div>
    </div>
  `;

  // Clickable rows
  el.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') return;
      window.location.hash = row.dataset.href;
    });
  });
}
