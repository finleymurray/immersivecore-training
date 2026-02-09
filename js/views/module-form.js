import { fetchModule, createModule, updateModule } from '../services/training-service.js';
import { uploadModulePDF, uploadModuleFile, deleteModuleFile } from '../services/storage-service.js';
import { navigate } from '../router.js';

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export async function render(el, editId) {
  let existing = null;
  if (editId) {
    existing = await fetchModule(editId);
  }

  const syllabus = existing?.syllabus ? [...existing.syllabus] : [];
  const moduleFiles = existing?.module_files ? [...existing.module_files] : [];
  let pendingFiles = []; // new files to upload on save
  let filesToDelete = []; // paths of files to remove on save
  let selectedFile = null;

  el.innerHTML = `
    <div class="page-header">
      <h1>${existing ? 'Edit Module' : 'New Training Module'}</h1>
    </div>

    <div id="error-area"></div>

    <form id="module-form" novalidate>
      <fieldset class="form-section">
        <legend><span class="section-number">1</span> Module Details</legend>

        <div class="form-row">
          <div class="form-group">
            <label for="module-name">Module name <span class="required">*</span></label>
            <input type="text" id="module-name" value="${esc(existing?.module_name || '')}" required>
          </div>
          <div class="form-group">
            <label for="version-number">Version</label>
            <input type="text" id="version-number" value="${esc(existing?.version_number || '1.0')}">
          </div>
        </div>

        <div class="form-group">
          <label for="refresher-months">Refresher period (months)</label>
          <input type="number" id="refresher-months" min="1" max="120" value="${existing?.refresher_period_months || 12}" style="max-width:150px;">
        </div>

        <div class="form-group">
          <span class="group-label">Assessment type <span class="required">*</span></span>
          <div class="radio-option">
            <input type="radio" name="assessment-type" id="type-scored" value="scored_quiz" ${(!existing || existing.assessment_type === 'scored_quiz') ? 'checked' : ''}>
            <label for="type-scored"><strong>Scored Quiz</strong> &mdash; Trainee takes a scored test with a pass mark</label>
          </div>
          <div class="radio-option">
            <input type="radio" name="assessment-type" id="type-attendance" value="attendance_only" ${existing?.assessment_type === 'attendance_only' ? 'checked' : ''}>
            <label for="type-attendance"><strong>Attendance Only</strong> &mdash; No scored assessment, session completion is sufficient</label>
          </div>
        </div>

        <div id="score-fields" style="${(!existing || existing.assessment_type === 'scored_quiz') ? '' : 'display:none;'}">
          <div class="form-row">
            <div class="form-group">
              <label for="max-score">Max score <span class="required">*</span></label>
              <input type="number" id="max-score" min="1" value="${existing?.max_score || ''}">
            </div>
            <div class="form-group">
              <label for="pass-mark">Pass mark <span class="required">*</span></label>
              <input type="number" id="pass-mark" min="1" value="${existing?.pass_mark || ''}">
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">2</span> Syllabus</legend>
        <p class="section-description">Define the topics covered in this module. These will appear as a checklist during session logging.</p>

        <ul class="syllabus-list" id="syllabus-list"></ul>

        <div class="syllabus-add">
          <div class="form-group" style="flex:1;margin-bottom:0;">
            <input type="text" id="topic-input" placeholder="Enter a topic...">
          </div>
          <button type="button" class="btn btn-secondary" id="add-topic-btn">Add</button>
        </div>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">3</span> Module Files <span class="optional-tag">Optional</span></legend>
        <p class="section-description">Upload printable quizzes, answer sheets, and other training documents. Managers can download and print these from the module page.</p>

        <div id="module-files-list"></div>

        <div class="upload-area" id="files-upload-area">
          <div class="upload-prompt">
            <div class="upload-icon">&#128196;</div>
            <p>Drag &amp; drop files here or <span class="upload-link" id="browse-files">browse</span></p>
            <p class="upload-hint">PDF, Word, images, or any printable document</p>
          </div>
          <input type="file" id="files-input" multiple style="display:none;">
        </div>
      </fieldset>

      <fieldset class="form-section">
        <legend><span class="section-number">4</span> Source Material <span class="optional-tag">Optional</span></legend>
        <p class="section-description">Upload the training material PDF for reference.</p>

        <div class="upload-area" id="pdf-upload-area">
          ${existing?.source_pdf_filename
            ? `<div class="upload-preview">
                <div class="pdf-preview-placeholder">Current file: ${esc(existing.source_pdf_filename)}</div>
                <div class="upload-file-info">
                  <span>${esc(existing.source_pdf_filename)}</span>
                  <button type="button" class="btn btn-sm btn-secondary" id="change-pdf-btn">Change</button>
                </div>
              </div>`
            : `<div class="upload-prompt">
                <div class="upload-icon">&#128196;</div>
                <p>Drag &amp; drop a PDF here or <span class="upload-link" id="browse-pdf">browse</span></p>
                <p class="upload-hint">PDF files only</p>
              </div>`
          }
          <input type="file" id="pdf-file-input" accept=".pdf" style="display:none;">
        </div>
      </fieldset>

      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="is-active" ${(!existing || existing.is_active) ? 'checked' : ''}>
          Module is active (visible in session/assessment forms)
        </label>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" id="submit-btn">${existing ? 'Save Changes' : 'Create Module'}</button>
        <a href="${existing ? '#/modules/' + editId : '#/modules'}" class="btn btn-ghost">Cancel</a>
      </div>

      <div id="progress-area"></div>
    </form>
  `;

  const form = el.querySelector('#module-form');
  const errorArea = el.querySelector('#error-area');
  const scoreFields = el.querySelector('#score-fields');
  const syllabusList = el.querySelector('#syllabus-list');
  const topicInput = el.querySelector('#topic-input');
  const addTopicBtn = el.querySelector('#add-topic-btn');
  const pdfUploadArea = el.querySelector('#pdf-upload-area');
  const pdfFileInput = el.querySelector('#pdf-file-input');
  const submitBtn = el.querySelector('#submit-btn');
  const progressArea = el.querySelector('#progress-area');

  // Assessment type toggle
  el.querySelectorAll('input[name="assessment-type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      scoreFields.style.display = radio.value === 'scored_quiz' ? '' : 'none';
    });
  });

  // Syllabus rendering
  function renderSyllabus() {
    if (syllabus.length === 0) {
      syllabusList.innerHTML = '<li class="empty-state" style="padding:12px;font-size:13px;">No topics added yet.</li>';
      return;
    }
    syllabusList.innerHTML = syllabus.map((topic, i) => `
      <li class="syllabus-item">
        <span class="syllabus-num">${i + 1}.</span>
        <span class="syllabus-text">${esc(topic)}</span>
        <button type="button" class="syllabus-remove" data-index="${i}" title="Remove">&times;</button>
      </li>
    `).join('');

    syllabusList.querySelectorAll('.syllabus-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        syllabus.splice(parseInt(btn.dataset.index), 1);
        renderSyllabus();
      });
    });
  }
  renderSyllabus();

  function addTopic() {
    const val = topicInput.value.trim();
    if (!val) return;
    syllabus.push(val);
    topicInput.value = '';
    renderSyllabus();
    topicInput.focus();
  }

  addTopicBtn.addEventListener('click', addTopic);
  topicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTopic();
    }
  });

  // PDF upload
  const browsePdf = el.querySelector('#browse-pdf');
  const changePdfBtn = el.querySelector('#change-pdf-btn');
  if (browsePdf) browsePdf.addEventListener('click', () => pdfFileInput.click());
  if (changePdfBtn) changePdfBtn.addEventListener('click', () => pdfFileInput.click());

  pdfFileInput.addEventListener('change', () => {
    if (pdfFileInput.files.length > 0) {
      selectedFile = pdfFileInput.files[0];
      pdfUploadArea.innerHTML = `
        <div class="upload-preview">
          <div class="pdf-preview-placeholder">Selected: ${esc(selectedFile.name)}</div>
          <div class="upload-file-info">
            <span>${esc(selectedFile.name)} (${(selectedFile.size / 1024).toFixed(0)} KB)</span>
            <button type="button" class="btn btn-sm btn-secondary" id="change-pdf-btn2">Change</button>
          </div>
        </div>
      `;
      el.querySelector('#change-pdf-btn2').addEventListener('click', () => pdfFileInput.click());
    }
  });

  // Drag and drop
  pdfUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); pdfUploadArea.classList.add('drag-over'); });
  pdfUploadArea.addEventListener('dragleave', () => pdfUploadArea.classList.remove('drag-over'));
  pdfUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      selectedFile = file;
      const dt = new DataTransfer();
      dt.items.add(file);
      pdfFileInput.files = dt.files;
      pdfFileInput.dispatchEvent(new Event('change'));
    }
  });

  // ---- Module Files ----
  const filesListEl = el.querySelector('#module-files-list');
  const filesUploadArea = el.querySelector('#files-upload-area');
  const filesInput = el.querySelector('#files-input');
  const browseFiles = el.querySelector('#browse-files');

  browseFiles.addEventListener('click', () => filesInput.click());

  function renderFilesList() {
    const allFiles = [
      ...moduleFiles.map((f, i) => ({ ...f, type: 'existing', index: i })),
      ...pendingFiles.map((f, i) => ({ filename: f.name, size: f.size, type: 'pending', index: i })),
    ];
    if (allFiles.length === 0) {
      filesListEl.innerHTML = '';
      return;
    }
    filesListEl.innerHTML = `<ul class="module-files-list">${allFiles.map(f => `
      <li class="module-file-item">
        <span class="module-file-icon">&#128196;</span>
        <span class="module-file-name">${esc(f.filename)}</span>
        <span class="module-file-size">${(f.size / 1024).toFixed(0)} KB</span>
        ${f.type === 'pending' ? '<span class="module-file-badge">New</span>' : ''}
        <button type="button" class="module-file-remove" data-type="${f.type}" data-index="${f.index}" title="Remove">&times;</button>
      </li>
    `).join('')}</ul>`;

    filesListEl.querySelectorAll('.module-file-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        const idx = parseInt(btn.dataset.index);
        if (type === 'existing') {
          filesToDelete.push(moduleFiles[idx].path);
          moduleFiles.splice(idx, 1);
        } else {
          pendingFiles.splice(idx, 1);
        }
        renderFilesList();
      });
    });
  }
  renderFilesList();

  function addPendingFiles(files) {
    for (const file of files) {
      pendingFiles.push(file);
    }
    renderFilesList();
  }

  filesInput.addEventListener('change', () => {
    if (filesInput.files.length > 0) {
      addPendingFiles(Array.from(filesInput.files));
      filesInput.value = '';
    }
  });

  filesUploadArea.addEventListener('dragover', (e) => { e.preventDefault(); filesUploadArea.classList.add('drag-over'); });
  filesUploadArea.addEventListener('dragleave', () => filesUploadArea.classList.remove('drag-over'));
  filesUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    filesUploadArea.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      addPendingFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorArea.innerHTML = '';

    const moduleName = el.querySelector('#module-name').value.trim();
    const versionNumber = el.querySelector('#version-number').value.trim() || '1.0';
    const refresherMonths = parseInt(el.querySelector('#refresher-months').value) || 12;
    const assessmentType = el.querySelector('input[name="assessment-type"]:checked').value;
    const isActive = el.querySelector('#is-active').checked;
    const maxScore = assessmentType === 'scored_quiz' ? parseInt(el.querySelector('#max-score').value) : null;
    const passMark = assessmentType === 'scored_quiz' ? parseInt(el.querySelector('#pass-mark').value) : null;

    // Validation
    const errors = [];
    if (!moduleName) errors.push('Module name is required.');
    if (assessmentType === 'scored_quiz') {
      if (!maxScore || maxScore < 1) errors.push('Max score must be at least 1.');
      if (!passMark || passMark < 1) errors.push('Pass mark must be at least 1.');
      if (maxScore && passMark && passMark > maxScore) errors.push('Pass mark cannot exceed max score.');
    }

    if (errors.length > 0) {
      errorArea.innerHTML = `<div class="error-summary"><h3>Please fix the following:</h3><ul>${errors.map(e => '<li>' + esc(e) + '</li>').join('')}</ul></div>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving\u2026';
    progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Saving module...</span></div>';

    try {
      const payload = {
        module_name: moduleName,
        version_number: versionNumber,
        refresher_period_months: refresherMonths,
        assessment_type: assessmentType,
        max_score: maxScore,
        pass_mark: passMark,
        syllabus: syllabus,
        is_active: isActive,
      };

      let savedModule;
      if (existing) {
        savedModule = await updateModule(editId, payload);
      } else {
        savedModule = await createModule(payload);
      }

      // Upload PDF if selected
      if (selectedFile) {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading PDF...</span></div>';
        const { path, filename } = await uploadModulePDF(savedModule.id, selectedFile);
        await updateModule(savedModule.id, {
          source_pdf_path: path,
          source_pdf_filename: filename,
        });
      }

      // Handle module files: delete removed, upload new
      if (filesToDelete.length > 0 || pendingFiles.length > 0) {
        progressArea.innerHTML = '<div class="submit-progress"><div class="progress-spinner"></div><span>Processing module files...</span></div>';

        for (const path of filesToDelete) {
          try { await deleteModuleFile(path); } catch (e) { console.error('Failed to delete file:', e); }
        }

        const updatedFiles = [...moduleFiles];
        for (let i = 0; i < pendingFiles.length; i++) {
          progressArea.innerHTML = `<div class="submit-progress"><div class="progress-spinner"></div><span>Uploading file ${i + 1} of ${pendingFiles.length}...</span></div>`;
          const result = await uploadModuleFile(savedModule.id, pendingFiles[i]);
          updatedFiles.push({ path: result.path, filename: result.filename, size: result.size });
        }

        await updateModule(savedModule.id, { module_files: updatedFiles });
      }

      navigate('/modules/' + savedModule.id);
    } catch (err) {
      errorArea.innerHTML = `<div class="error-summary"><h3>Error</h3><ul><li>${esc(err.message)}</li></ul></div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = existing ? 'Save Changes' : 'Create Module';
      progressArea.innerHTML = '';
    }
  });
}
