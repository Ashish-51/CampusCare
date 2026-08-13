/* ==========================================================================
   CampusCare - Complaint Details & Timeline Controller
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { getComplaintDetails, submitComplaintFeedback, listenToComplaintDetails } from '../services/complaint.service.js';
import { formatDate, renderStatusBadge, renderUrgencyBadge } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let currentComplaintId = null;
let currentRating = 5;
let loadedComplaintData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireAuth();
    const urlParams = new URLSearchParams(window.location.search);
    currentComplaintId = urlParams.get('id');

    if (!currentComplaintId) {
      currentComplaintId = sessionStorage.getItem('cc_active_complaint_id');
    } else {
      sessionStorage.setItem('cc_active_complaint_id', currentComplaintId);
    }

    if (!currentComplaintId) {
      showToast('No complaint specified.', 'error');
      window.location.href = resolveUrl(profile.role === 'admin' ? '/admin/dashboard.html' : '/student/dashboard.html');
      return;
    }

    // Real-Time Firestore Listener for Single Complaint Document
    listenToComplaintDetails(currentComplaintId, (updatedComplaint) => {
      if (updatedComplaint) {
        loadedComplaintData = updatedComplaint;
        renderComplaintDetailsUI(updatedComplaint, profile);
      }
    });

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await loadComplaintDetails(profile);
        showToast('Firestore details refreshed.', 'info');
      });
    }

    // 1. Print Ticket Handler
    const printBtn = document.getElementById('print-ticket-btn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (!loadedComplaintData) {
          showToast('Complaint data not loaded yet.', 'warning');
          return;
        }

        let printWrapper = document.getElementById('print-document-wrapper');
        if (!printWrapper) {
          printWrapper = document.createElement('div');
          printWrapper.id = 'print-document-wrapper';
          document.body.appendChild(printWrapper);
        }

        printWrapper.innerHTML = '';
        printWrapper.appendChild(buildPrintableDocumentElement(loadedComplaintData));

        window.print();
      });
    }

    // 2. Download PDF File Handler
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', async () => {
        if (!loadedComplaintData) {
          showToast('Complaint data not loaded yet.', 'warning');
          return;
        }

        const ticketId = loadedComplaintData.ticketId || loadedComplaintData.id || 'CC-2026-0000';
        const docElem = buildPrintableDocumentElement(loadedComplaintData);

        // Append offscreen for rendering
        docElem.style.position = 'fixed';
        docElem.style.left = '-9999px';
        docElem.style.top = '0';
        docElem.style.width = '790px';
        document.body.appendChild(docElem);

        if (window.html2pdf) {
          showToast('Generating official 1-page PDF document download...', 'info');
          const opt = {
            margin:       [0.25, 0.25, 0.25, 0.25],
            filename:     `${ticketId}_Official_Report.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
          };
          try {
            await html2pdf().set(opt).from(docElem).save();
            showToast('Official PDF report downloaded successfully!', 'success');
          } catch (err) {
            console.error('PDF export error:', err);
            showToast('Failed to export PDF file.', 'error');
          } finally {
            if (docElem.parentNode) docElem.parentNode.removeChild(docElem);
          }
        } else {
          if (docElem.parentNode) docElem.parentNode.removeChild(docElem);
          showToast('PDF library fallback: Triggering print dialog.', 'warning');
          window.print();
        }
      });
    }

  } catch (err) {
    console.error('View complaint controller error:', err);
  }
});

/**
 * Fetch and Render Complaint Details from Firestore
 */
async function loadComplaintDetails(currentProfile) {
  showLoader('Retrieving complaint details from Firestore...');
  const complaint = await getComplaintDetails(currentComplaintId);
  hideLoader();

  if (!complaint) {
    showToast('Complaint document not found.', 'error');
    return;
  }

  renderComplaintDetailsUI(complaint, currentProfile);
}

function renderComplaintDetailsUI(complaint, currentProfile) {
  loadedComplaintData = complaint;

  // 1. Complaint ID (Ticket ID)
  const ticketIdEl = document.getElementById('complaint-ticket-id');
  if (ticketIdEl) ticketIdEl.textContent = complaint.ticketId || complaint.id;

  // 2. Status Badge & Priority Badge
  const statusBadgeEl = document.getElementById('complaint-status-badge');
  const priorityBadgeEl = document.getElementById('complaint-priority-badge') || document.getElementById('complaint-urgency-badge');
  if (statusBadgeEl) statusBadgeEl.innerHTML = renderStatusBadge(complaint.status);
  if (priorityBadgeEl) priorityBadgeEl.innerHTML = renderUrgencyBadge(complaint.urgency);

  // 3. Title & Description
  const titleEl = document.getElementById('complaint-title');
  const descEl = document.getElementById('complaint-desc');
  if (titleEl) titleEl.textContent = complaint.title || 'Untitled Complaint';
  if (descEl) descEl.textContent = complaint.description || 'No description provided.';

  // 4. Student Info
  const studentNameEl = document.getElementById('meta-student-name') || document.getElementById('complaint-student-info');
  if (studentNameEl) {
    const studentName = complaint.studentName || (complaint.timeline && complaint.timeline[0] ? complaint.timeline[0].updatedByName : 'Student');
    const dept = complaint.department || 'General';
    studentNameEl.textContent = `${studentName} (${dept})`;
  }

  // 5. Category & Location
  const catEl = document.getElementById('meta-category') || document.getElementById('complaint-category');
  const locEl = document.getElementById('meta-location') || document.getElementById('complaint-location');
  if (catEl) catEl.textContent = complaint.category || 'General';
  if (locEl) locEl.textContent = complaint.location || 'N/A';

  // 6. Created Date & Updated Date
  const createdDateEl = document.getElementById('meta-created-date') || document.getElementById('complaint-date');
  const updatedDateEl = document.getElementById('meta-updated-date');
  if (createdDateEl) createdDateEl.textContent = formatDate(complaint.createdAt);
  if (updatedDateEl) updatedDateEl.textContent = formatDate(complaint.updatedAt || complaint.createdAt);

  // 7. Admin Remarks Box
  const adminRemarksEl = document.getElementById('admin-remarks-box');
  if (adminRemarksEl) {
    if (complaint.adminRemarks && complaint.adminRemarks.trim() !== '') {
      adminRemarksEl.innerHTML = `
        <div style="background:var(--border-light); border:1px solid var(--border-color); padding:1.1rem; border-radius:var(--radius-md);">
          <h4 style="font-size:0.85rem; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.3rem;">
            <i class="fa-solid fa-user-shield"></i> Administration Remarks / Action Notes:
          </h4>
          <p style="font-size:0.92rem; color:var(--text-primary); margin-top:0.25rem;">${escapeHtml(complaint.adminRemarks)}</p>
          ${complaint.assignedTo ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem;">Assigned Lead: <strong style="color:var(--text-primary);">${escapeHtml(complaint.assignedTo)}</strong></div>` : ''}
        </div>
      `;
    } else {
      adminRemarksEl.innerHTML = '';
    }
  }

  // 8. Attached Image Evidence
  const imgContainer = document.getElementById('complaint-image-container');
  if (imgContainer) {
    if (complaint.imageUrl) {
      imgContainer.innerHTML = `
        <h4 style="font-size:0.85rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.5rem;">
          <i class="fa-solid fa-image"></i> Attachment Evidence Photo:
        </h4>
        <a href="${complaint.imageUrl}" target="_blank" rel="noopener">
          <img src="${complaint.imageUrl}" alt="Evidence Photo" class="evidence-image-preview" title="Click to open full resolution image" />
        </a>
      `;
    } else {
      imgContainer.innerHTML = `
        <div style="font-size:0.82rem; color:var(--text-muted); font-style:italic;">
          <i class="fa-solid fa-image-slash"></i> No image attachment provided.
        </div>
      `;
    }
  }

  // 9. Timeline Sub-collection Events
  renderTimelineEvents(complaint.timeline || []);

  // 10. Post-Resolution Feedback Section
  renderFeedbackSection(complaint, currentProfile);
}

/**
 * Render Step-by-Step Timeline Events
 */
function renderTimelineEvents(timeline) {
  const container = document.getElementById('timeline-container');
  if (!container) return;

  if (!timeline || timeline.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.88rem;">No timeline updates recorded yet.</p>';
    return;
  }

  container.innerHTML = `
    <div class="timeline">
      ${timeline.map((ev, index) => `
        <div class="timeline-item ${index === timeline.length - 1 ? 'active' : ''}">
          <div class="timeline-badge"></div>
          <div class="timeline-content">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.25rem;">
              <span class="timeline-title">${escapeHtml(ev.title)}</span>
              <span class="timeline-date">${formatDate(ev.timestamp)}</span>
            </div>
            ${ev.note ? `<div class="timeline-note">${escapeHtml(ev.note)}</div>` : ''}
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
              <i class="fa-solid fa-user-check"></i> ${escapeHtml(ev.updatedByName || 'System')} (${ev.updatedByRole || 'admin'})
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render Resolution Rating Feedback Card
 */
function renderFeedbackSection(complaint, currentProfile) {
  const feedbackCard = document.getElementById('feedback-section');
  const feedbackContent = document.getElementById('feedback-content');

  if (!feedbackCard || !feedbackContent) return;

  if (complaint.status === 'Resolved' && currentProfile.role === 'student' && !complaint.feedback) {
    feedbackCard.style.display = 'block';
    feedbackContent.innerHTML = `
      <form id="feedback-form">
        <div class="form-group">
          <label class="form-label">Select Satisfaction Rating</label>
          <div class="star-rating star-rating-input">
            <span class="star selected" data-value="1">★</span>
            <span class="star selected" data-value="2">★</span>
            <span class="star selected" data-value="3">★</span>
            <span class="star selected" data-value="4">★</span>
            <span class="star selected" data-value="5">★</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="feedback-comment">Review Comments / Remarks</label>
          <textarea id="feedback-comment" name="comment" class="form-control" placeholder="Share your experience regarding maintenance staff service quality..." style="min-height:85px;"></textarea>
        </div>

        <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Submit Feedback & Close Ticket</button>
      </form>
    `;

    initStarRatingInput();
    initFeedbackFormSubmission();

  } else if (complaint.feedback) {
    feedbackCard.style.display = 'block';
    const rating = complaint.feedback.rating || 5;
    feedbackContent.innerHTML = `
      <div style="padding:1rem; background:var(--border-light); border-radius:var(--radius-md);">
        <div style="color:#f59e0b; font-size:1.4rem; margin-bottom:0.25rem;">
          ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}
        </div>
        <p style="font-size:0.92rem; color:var(--text-primary); font-style:italic;">"${escapeHtml(complaint.feedback.comment || 'No additional comment provided.')}"</p>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.4rem;">Submitted on ${formatDate(complaint.feedback.submittedAt)}</div>
      </div>
    `;
  } else {
    feedbackCard.style.display = 'none';
  }
}

function initStarRatingInput() {
  const stars = document.querySelectorAll('.star-rating-input .star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      currentRating = parseInt(star.dataset.value, 10);
      stars.forEach(s => {
        const val = parseInt(s.dataset.value, 10);
        if (val <= currentRating) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });
}

function initFeedbackFormSubmission() {
  const form = document.getElementById('feedback-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const comment = form.comment.value.trim();

    try {
      showLoader('Submitting rating feedback to Firestore...');
      await submitComplaintFeedback(currentComplaintId, currentRating, comment);
      hideLoader();
      showToast('Thank you for rating resolution quality!', 'success');
      window.location.reload();
    } catch (err) {
      hideLoader();
      console.error('Feedback error:', err);
      showToast('Failed to submit feedback.', 'error');
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

/**
 * Generate Official Light-Mode Institutional Document Element for Print & PDF
 */
function buildPrintableDocumentElement(complaint) {
  const container = document.createElement('div');
  container.className = 'printable-document-root';
  container.style.cssText = `
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    padding: 32px 36px;
    max-width: 800px;
    margin: 0 auto;
    box-sizing: border-box;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
  `;

  const ticketId = complaint.ticketId || complaint.id || 'CC-2026-0000';
  const studentName = complaint.studentName || (complaint.timeline && complaint.timeline[0] ? complaint.timeline[0].updatedByName : 'Student Account');
  const dept = complaint.department || 'General Department';

  const statusColorMap = {
    'Submitted': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    'In Progress': { bg: '#fefce8', color: '#a16207', border: '#fef08a' },
    'Resolved': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    'Closed': { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }
  };
  const statusStyle = statusColorMap[complaint.status] || { bg: '#f8fafc', color: '#334155', border: '#cbd5e1' };

  container.innerHTML = `
    <!-- Header Bar -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 18px;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="background: #2563eb; color: #ffffff; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px;">CC</div>
          <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.3px;">CampusCare Portal</h1>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600;">Official Maintenance Complaint & Audit Summary</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 15px; font-weight: 800; color: #2563eb; font-family: monospace; background: #eff6ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe; display: inline-block;">${escapeHtml(ticketId)}</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Issued: ${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <!-- Status & Urgency Bar -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 18px;">
      <div style="display: flex; align-items: center; gap: 14px; font-size: 12px;">
        <div><span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Status</span><strong style="color: ${statusStyle.color}; font-size: 13px;">${escapeHtml(complaint.status || 'Submitted')}</strong></div>
        <div style="height: 20px; width: 1px; background: #cbd5e1;"></div>
        <div><span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Urgency</span><strong style="color: #0f172a;">${escapeHtml(complaint.urgency || 'Medium')}</strong></div>
        <div style="height: 20px; width: 1px; background: #cbd5e1;"></div>
        <div><span style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Category</span><strong style="color: #0f172a;">${escapeHtml(complaint.category || 'General')}</strong></div>
      </div>
      <div style="font-size: 11px; color: #64748b;">Lodged Date: <strong>${formatDate(complaint.createdAt)}</strong></div>
    </div>

    <!-- Metadata Grid -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 18px;">
      <tr>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; width: 22%;">Student Name</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a; width: 28%; font-weight: 600;">${escapeHtml(studentName)}</td>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569; width: 22%;">Department</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a; width: 28%; font-weight: 600;">${escapeHtml(dept)}</td>
      </tr>
      <tr>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">Location</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a;">${escapeHtml(complaint.location || 'N/A')}</td>
        <td style="padding: 7px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; font-weight: 700; color: #475569;">Last Updated</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #0f172a;">${formatDate(complaint.updatedAt || complaint.createdAt)}</td>
      </tr>
    </table>

    <!-- Title & Description Section -->
    <div style="margin-bottom: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Subject / Issue Title</div>
      <h2 style="font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 10px 0; line-height: 1.3;">${escapeHtml(complaint.title)}</h2>

      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Detailed Description</div>
      <div style="font-size: 12px; line-height: 1.5; color: #334155; margin: 0; white-space: pre-line; background: #f8fafc; padding: 10px; border-radius: 4px; border: 1px solid #f1f5f9;">${escapeHtml(complaint.description || 'No description provided.')}</div>
    </div>

    <!-- Admin Remarks (if present) -->
    ${complaint.adminRemarks ? `
    <div style="margin-bottom: 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #2563eb; border-radius: 6px; padding: 12px 14px;">
      <div style="font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Administration Action Remarks</div>
      <div style="font-size: 12px; color: #1e3a8a; line-height: 1.4; font-weight: 500;">${escapeHtml(complaint.adminRemarks)}</div>
      ${complaint.assignedTo ? `<div style="font-size: 10px; color: #3b82f6; margin-top: 4px; font-weight: 600;">Assigned Maintenance Lead: ${escapeHtml(complaint.assignedTo)}</div>` : ''}
    </div>
    ` : ''}

    <!-- Attached Photo Evidence (Sized to fit 1 page) -->
    ${complaint.imageUrl ? `
    <div style="margin-bottom: 18px; page-break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Attachment Evidence Photo</div>
      <div style="text-align: center; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <img src="${complaint.imageUrl}" style="max-width: 100%; max-height: 180px; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1;" alt="Evidence Photo" />
      </div>
    </div>
    ` : ''}

    <!-- Audit Timeline Log -->
    <div style="margin-bottom: 18px; page-break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Lifecycle Audit & Progress History</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; color: #475569;">
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Status Stage</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Timestamp</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Action Notes</th>
            <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Updated By</th>
          </tr>
        </thead>
        <tbody>
          ${(complaint.timeline || []).map(ev => `
            <tr>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${escapeHtml(ev.title)}</td>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #475569;">${formatDate(ev.timestamp)}</td>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #334155;">${escapeHtml(ev.note || '--')}</td>
              <td style="padding: 5px 8px; border: 1px solid #cbd5e1; color: #475569;">${escapeHtml(ev.updatedByName || 'System')} (${ev.updatedByRole || 'admin'})</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Student Feedback (if present) -->
    ${complaint.feedback ? `
    <div style="margin-bottom: 18px; background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 10px 12px; page-break-inside: avoid;">
      <div style="font-size: 10px; font-weight: 700; color: #a16207; text-transform: uppercase; margin-bottom: 3px;">Student Resolution Rating & Feedback</div>
      <div style="color: #f59e0b; font-size: 13px; margin-bottom: 3px;">${'★'.repeat(complaint.feedback.rating || 5)}${'☆'.repeat(5 - (complaint.feedback.rating || 5))}</div>
      <div style="font-size: 11px; color: #713f12; font-style: italic;">"${escapeHtml(complaint.feedback.comment || 'No comment provided.')}"</div>
    </div>
    ` : ''}

    <!-- Official Footer -->
    <div style="border-top: 2px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; margin-top: 18px;">
      <div>CampusCare Digital Facility Management • Confidential Official Audit Record</div>
      <div>Page 1 of 1</div>
    </div>
  `;

  return container;
}
