import { fetchAllModules } from '../services/training-service.js';
import { isManager } from '../services/auth-service.js?v=7';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

const TYPE_LABELS = {
  scored_quiz: 'Scored Quiz',
  attendance_only: 'Attendance Only',
};

export async function render(el) {
  const manager = await isManager();
  el.innerHTML = `
    <div class="page-header">
      <h1>Training Modules</h1>
      ${manager ? '<a href="#/modules/new" class="btn btn-primary">+ New Module</a>' : ''}
    </div>

    <div class="filter-bar">
      <input type="text" id="search-input" class="search-input" placeholder="Search by name...">
      <select id="type-filter" class="status-filter">
        <option value="">All types</option>
        <option value="scored_quiz">Scored Quiz</option>
        <option value="attendance_only">Attendance Only</option>
      </select>
    </div>

    <div id="records-container">
      <div class="loading">Loading modules...</div>
    </div>
  `;

  const container = el.querySelector('#records-container');
  const searchInput = el.querySelector('#search-input');
  const typeFilter = el.querySelector('#type-filter');

  let allModules = [];

  try {
    allModules = await fetchAllModules();
  } catch (err) {
    container.innerHTML = `<div class="error-banner"><p>Failed to load modules: ${esc(err.message)}</p></div>`;
    return;
  }

  function renderTable() {
    const search = searchInput.value.toLowerCase().trim();
    const typeVal = typeFilter.value;

    let filtered = allModules;
    if (search) {
      filtered = filtered.filter(m => m.module_name.toLowerCase().includes(search));
    }
    if (typeVal) {
      filtered = filtered.filter(m => m.assessment_type === typeVal);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-state">No training modules found.</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Module Name</th>
            <th>Version</th>
            <th>Type</th>
            <th>Refresher</th>
            <th>Topics</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(m => `
            <tr class="clickable-row" data-id="${m.id}">
              <td>${esc(m.module_name)}</td>
              <td>${esc(m.version_number)}</td>
              <td>${esc(TYPE_LABELS[m.assessment_type] || m.assessment_type)}</td>
              <td>${m.refresher_period_months} months</td>
              <td>${Array.isArray(m.syllabus) ? m.syllabus.length : 0}</td>
              <td><span class="badge ${m.is_active ? 'badge-active' : 'badge-inactive'}">${m.is_active ? 'Active' : 'Inactive'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        window.location.hash = '#/modules/' + row.dataset.id;
      });
    });
  }

  searchInput.addEventListener('input', renderTable);
  typeFilter.addEventListener('change', renderTable);
  renderTable();
}
