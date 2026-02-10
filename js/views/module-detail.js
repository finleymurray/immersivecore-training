import { fetchModule } from '../services/training-service.js';
import { getModulePDFUrl, getModuleFileUrl } from '../services/storage-service.js';
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

export async function render(el, id) {
  const mod = await fetchModule(id);
  const manager = await isManager();

  let pdfUrl = null;
  if (mod.source_pdf_path) {
    try {
      pdfUrl = await getModulePDFUrl(mod.source_pdf_path);
    } catch (e) {
      console.error('Failed to get PDF URL:', e);
    }
  }

  const syllabus = Array.isArray(mod.syllabus) ? mod.syllabus : [];
  const moduleFiles = Array.isArray(mod.module_files) ? mod.module_files : [];

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${esc(mod.module_name)}</h1>
        <span class="badge ${mod.is_active ? 'badge-active' : 'badge-inactive'}">${mod.is_active ? 'Active' : 'Inactive'}</span>
      </div>
      ${manager ? `<div class="header-actions">
        <a href="#/modules/${id}/edit" class="btn btn-primary">Edit</a>
      </div>` : ''}
    </div>

    <div class="detail-grid">
      <div class="detail-section">
        <h2><span class="section-number">1</span> Module Details</h2>
        <dl class="detail-list">
          <dt>Module name</dt><dd>${esc(mod.module_name)}</dd>
          <dt>Version</dt><dd>${esc(mod.version_number)}</dd>
          <dt>Assessment type</dt><dd>${esc(TYPE_LABELS[mod.assessment_type] || mod.assessment_type)}</dd>
          <dt>Refresher period</dt><dd>${mod.refresher_period_months} months</dd>
          ${mod.assessment_type === 'scored_quiz' ? `
            <dt>Max score</dt><dd>${mod.max_score}</dd>
            <dt>Pass mark</dt><dd>${mod.pass_mark}</dd>
          ` : ''}
        </dl>
      </div>

      <div class="detail-section">
        <h2><span class="section-number">2</span> Syllabus (${syllabus.length} topics)</h2>
        ${syllabus.length > 0 ? `
          <ol class="syllabus-list">
            ${syllabus.map((topic, i) => `
              <li class="syllabus-item">
                <span class="syllabus-num">${i + 1}.</span>
                <span class="syllabus-text">${esc(topic)}</span>
              </li>
            `).join('')}
          </ol>
        ` : '<p class="empty-state">No syllabus topics defined.</p>'}
      </div>

      <div class="detail-section">
        <h2><span class="section-number">3</span> Module Files</h2>
        ${moduleFiles.length > 0 ? `
          <ul class="module-files-list module-files-detail">
            ${moduleFiles.map((f, i) => `
              <li class="module-file-item">
                <span class="module-file-icon">&#128196;</span>
                <span class="module-file-name">${esc(f.filename)}</span>
                <span class="module-file-size">${(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" class="btn btn-sm btn-secondary module-file-download" data-index="${i}">Download</button>
              </li>
            `).join('')}
          </ul>
        ` : '<p class="empty-state">No module files uploaded.</p>'}
      </div>

      <div class="detail-section">
        <h2><span class="section-number">4</span> Source Material</h2>
        ${pdfUrl ? `
          <p><a href="${esc(pdfUrl)}" target="_blank" class="btn-link">${esc(mod.source_pdf_filename)}</a></p>
        ` : '<p class="empty-state">No source PDF uploaded.</p>'}
      </div>
    </div>
  `;

  // Module file download buttons
  el.querySelectorAll('.module-file-download').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index);
      const file = moduleFiles[idx];
      if (!file) return;
      btn.disabled = true;
      btn.textContent = 'Loading\u2026';
      try {
        const url = await getModuleFileUrl(file.path);
        window.open(url, '_blank');
      } catch (err) {
        console.error('Failed to get file URL:', err);
        alert('Failed to download file.');
      }
      btn.disabled = false;
      btn.textContent = 'Download';
    });
  });
}
