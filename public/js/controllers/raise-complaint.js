/* ==========================================================================
   CampusCare - Raise Complaint Controller with Validation & Storage Upload
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { createComplaint } from '../services/complaint.service.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { profile } = await requireAuth('student');
    initDropzone();
    initFormValidation(profile);
  } catch (err) {
    console.error('Raise complaint controller init error:', err);
  }
});

/**
 * Initialize Drag-and-Drop Image Dropzone & Preview
 */
function initDropzone() {
  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('image-input');
  const previewContainer = document.getElementById('image-preview');
  const imageError = document.getElementById('image-error');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelection(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
  });

  function handleFileSelection(file) {
    if (imageError) imageError.style.display = 'none';

    // File validation: Type and Size (< 5MB)
    if (!file.type.startsWith('image/')) {
      showToast('Invalid file format. Please upload an image (PNG, JPG, WEBP).', 'error');
      if (imageError) {
        imageError.textContent = 'Please select a valid image file (PNG, JPG, WEBP).';
        imageError.style.display = 'block';
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must not exceed 5MB.', 'warning');
      if (imageError) {
        imageError.textContent = 'Image file size must be less than 5MB.';
        imageError.style.display = 'block';
      }
      return;
    }

    selectedImageFile = file;

    // Render Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewContainer.innerHTML = `
        <div class="image-preview-container">
          <img src="${e.target.result}" alt="Photo Evidence Preview" />
          <button type="button" class="remove-img-btn" id="remove-img-btn" title="Remove photo">✕</button>
        </div>
      `;

      document.getElementById('remove-img-btn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectedImageFile = null;
        fileInput.value = '';
        previewContainer.innerHTML = '';
      });
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Form Input Validation & Submission Handler
 */
function initFormValidation(studentProfile) {
  const form = document.getElementById('raise-complaint-form');
  if (!form) return;

  const titleInput = document.getElementById('comp-title');
  const categorySelect = document.getElementById('comp-cat');
  const urgencySelect = document.getElementById('comp-urgency');
  const locationInput = document.getElementById('comp-location');
  const descInput = document.getElementById('comp-desc');

  const titleError = document.getElementById('title-error');
  const categoryError = document.getElementById('category-error');
  const locationError = document.getElementById('location-error');
  const descError = document.getElementById('desc-error');

  function clearErrors() {
    [titleError, categoryError, locationError, descError].forEach(el => {
      if (el) el.style.display = 'none';
    });
    [titleInput, categorySelect, locationInput, descInput].forEach(el => {
      if (el) el.style.borderColor = 'var(--border-color)';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const title = titleInput.value.trim();
    const category = categorySelect.value;
    const urgency = urgencySelect.value;
    const location = locationInput.value.trim();
    const description = descInput.value.trim();

    let isValid = true;

    // 1. Title validation
    if (!title || title.length < 5) {
      if (titleError) titleError.style.display = 'block';
      titleInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    // 2. Category validation
    if (!category) {
      if (categoryError) categoryError.style.display = 'block';
      categorySelect.style.borderColor = '#ef4444';
      isValid = false;
    }

    // 3. Location validation
    if (!location) {
      if (locationError) locationError.style.display = 'block';
      locationInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    // 4. Description validation
    if (!description || description.length < 10) {
      if (descError) descError.style.display = 'block';
      descInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    if (!isValid) {
      showToast('Please fix validation errors before submitting.', 'warning');
      return;
    }

    try {
      // Show loading animation overlay
      showLoader('Lodging complaint and uploading evidence...');

      // Call Firestore and Firebase Storage services (Auto-generates Complaint ID)
      const createdComplaint = await createComplaint(
        studentProfile,
        { category, urgency, location, title, description },
        selectedImageFile
      );

      hideLoader();
      showToast(`Complaint lodged! Ticket ID: ${createdComplaint.ticketId}`, 'success', 5000);
      
      // Redirect to student dashboard
      window.location.href = resolveUrl('/student/dashboard.html');

    } catch (err) {
      hideLoader();
      console.error('Submit complaint error:', err);
      showToast('Failed to raise complaint. Please try again.', 'error');
    }
  });
}
