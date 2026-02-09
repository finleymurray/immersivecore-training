import { fetchAllModules, fetchAllEmployees, createSession, updateSession, fetchModule } from '../services/training-service.js';
import { getUserProfile } from '../services/auth-service.js';
import { todayISO } from '../utils/date-utils.js';
import { navigate } from '../router.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function render(el) {
  const [modules, employees, profile] = await Promise.all([
    fetchAllModules(true),
    fetchAllEmployees(),
    getUserProfile(),
  ]);

  el.innerHTML = `
    <div class="page-header">
      <h1>Log Training Session</h1>
    </div>

    <div id="error-area"></div>

    <form id="session-form" novalidate>
      <fieldset class="form-section">
        <legend><span class="section-number">1</span> Session Details</legend>

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
              ${modules.map(m => `<option value="${m.id}">${esc(m.module_name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="session-date">Date <span class="required">*</span></label>
            <input type="date" id="session-date" value="${todayISO()}" required>
          </div>
          <div class="form-group">
            <label>Trainer</label>
            <input type="text" value="${esc(profile?.full_name || '')}" disabled>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-section" id="topics-section" style="display:none;">
        <legend><span class="section-number">2</span> Topic Checklist</legend>
        <p class="section-description">Tick each topic covered during this session.</p>
        <ul class="topic-checklist" id="topic-checklist"></ul>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">3</span> Trainer Declaration</legend>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="trainer-declaration">
            I confirm that I delivered this training session and the topics marked above were covered. <span class="required">*</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">4</span> Trainee Signature</legend>
        <p class="section-description">Ask the trainee to sign below to confirm they attended and understood the training.</p>
        <div class="signature-pad-container" id="signature-container"></div>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">5</span> Notes <span class="optional-tag">Optional</span></legend>
        <div class="form-group">
          <textarea id="session-notes" rows="3" placeholder="Any additional notes..."></textarea>
        </div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="submit-btn">Save Session</button>
        <a href="#/" class="btn btn-ghost">Cancel</a>
      </div>

      <div id="progress-area"></div>
    </form>
  `;

  const moduleSelect = el.querySelector('#module-select');
  const topicsSection = el.querySelector('#topics-section');
  const topicChecklist = el.querySelector('#topic-checklist');
  const errorArea = el.querySelector('#error-area');
  const submitBtn = el.querySelector('#submit-btn');
  const progressArea = el.querySelector('#progress-area');
  const form = el.querySelector('#session-form');

  // Signature pad
  const { createSignaturePad } = await import('../utils/signature-pad.js');
  const sigPad = createSignaturePad(el.querySelector('#signature-container'));

  let currentModule = null;

  // Load topic checklist when module changes
  moduleSelect.addEventListener('change', async () => {
    const moduleId = moduleSelect.value;
    if (!moduleId) {
      topicsSection.style.display = 'none';
      currentModule = null;
      return;
    }
    currentModule = await fetchModule(moduleId);
    const syllabus = Array.isArray(currentModule.syllabus) ? currentModule.syllabus : [];
    if (syllabus.length === 0) {
      topicsSection.style.display = 'none';
      return;
    }
    topicsSection.style.display = '';
    topicChecklist.innerHTML = syllabus.map((topic, i) => `
      <li class="topic-checklist-item">
        <input type="checkbox" id="topic-${i}" data-index="${i}">
        <label for="topic-${i}">${esc(topic)}</label>
      </li>
    `).join('');
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorArea.innerHTML = '';

    const traineeSelect = el.querySelector('#trainee-select');
    const traineeId = traineeSelect.value;
    const traineeName = traineeSelect.selectedOptions[0]?.dataset.name || '';
    const moduleId = moduleSelect.value;
    const sessionDate = el.querySelector('#session-date').value;
    const declaration = el.querySelector('#trainer-declaration').checked;
    const notes = el.querySelector('#session-notes').value.trim();

    // Validation
    const errors = [];
    if (!traineeId) errors.push('Please select a trainee.');
    if (!moduleId) errors.push('Please select a module.');
    if (!sessionDate) errors.push('Please enter a date.');
    if (!declaration) errors.push('Please confirm the trainer declaration.');
    if (sigPad.isEmpty()) errors.push('Trainee signature is required.');

    if (errors.length > 0) {
      errorArea.innerHTML = `<div class="error-summary"><h3>Please fix the following:</h3><ul>${errors.map(e => '<li>' + esc(e) + '</li>').join('')}</ul></div>`;
      return;
    }

    // Build topics_completed
    const syllabus = currentModule?.syllabus || [];
    const topicsCompleted = syllabus.map((_, i) => {
      const cb = el.querySelector(`#topic-${i}`);
      return cb ? cb.checked : false;
    });
    const allTopicsCovered = topicsCompleted.length > 0 && topicsCompleted.every(Boolean);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';
    progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Saving session...</span></div>';

    try {
      const payload = {
        module_id: moduleId,
        trainee_id: traineeId,
        trainee_name: traineeName,
        trainer_id: profile.id,
        trainer_name: profile.full_name,
        session_date: sessionDate,
        topics_completed: topicsCompleted,
        all_topics_covered: allTopicsCovered,
        trainer_declaration: declaration,
        trainee_signature_data: sigPad.toDataURL(),
        notes: notes || null,
      };

      const session = await createSession(payload);

      // Generate PDF and upload to Google Drive
      try {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Generating PDF...</span></div>';
        const { generateTrainingPDFBlob } = await import('../utils/pdf-generator.js');
        const pdfBlob = generateTrainingPDFBlob(payload, currentModule);

        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading to Google Drive...</span></div>';
        const { uploadToGoogleDrive } = await import('../services/gdrive-service.js');
        const reader = new FileReader();
        const base64 = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(pdfBlob);
        });

        const moduleName = currentModule?.module_name || 'Training';
        const safeName = moduleName.replace(/[^a-zA-Z0-9 ]/g, '');
        const safTrainee = traineeName.replace(/[^a-zA-Z0-9 ]/g, '');
        const dateStr = sessionDate.replace(/-/g, '');
        const fileName = `Training_${safTrainee}_${safeName}_${dateStr}.pdf`;

        const driveResult = await uploadToGoogleDrive({
          employeeName: traineeName,
          fileName,
          fileBase64: base64,
          mimeType: 'application/pdf',
          subfolder: 'Training Records/' + moduleName,
        });

        await updateSession(session.id, {
          gdrive_file_id: driveResult.file_id,
          gdrive_pdf_link: driveResult.web_view_link,
          gdrive_folder_id: driveResult.folder_id,
        });
      } catch (driveErr) {
        console.error('Drive upload failed (session saved):', driveErr);
      }

      navigate('/session/' + session.id);
    } catch (err) {
      errorArea.innerHTML = `<div class="error-summary"><h3>Error</h3><ul><li>${esc(err.message)}</li></ul></div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Session';
      progressArea.innerHTML = '';
    }
  });
}
