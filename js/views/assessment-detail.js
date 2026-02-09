import { fetchAssessment, fetchModule } from '../services/training-service.js';
import { getProofScanUrl } from '../services/storage-service.js';
import { formatDateUK } from '../utils/date-utils.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function render(el, id) {
  const assessment = await fetchAssessment(id);
  const mod = assessment.training_modules || {};

  let proofUrl = null;
  if (assessment.proof_scan_path) {
    try {
      proofUrl = await getProofScanUrl(assessment.proof_scan_path);
    } catch (e) {
      console.error('Failed to get proof scan URL:', e);
    }
  }

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Assessment Record</h1>
        <p class="page-subtitle">${esc(assessment.trainee_name)} &mdash; ${esc(mod.module_name || 'Unknown Module')}</p>
      </div>
      <div class="header-actions">
        ${assessment.gdrive_pdf_link ? `<a href="${esc(assessment.gdrive_pdf_link)}" target="_blank" class="btn btn-ghost">View in Drive</a>` : ''}
        <button type="button" class="btn btn-secondary" id="download-pdf-btn">Download PDF</button>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-section">
        <h2><span class="section-number">1</span> Assessment Details</h2>
        <dl class="detail-list">
          <dt>Trainee</dt><dd>${esc(assessment.trainee_name)}</dd>
          <dt>Module</dt><dd>${esc(mod.module_name || '\u2014')}</dd>
          <dt>Date</dt><dd>${formatDateUK(assessment.assessment_date)}</dd>
          <dt>Assessor</dt><dd>${esc(assessment.assessor_name)}</dd>
          ${assessment.notes ? `<dt>Notes</dt><dd>${esc(assessment.notes)}</dd>` : ''}
        </dl>
      </div>

      <div class="detail-section">
        <h2><span class="section-number">2</span> Result</h2>
        <dl class="detail-list">
          <dt>Score</dt>
          <dd><span class="${assessment.passed ? 'score-pass' : 'score-fail'}">${assessment.score_achieved} / ${assessment.max_score}</span></dd>
          <dt>Pass mark</dt><dd>${assessment.pass_mark}</dd>
          <dt>Result</dt>
          <dd><span class="badge ${assessment.passed ? 'badge-pass' : 'badge-fail'}">${assessment.passed ? 'PASS' : 'FAIL'}</span></dd>
          ${assessment.expiry_date ? `<dt>Expiry date</dt><dd>${formatDateUK(assessment.expiry_date)}</dd>` : ''}
        </dl>
      </div>

      ${proofUrl ? `
        <div class="detail-section">
          <h2><span class="section-number">3</span> Quiz Upload</h2>
          <div class="scan-preview">
            ${assessment.proof_scan_filename?.toLowerCase().endsWith('.pdf')
              ? `<div class="pdf-preview-placeholder">&#128196; <a href="${esc(proofUrl)}" target="_blank" class="btn-link">${esc(assessment.proof_scan_filename)}</a></div>`
              : `<img src="${esc(proofUrl)}" alt="Assessment proof" class="scan-image">`
            }
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Download PDF button
  el.querySelector('#download-pdf-btn')?.addEventListener('click', async () => {
    const btn = el.querySelector('#download-pdf-btn');
    btn.disabled = true;
    btn.textContent = 'Generating\u2026';
    try {
      const mod2 = await fetchModule(assessment.module_id);
      const { generateAssessmentPDF } = await import('../utils/pdf-generator.js');
      generateAssessmentPDF(assessment, mod2);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF.');
    }
    btn.disabled = false;
    btn.textContent = 'Download PDF';
  });
}
