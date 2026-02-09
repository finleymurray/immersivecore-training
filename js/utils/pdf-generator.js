import { formatDateUK } from './date-utils.js';
import { LOGO_WHITE_B64, LOGO_DARK_B64 } from './logo-data.js';

function createDoc() {
  if (typeof window.jspdf === 'undefined') return null;
  const { jsPDF } = window.jspdf;
  return new jsPDF('p', 'mm', 'a4');
}

const black = [11, 12, 12];
const dark = [11, 12, 12];
const grey = [80, 90, 95];
const lightBg = [243, 242, 241];

function drawHeader(doc, title, subtitle) {
  const pw = doc.internal.pageSize.getWidth();
  const ml = 18;

  doc.setFillColor(...black);
  doc.rect(0, 0, pw, 26, 'F');

  // Logo
  doc.addImage(LOGO_WHITE_B64, 'PNG', ml, 4, 14, 14);

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(title, ml + 55, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, ml + 55, 17);
}

function addFooter(doc, footerText) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(...grey);
  doc.text('CONFIDENTIAL \u2014 ' + footerText, pw / 2, ph - 10, { align: 'center' });
  doc.text('ImmersiveCore Training Portal | Generated: ' + new Date().toLocaleString('en-GB'), pw / 2, ph - 6, { align: 'center' });
}

function sectionHeader(doc, y, ml, pw, mr, num, title) {
  doc.setFillColor(...lightBg);
  doc.rect(ml, y, pw - ml - mr, 8, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text(`${num}. ${title}`, ml + 5, y + 6);
  return y + 12;
}

function labelVal(doc, ml, y, label, val) {
  const valCol = ml + 60;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text(label, ml + 5, y);
  doc.setFont('helvetica', 'normal');
  doc.text(val || '\u2014', valCol, y);
  return y + 7;
}

// ---- Training Session PDF ----

function buildTrainingPDFDoc(session, module) {
  const doc = createDoc();
  if (!doc) return null;

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 18;
  const mr = 18;
  let y = 34;

  drawHeader(doc, 'Training Session Log', module?.module_name || 'Training Record');

  // Section 1: Session Details
  y = sectionHeader(doc, y, ml, pw, mr, 1, 'Session Details');
  y = labelVal(doc, ml, y, 'Trainee', session.trainee_name);
  y = labelVal(doc, ml, y, 'Module', module?.module_name || '\u2014');
  y = labelVal(doc, ml, y, 'Version', module?.version_number || '\u2014');
  y = labelVal(doc, ml, y, 'Date', formatDateUK(session.session_date));
  y = labelVal(doc, ml, y, 'Trainer', session.trainer_name);
  y += 4;

  // Section 2: Topics Covered
  const syllabus = Array.isArray(module?.syllabus) ? module.syllabus : [];
  const topics = Array.isArray(session.topics_completed) ? session.topics_completed : [];

  if (syllabus.length > 0) {
    y = sectionHeader(doc, y, ml, pw, mr, 2, 'Topics Covered');

    for (let i = 0; i < syllabus.length; i++) {
      if (y + 8 > ph - 25) {
        addFooter(doc, 'Training Session Log');
        doc.addPage();
        y = 18;
      }
      const state = topics[i];
      const isNa = state === 'na';
      const isCovered = state === true;

      // Draw status indicator
      if (isNa) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 193, 7);
        doc.text('N/A', ml + 3, y);
      } else if (isCovered) {
        // Draw a green tick using lines
        const cx = ml + 7;
        const cy = y - 2.5;
        doc.setDrawColor(76, 175, 80);
        doc.setLineWidth(0.8);
        doc.line(cx - 2, cy + 1, cx, cy + 3);
        doc.line(cx, cy + 3, cx + 3.5, cy - 1.5);
      } else {
        // Draw a red cross using lines
        const cx = ml + 7;
        const cy = y - 1;
        doc.setDrawColor(239, 68, 68);
        doc.setLineWidth(0.8);
        doc.line(cx - 2, cy - 2, cx + 2, cy + 2);
        doc.line(cx + 2, cy - 2, cx - 2, cy + 2);
      }

      // Draw topic text
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...(isNa ? grey : dark));
      doc.text(syllabus[i], ml + 18, y);
      y += 8;
    }

    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text('All topics covered: ' + (session.all_topics_covered ? 'Yes' : 'No'), ml + 5, y);
    y += 8;
  }

  // Section 3: Trainer Declaration
  if (y + 20 > ph - 25) {
    addFooter(doc, 'Training Session Log');
    doc.addPage();
    y = 18;
  }
  y = sectionHeader(doc, y, ml, pw, mr, 3, 'Trainer Declaration');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...dark);
  doc.text(session.trainer_declaration ? 'Confirmed by trainer' : 'Not confirmed', ml + 5, y);
  y += 8;

  // Section 4: Trainee Signature
  if (y + 50 > ph - 25) {
    addFooter(doc, 'Training Session Log');
    doc.addPage();
    y = 18;
  }
  y = sectionHeader(doc, y, ml, pw, mr, 4, 'Trainee Signature');

  if (session.trainee_signature_data) {
    try {
      doc.addImage(session.trainee_signature_data, 'PNG', ml + 5, y, 80, 30);
      y += 35;
    } catch (err) {
      doc.setFontSize(9);
      doc.setTextColor(...grey);
      doc.text('(Signature could not be embedded)', ml + 5, y);
      y += 7;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...grey);
    doc.text('No signature recorded.', ml + 5, y);
    y += 7;
  }

  // Notes
  if (session.notes) {
    if (y + 20 > ph - 25) {
      addFooter(doc, 'Training Session Log');
      doc.addPage();
      y = 18;
    }
    y = sectionHeader(doc, y, ml, pw, mr, 5, 'Notes');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(session.notes, pw - ml - mr - 10);
    doc.text(lines, ml + 5, y);
    y += lines.length * 5 + 4;
  }

  addFooter(doc, 'Training Session Log');
  return doc;
}

export function generateTrainingPDF(session, module) {
  const doc = buildTrainingPDFDoc(session, module);
  if (!doc) { alert('PDF library not loaded.'); return; }
  const name = (session.trainee_name || 'Training').replace(/[^a-zA-Z0-9 ]/g, '');
  const modName = (module?.module_name || 'Session').replace(/[^a-zA-Z0-9 ]/g, '');
  const dateStr = (session.session_date || '').replace(/-/g, '');
  doc.save(`Training_${name}_${modName}_${dateStr}.pdf`);
}

export function generateTrainingPDFBlob(session, module) {
  const doc = buildTrainingPDFDoc(session, module);
  if (!doc) throw new Error('PDF library not loaded.');
  return doc.output('blob');
}

// ---- Assessment PDF ----

function buildAssessmentPDFDoc(assessment, module) {
  const doc = createDoc();
  if (!doc) return null;

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 18;
  const mr = 18;
  let y = 34;

  drawHeader(doc, 'Assessment Record', module?.module_name || 'Assessment');

  // Section 1: Assessment Details
  y = sectionHeader(doc, y, ml, pw, mr, 1, 'Assessment Details');
  y = labelVal(doc, ml, y, 'Trainee', assessment.trainee_name);
  y = labelVal(doc, ml, y, 'Module', module?.module_name || '\u2014');
  y = labelVal(doc, ml, y, 'Date', formatDateUK(assessment.assessment_date));
  y = labelVal(doc, ml, y, 'Assessor', assessment.assessor_name);
  y += 4;

  // Section 2: Result
  y = sectionHeader(doc, y, ml, pw, mr, 2, 'Result');
  y = labelVal(doc, ml, y, 'Score', `${assessment.score_achieved} / ${assessment.max_score}`);
  y = labelVal(doc, ml, y, 'Pass mark', String(assessment.pass_mark));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  if (assessment.passed) {
    doc.setTextColor(76, 175, 80);
    doc.text('PASS', ml + 60 + 5, y);
  } else {
    doc.setTextColor(239, 68, 68);
    doc.text('FAIL', ml + 60 + 5, y);
  }
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text('Result', ml + 5, y);
  y += 7;

  if (assessment.expiry_date) {
    y = labelVal(doc, ml, y, 'Expiry date', formatDateUK(assessment.expiry_date));
  }
  y += 4;

  // Notes
  if (assessment.notes) {
    y = sectionHeader(doc, y, ml, pw, mr, 3, 'Notes');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(assessment.notes, pw - ml - mr - 10);
    doc.text(lines, ml + 5, y);
    y += lines.length * 5 + 4;
  }

  addFooter(doc, 'Assessment Record');
  return doc;
}

export function generateAssessmentPDF(assessment, module) {
  const doc = buildAssessmentPDFDoc(assessment, module);
  if (!doc) { alert('PDF library not loaded.'); return; }
  const name = (assessment.trainee_name || 'Assessment').replace(/[^a-zA-Z0-9 ]/g, '');
  const modName = (module?.module_name || 'Assessment').replace(/[^a-zA-Z0-9 ]/g, '');
  const dateStr = (assessment.assessment_date || '').replace(/-/g, '');
  doc.save(`Assessment_${name}_${modName}_${dateStr}.pdf`);
}

export function generateAssessmentPDFBlob(assessment, module) {
  const doc = buildAssessmentPDFDoc(assessment, module);
  if (!doc) throw new Error('PDF library not loaded.');
  return doc.output('blob');
}
