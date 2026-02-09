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
        <p class="section-description">Mark each topic as covered or N/A (not applicable to this employee's role).</p>
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

  const topicsSection = el.querySelector('#topics-section');
  const topicChecklist = el.querySelector('#topic-checklist');
  const errorArea = el.querySelector('#error-area');
  const submitBtn = el.querySelector('#submit-btn');
  const progressArea = el.querySelector('#progress-area');
  const form = el.querySelector('#session-form');

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
      // Delay to allow mousedown on option to fire first
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

  // Module searchable select
  const moduleItems = modules.map(m => ({ value: m.id, label: m.module_name }));
  const moduleValueEl = el.querySelector('#module-value');
  initSearchableSelect(
    el.querySelector('#module-wrapper'),
    el.querySelector('#module-search'),
    el.querySelector('#module-dropdown'),
    moduleValueEl,
    moduleItems,
    async (val) => {
      if (!val) {
        topicsSection.style.display = 'none';
        currentModule = null;
        topicStates = [];
        return;
      }
      currentModule = await fetchModule(val);
      const syllabus = Array.isArray(currentModule.syllabus) ? currentModule.syllabus : [];
      if (syllabus.length === 0) {
        topicsSection.style.display = 'none';
        topicStates = [];
        return;
      }
      topicsSection.style.display = '';
      topicStates = syllabus.map(() => false);
      refreshTopicList();
    }
  );

  // Signature pad
  const { createSignaturePad } = await import('../utils/signature-pad.js');
  const sigPad = createSignaturePad(el.querySelector('#signature-container'));

  let currentModule = null;
  // Track topic states: false = not covered, true = covered, 'na' = not applicable
  let topicStates = [];

  function renderTopicItem(topic, i) {
    const state = topicStates[i];
    const isCovered = state === true;
    const isNa = state === 'na';

    return `
      <li class="topic-checklist-item" data-index="${i}">
        <button type="button" class="topic-toggle-btn ${isCovered ? 'topic-btn-covered' : ''}" data-action="toggle" data-index="${i}" title="Toggle covered">
          ${isCovered ? '<span class="topic-icon topic-icon-covered">&#10004;</span>' : '<span class="topic-icon topic-icon-uncovered">&#10008;</span>'}
        </button>
        <span class="topic-label ${isNa ? 'topic-label-na' : ''}">${esc(topic)}</span>
        <button type="button" class="topic-na-btn ${isNa ? 'topic-na-active' : ''}" data-action="na" data-index="${i}" title="Not applicable">N/A</button>
      </li>
    `;
  }

  function refreshTopicList() {
    const syllabus = currentModule?.syllabus || [];
    topicChecklist.innerHTML = syllabus.map((topic, i) => renderTopicItem(topic, i)).join('');
  }

  // Delegate click events on topic buttons
  topicChecklist.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.index);
    if (isNaN(idx)) return;

    if (btn.dataset.action === 'toggle') {
      // Toggle between covered and not covered (clears N/A)
      topicStates[idx] = topicStates[idx] === true ? false : true;
    } else if (btn.dataset.action === 'na') {
      // Toggle N/A on/off
      topicStates[idx] = topicStates[idx] === 'na' ? false : 'na';
    }
    refreshTopicList();
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorArea.innerHTML = '';

    const traineeId = traineeValueEl.value;
    const traineeName = traineeNameEl.value;
    const moduleId = moduleValueEl.value;
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

    // Build topics_completed — true, false, or "na"
    const topicsCompleted = [...topicStates];
    // "All covered" if every topic is either true (covered) or "na" (not applicable)
    const allTopicsCovered = topicsCompleted.length > 0 && topicsCompleted.every(v => v === true || v === 'na');

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
