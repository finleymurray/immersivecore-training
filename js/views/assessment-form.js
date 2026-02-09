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
            <label>Trainee <span class="required">*</span></label>
            <div class="searchable-select" id="trainee-wrapper">
              <input type="text" class="searchable-select-input" id="trainee-search" placeholder="Search trainee..." autocomplete="off">
              <input type="hidden" id="trainee-value">
              <input type="hidden" id="trainee-name-value">
              <div class="searchable-select-dropdown" id="trainee-dropdown"></div>
            </div>
          </div>
          <div class="form-group">
            <label>Module <span class="required">*</span></label>
            <div class="searchable-select" id="module-wrapper">
              <input type="text" class="searchable-select-input" id="module-search" placeholder="Search module..." autocomplete="off">
              <input type="hidden" id="module-value">
              <div class="searchable-select-dropdown" id="module-dropdown"></div>
            </div>
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
        <legend><span class="section-number">3</span> Quiz Upload <span class="optional-tag">Optional</span></legend>
        <p class="section-description">Upload the completed quiz paper (PDF or image). Multi-page PDFs supported.</p>

        <div class="upload-area" id="proof-upload-area">
          <div class="upload-prompt">
            <div class="upload-icon">&#128196;</div>
            <p>Drag &amp; drop the quiz file here or <span class="upload-link" id="browse-proof">browse</span></p>
            <p class="upload-hint">PDF, JPEG or PNG</p>
          </div>
          <input type="file" id="proof-file-input" accept="application/pdf,image/jpeg,image/png" style="display:none;">
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

  // ---- Searchable dropdowns ----
  function initSearchableSelect(wrapperEl, searchEl, dropdownEl, valueEl, items, onSelect) {
    function showDropdown(filter) {
      const q = (filter || '').toLowerCase();
      const matched = q ? items.filter(i => i.label.toLowerCase().includes(q)) : items;
      if (matched.length === 0) {
        dropdownEl.innerHTML = '<div class="searchable-select-empty">No results</div>';
      } else {
        dropdownEl.innerHTML = matched.map(i =>
          `<div class="searchable-select-option" data-value="${i.value}">${esc(i.label)}</div>`
        ).join('');
      }
      dropdownEl.classList.add('open');
    }

    function hideDropdown() {
      dropdownEl.classList.remove('open');
    }

    searchEl.addEventListener('focus', () => showDropdown(searchEl.value));
    searchEl.addEventListener('input', () => {
      valueEl.value = '';
      showDropdown(searchEl.value);
      if (onSelect) onSelect('');
    });
    searchEl.addEventListener('blur', () => {
      setTimeout(hideDropdown, 150);
    });

    dropdownEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const opt = e.target.closest('.searchable-select-option');
      if (!opt) return;
      const val = opt.dataset.value;
      const item = items.find(i => i.value === val);
      if (!item) return;
      searchEl.value = item.label;
      valueEl.value = val;
      hideDropdown();
      if (onSelect) onSelect(val, item);
    });
  }

  // Trainee searchable select
  const traineeItems = employees.map(e => ({ value: e.id, label: e.full_name }));
  const traineeValueEl = el.querySelector('#trainee-value');
  const traineeNameEl = el.querySelector('#trainee-name-value');
  initSearchableSelect(
    el.querySelector('#trainee-wrapper'),
    el.querySelector('#trainee-search'),
    el.querySelector('#trainee-dropdown'),
    traineeValueEl,
    traineeItems,
    (val, item) => { traineeNameEl.value = item ? item.label : ''; }
  );

  // Module searchable select — store extra data per module
  const moduleItemsData = modules.map(m => ({
    value: m.id, label: m.module_name,
    max_score: m.max_score, pass_mark: m.pass_mark, refresher_period_months: m.refresher_period_months,
  }));
  const moduleValueEl = el.querySelector('#module-value');
  initSearchableSelect(
    el.querySelector('#module-wrapper'),
    el.querySelector('#module-search'),
    el.querySelector('#module-dropdown'),
    moduleValueEl,
    moduleItemsData,
    (val, item) => {
      if (!val || !item) {
        scoreSection.style.display = 'none';
        currentModule = null;
        return;
      }
      currentModule = { id: val, max_score: item.max_score, pass_mark: item.pass_mark, refresher_period_months: item.refresher_period_months };
      scoreSection.style.display = '';
      scoreContext.textContent = `Max score: ${item.max_score} | Pass mark: ${item.pass_mark}`;
      scoreInput.max = item.max_score;
      scoreInput.value = '';
      scoreFeedback.textContent = '';
      scoreInput.className = '';
    }
  );

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

  // Quiz file upload (PDF or image)
  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

  function showProofPreview(file) {
    selectedProof = file;
    const isPdf = file.type === 'application/pdf';
    const sizeKB = (file.size / 1024).toFixed(0);
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

    proofUploadArea.innerHTML = `
      <div class="upload-preview">
        ${isPdf
          ? `<div class="pdf-preview-placeholder">&#128196; ${esc(file.name)}</div>`
          : `<img src="${URL.createObjectURL(file)}" class="preview-image" alt="Quiz scan">`
        }
        <div class="upload-file-info">
          <span>${esc(file.name)} (${sizeText})</span>
          <button type="button" class="btn btn-sm btn-secondary" id="change-proof-btn">Change</button>
        </div>
      </div>
    `;
    el.querySelector('#change-proof-btn').addEventListener('click', () => proofFileInput.click());
  }

  el.querySelector('#browse-proof').addEventListener('click', () => proofFileInput.click());
  proofFileInput.addEventListener('change', () => {
    if (proofFileInput.files.length > 0) showProofPreview(proofFileInput.files[0]);
  });

  proofUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); proofUploadArea.classList.add('drag-over'); });
  proofUploadArea.addEventListener('dragleave', () => proofUploadArea.classList.remove('drag-over'));
  proofUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    proofUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && ALLOWED_TYPES.includes(file.type)) {
      const dt = new DataTransfer();
      dt.items.add(file);
      proofFileInput.files = dt.files;
      showProofPreview(file);
    }
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorArea.innerHTML = '';

    const traineeId = traineeValueEl.value;
    const traineeName = traineeNameEl.value;
    const moduleId = moduleValueEl.value;
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

      // Upload quiz file to Supabase Storage if selected
      if (selectedProof) {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading quiz file...</span></div>';
        const { path, filename } = await uploadProofScan(assessment.id, selectedProof);
        await updateAssessment(assessment.id, {
          proof_scan_path: path,
          proof_scan_filename: filename,
        });
      }

      // Generate PDF and upload to Google Drive
      const mod = await fetchModule(moduleId);
      const moduleName = mod?.module_name || 'Assessment';
      const safeName = moduleName.replace(/[^a-zA-Z0-9 ]/g, '');
      const safTrainee = traineeName.replace(/[^a-zA-Z0-9 ]/g, '');
      const dateStr = assessmentDate.replace(/-/g, '');

      try {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Generating PDF...</span></div>';
        const { generateAssessmentPDFBlob } = await import('../utils/pdf-generator.js');
        const pdfBlob = generateAssessmentPDFBlob(payload, mod);

        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading to Google Drive...</span></div>';
        const { uploadToGoogleDrive } = await import('../services/gdrive-service.js');
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(pdfBlob);
        });

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

      // Upload quiz file to Google Drive too
      if (selectedProof) {
        try {
          progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading quiz to Google Drive...</span></div>';
          const { uploadToGoogleDrive } = await import('../services/gdrive-service.js');
          const quizReader = new FileReader();
          const quizBase64 = await new Promise((resolve) => {
            quizReader.onload = () => resolve(quizReader.result.split(',')[1]);
            quizReader.readAsDataURL(selectedProof);
          });

          const ext = selectedProof.name.split('.').pop() || 'pdf';
          const quizFileName = `Quiz_${safTrainee}_${safeName}_${dateStr}.${ext}`;

          await uploadToGoogleDrive({
            employeeName: traineeName,
            fileName: quizFileName,
            fileBase64: quizBase64,
            mimeType: selectedProof.type,
            subfolder: 'Training Records/' + moduleName,
          });
        } catch (quizDriveErr) {
          console.error('Quiz Drive upload failed (assessment saved):', quizDriveErr);
        }
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
