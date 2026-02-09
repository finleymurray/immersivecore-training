import { fetchAllModules, fetchAllEmployees, createAssessment, updateAssessment, fetchModule } from '../services/training-service.js';
import { uploadProofScan } from '../services/storage-service.js';
import { getUserProfile } from '../services/auth-service.js';
import { todayISO, addMonths } from '../utils/date-utils.js';
import { navigate } from '../router.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function render(el) {
  const [allModules, employees, profile] = await Promise.all([
    fetchAllModules(true),
    fetchAllEmployees(),
    getUserProfile(),
  ]);

  // Only show scored_quiz modules
  const modules = allModules.filter(m => m.assessment_type === 'scored_quiz');

  el.innerHTML = `
    <div class="page-header">
      <h1>Log Assessment</h1>
    </div>

    <div id="error-area"></div>

    <form id="assessment-form" novalidate>
      <fieldset class="form-section">
        <legend><span class="section-number">1</span> Assessment Details</legend>

        <div class="form-row">
          <div class="form-group">
            <label for="trainee-select">Trainee <span class="required">*</span></label>
            <select id="trainee-select" required>
              <option value="">Select trainee...</option>
              ${employees.map(e => `<option value="${e.id}" data-name="${esc(e.full_name)}">${esc(e.full_name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="module-select">Module <span class="required">*</span></label>
            <select id="module-select" required>
              <option value="">Select module...</option>
              ${modules.map(m => `<option value="${m.id}" data-max="${m.max_score}" data-pass="${m.pass_mark}" data-refresher="${m.refresher_period_months}">${esc(m.module_name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="assessment-date">Date <span class="required">*</span></label>
            <input type="date" id="assessment-date" value="${todayISO()}" required>
          </div>
          <div class="form-group">
            <label>Assessor</label>
            <input type="text" value="${esc(profile?.full_name || '')}" disabled>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-section" id="score-section" style="display:none;">
        <legend><span class="section-number">2</span> Score</legend>
        <p class="section-description" id="score-context"></p>

        <div class="form-group" style="max-width:200px;">
          <label for="score-input">Score achieved <span class="required">*</span></label>
          <input type="number" id="score-input" min="0" required>
        </div>
        <p id="score-feedback" style="font-size:13px;margin-top:-8px;"></p>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">3</span> Proof Photo <span class="optional-tag">Optional</span></legend>
        <p class="section-description">Upload a photo of the assessment paper for records.</p>

        <div class="upload-area" id="proof-upload-area">
          <div class="upload-prompt">
            <div class="upload-icon">&#128247;</div>
            <p>Drag &amp; drop a photo here or <span class="upload-link" id="browse-proof">browse</span></p>
            <p class="upload-hint">JPEG or PNG</p>
          </div>
          <input type="file" id="proof-file-input" accept="image/jpeg,image/png" style="display:none;">
        </div>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">4</span> Notes <span class="optional-tag">Optional</span></legend>
        <div class="form-group">
          <textarea id="assessment-notes" rows="3" placeholder="Any additional notes..."></textarea>
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="submit-btn">Save Assessment</button>
        <a href="#/" class="btn btn-ghost">Cancel</a>
      </div>

      <div id="progress-area"></div>
    </form>
  `;

  const moduleSelect = el.querySelector('#module-select');
  const scoreSection = el.querySelector('#score-section');
  const scoreContext = el.querySelector('#score-context');
  const scoreInput = el.querySelector('#score-input');
  const scoreFeedback = el.querySelector('#score-feedback');
  const errorArea = el.querySelector('#error-area');
  const submitBtn = el.querySelector('#submit-btn');
  const progressArea = el.querySelector('#progress-area');
  const form = el.querySelector('#assessment-form');
  const proofUploadArea = el.querySelector('#proof-upload-area');
  const proofFileInput = el.querySelector('#proof-file-input');

  let currentModule = null;
  let selectedProof = null;

  // Module change — show score section
  moduleSelect.addEventListener('change', async () => {
    const opt = moduleSelect.selectedOptions[0];
    if (!opt || !opt.value) {
      scoreSection.style.display = 'none';
      currentModule = null;
      return;
    }
    const maxScore = parseInt(opt.dataset.max);
    const passMark = parseInt(opt.dataset.pass);
    currentModule = { id: opt.value, max_score: maxScore, pass_mark: passMark, refresher_period_months: parseInt(opt.dataset.refresher) };

    scoreSection.style.display = '';
    scoreContext.textContent = `Max score: ${maxScore} | Pass mark: ${passMark}`;
    scoreInput.max = maxScore;
    scoreInput.value = '';
    scoreFeedback.textContent = '';
    scoreInput.className = '';
  });

  // Live score validation
  scoreInput.addEventListener('input', () => {
    if (!currentModule) return;
    const val = parseInt(scoreInput.value);
    if (isNaN(val)) {
      scoreFeedback.textContent = '';
      scoreInput.classList.remove('score-input-valid', 'score-input-invalid');
      return;
    }
    if (val >= currentModule.pass_mark) {
      scoreFeedback.innerHTML = '<span class="score-pass">PASS</span>';
      scoreInput.classList.add('score-input-valid');
      scoreInput.classList.remove('score-input-invalid');
    } else {
      scoreFeedback.innerHTML = '<span class="score-fail">FAIL</span>';
      scoreInput.classList.add('score-input-invalid');
      scoreInput.classList.remove('score-input-valid');
    }
  });

  // Proof photo upload
  el.querySelector('#browse-proof').addEventListener('click', () => proofFileInput.click());
  proofFileInput.addEventListener('change', () => {
    if (proofFileInput.files.length > 0) {
      selectedProof = proofFileInput.files[0];
      proofUploadArea.innerHTML = `
        <div class="upload-preview">
          <img src="${URL.createObjectURL(selectedProof)}" class="preview-image" alt="Proof photo">
          <div class="upload-file-info">
            <span>${esc(selectedProof.name)} (${(selectedProof.size / 1024).toFixed(0)} KB)</span>
            <button type="button" class="btn btn-sm btn-secondary" id="change-proof-btn">Change</button>
          </div>
        </div>
      `;
      el.querySelector('#change-proof-btn').addEventListener('click', () => proofFileInput.click());
    }
  });

  proofUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); proofUploadArea.classList.add('drag-over'); });
  proofUploadArea.addEventListener('dragleave', () => proofUploadArea.classList.remove('drag-over'));
  proofUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    proofUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      selectedProof = file;
      const dt = new DataTransfer();
      dt.items.add(file);
      proofFileInput.files = dt.files;
      proofFileInput.dispatchEvent(new Event('change'));
    }
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorArea.innerHTML = '';

    const traineeSelect = el.querySelector('#trainee-select');
    const traineeId = traineeSelect.value;
    const traineeName = traineeSelect.selectedOptions[0]?.dataset.name || '';
    const moduleId = moduleSelect.value;
    const assessmentDate = el.querySelector('#assessment-date').value;
    const score = parseInt(scoreInput.value);
    const notes = el.querySelector('#assessment-notes').value.trim();

    const errors = [];
    if (!traineeId) errors.push('Please select a trainee.');
    if (!moduleId) errors.push('Please select a module.');
    if (!assessmentDate) errors.push('Please enter a date.');
    if (!currentModule) errors.push('Module data not loaded.');
    if (isNaN(score) || score < 0) errors.push('Please enter a valid score.');
    if (currentModule && score > currentModule.max_score) errors.push(`Score cannot exceed ${currentModule.max_score}.`);

    if (errors.length > 0) {
      errorArea.innerHTML = `<div class="error-summary"><h3>Please fix the following:</h3><ul>${errors.map(e => '<li>' + esc(e) + '</li>').join('')}</ul></div>`;
      return;
    }

    const passed = score >= currentModule.pass_mark;
    const expiryDate = passed ? addMonths(assessmentDate, currentModule.refresher_period_months) : null;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';
    progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Saving assessment...</span></div>';

    try {
      const payload = {
        module_id: moduleId,
        trainee_id: traineeId,
        trainee_name: traineeName,
        assessor_id: profile.id,
        assessor_name: profile.full_name,
        assessment_date: assessmentDate,
        score_achieved: score,
        max_score: currentModule.max_score,
        pass_mark: currentModule.pass_mark,
        passed,
        expiry_date: expiryDate,
        notes: notes || null,
      };

      const assessment = await createAssessment(payload);

      // Upload proof scan if selected
      if (selectedProof) {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading proof photo...</span></div>';
        const { path, filename } = await uploadProofScan(assessment.id, selectedProof);
        await updateAssessment(assessment.id, {
          proof_scan_path: path,
          proof_scan_filename: filename,
        });
      }

      // Generate PDF and upload to Google Drive
      try {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Generating PDF...</span></div>';
        const mod = await fetchModule(moduleId);
        const { generateAssessmentPDFBlob } = await import('../utils/pdf-generator.js');
        const pdfBlob = generateAssessmentPDFBlob(payload, mod);

        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading to Google Drive...</span></div>';
        const { uploadToGoogleDrive } = await import('../services/gdrive-service.js');
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(pdfBlob);
        });

        const moduleName = mod?.module_name || 'Assessment';
        const safeName = moduleName.replace(/[^a-zA-Z0-9 ]/g, '');
        const safTrainee = traineeName.replace(/[^a-zA-Z0-9 ]/g, '');
        const dateStr = assessmentDate.replace(/-/g, '');
        const fileName = `Assessment_${safTrainee}_${safeName}_${dateStr}.pdf`;

        const driveResult = await uploadToGoogleDrive({
          employeeName: traineeName,
          fileName,
          fileBase64: base64,
          mimeType: 'application/pdf',
          subfolder: 'Training Records/' + moduleName,
        });

        await updateAssessment(assessment.id, {
          gdrive_file_id: driveResult.file_id,
          gdrive_pdf_link: driveResult.web_view_link,
          gdrive_folder_id: driveResult.folder_id,
        });
      } catch (driveErr) {
        console.error('Drive upload failed (assessment saved):', driveErr);
      }

      // Create notification on failure
      if (!passed) {
        try {
          const { createNotification } = await import('../services/notification-service.js');
          const mod = await fetchModule(moduleId);
          await createNotification({
            title: `Failed: ${traineeName} - ${mod.module_name}`,
            message: `Scored ${score}/${currentModule.max_score} (pass mark: ${currentModule.pass_mark})`,
            severity: 'warning',
            actionUrl: `https://training.immersivecore.network/#/assessment/${assessment.id}`,
            sourceApp: 'training',
          });
        } catch (notifErr) {
          console.error('Notification creation failed:', notifErr);
        }
      }

      navigate('/assessment/' + assessment.id);
    } catch (err) {
      errorArea.innerHTML = `<div class="error-summary"><h3>Error</h3><ul><li>${esc(err.message)}</li></ul></div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Assessment';
      progressArea.innerHTML = '';
    }
  });
}
