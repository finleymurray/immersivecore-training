import { fetchSession } from '../services/training-service.js';
import { formatDateUK } from '../utils/date-utils.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function render(el, id) {
  const session = await fetchSession(id);
  const mod = session.training_modules || {};
  const syllabus = Array.isArray(mod.syllabus) ? mod.syllabus : [];
  const topics = Array.isArray(session.topics_completed) ? session.topics_completed : [];

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Training Session</h1>
        <p class="page-subtitle">${esc(session.trainee_name)} &mdash; ${esc(mod.module_name || 'Unknown Module')}</p>
      </div>
      <div class="header-actions">
        ${session.gdrive_pdf_link ? `<a href="${esc(session.gdrive_pdf_link)}" target="_blank" class="btn btn-ghost">View in Drive</a>` : ''}
        <button type="button" class="btn btn-secondary" id="download-pdf-btn">Download PDF</button>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-section">
        <h2><span class="section-number">1</span> Session Details</h2>
        <dl class="detail-list">
          <dt>Trainee</dt><dd>${esc(session.trainee_name)}</dd>
          <dt>Module</dt><dd>${esc(mod.module_name || '\u2014')}</dd>
          <dt>Date</dt><dd>${formatDateUK(session.session_date)}</dd>
          <dt>Trainer</dt><dd>${esc(session.trainer_name)}</dd>
          <dt>All topics covered</dt><dd>${session.all_topics_covered ? 'Yes' : 'No'}</dd>
          <dt>Trainer declaration</dt><dd>${session.trainer_declaration ? 'Confirmed' : 'Not confirmed'}</dd>
          ${session.notes ? `<dt>Notes</dt><dd>${esc(session.notes)}</dd>` : ''}
        </dl>
      </div>

      ${syllabus.length > 0 ? `
        <div class="detail-section">
          <h2><span class="section-number">2</span> Topics Covered</h2>
          <ul class="topic-checklist">
            ${syllabus.map((topic, i) => {
              const covered = topics[i] === true;
              return `
                <li class="topic-checklist-item" style="cursor:default;">
                  <span class="topic-status ${covered ? 'topic-status-pass' : 'topic-status-fail'}">${covered ? '\u2713' : '\u2717'}</span>
                  <span>${esc(topic)}</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="detail-section">
        <h2><span class="section-number">3</span> Trainee Signature</h2>
        ${session.trainee_signature_data ? `
          <div class="signature-display">
            <img src="${session.trainee_signature_data}" alt="Trainee signature">
          </div>
        ` : '<p class="empty-state">No signature recorded.</p>'}
      </div>
    </div>
  `;

  // Download PDF button
  el.querySelector('#download-pdf-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#download-pdf-btn');
    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    try {
      const mod2 = await (await import('../services/training-service.js')).fetchModule(session.module_id);
      const { generateTrainingPDF } = await import('../utils/pdf-generator.js');
      generateTrainingPDF(session, mod2);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF.');
    }
    btn.disabled = false;
    btn.textContent = 'Download PDF';
  });
}
