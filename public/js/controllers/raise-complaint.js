/* ==========================================================================
   CampusCare - Raise Complaint Controller with Validation & Storage Upload
   Student Only Portal: Validates structured location, urgency, and files
   ========================================================================== */

import { requireAuth, resolveUrl } from '../utils/guards.js';
import { createComplaint } from '../services/complaint.service.js';
import { showToast } from '../utils/toast.js';
import { showLoader, hideLoader } from '../utils/loader.js';

let selectedImageFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Strictly Student-only action
    const { user, profile } = await requireAuth(['student']);
    initDropzone();
    initFormValidation(profile);

    const { initNotificationDropdown } = await import('../utils/notification-dropdown.js');
    initNotificationDropdown(user.uid);
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
  
  // Structured Location Inputs
  const buildingInput = document.getElementById('comp-building');
  const floorInput = document.getElementById('comp-floor');
  const roomInput = document.getElementById('comp-room');
  const detailsInput = document.getElementById('comp-loc-details');
  const fallbackLocInput = document.getElementById('comp-location');

  const descInput = document.getElementById('comp-desc');

  // Error message elements
  const titleError = document.getElementById('title-error');
  const categoryError = document.getElementById('category-error');
  const buildingError = document.getElementById('building-error');
  const floorError = document.getElementById('floor-error');
  const roomError = document.getElementById('room-error');
  const locationError = document.getElementById('location-error');
  const descError = document.getElementById('desc-error');

  function clearErrors() {
    [titleError, categoryError, buildingError, floorError, roomError, locationError, descError].forEach(el => {
      if (el) el.style.display = 'none';
    });
    [titleInput, categorySelect, buildingInput, floorInput, roomInput, detailsInput, fallbackLocInput, descInput].forEach(el => {
      if (el) el.style.borderColor = 'var(--border-color)';
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const title = titleInput ? titleInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : '';
    const urgency = urgencySelect ? urgencySelect.value : 'Medium';
    
    // Read structured location
    const building = buildingInput ? buildingInput.value.trim() : '';
    const floor = floorInput ? floorInput.value.trim() : '';
    const room = roomInput ? roomInput.value.trim() : '';
    const locDetails = detailsInput ? detailsInput.value.trim() : '';

    let location = '';
    if (building || floor || room) {
      const parts = [];
      if (building) parts.push(building);
      if (floor) parts.push(floor);
      if (room) parts.push(room);
      location = parts.join(', ') + (locDetails ? ` (${locDetails})` : '');
    } else if (fallbackLocInput && fallbackLocInput.value.trim()) {
      location = fallbackLocInput.value.trim();
    }

    const description = descInput ? descInput.value.trim() : '';

    let isValid = true;

    // 1. Title validation
    if (!title || title.length < 5) {
      if (titleError) titleError.style.display = 'block';
      if (titleInput) titleInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    // 2. Category validation
    if (!category) {
      if (categoryError) categoryError.style.display = 'block';
      if (categorySelect) categorySelect.style.borderColor = '#ef4444';
      isValid = false;
    }

    // 3. Structured Location validation
    if (buildingInput && !building) {
      if (buildingError) buildingError.style.display = 'block';
      buildingInput.style.borderColor = '#ef4444';
      isValid = false;
    }
    if (floorInput && !floor) {
      if (floorError) floorError.style.display = 'block';
      floorInput.style.borderColor = '#ef4444';
      isValid = false;
    }
    if (roomInput && !room) {
      if (roomError) roomError.style.display = 'block';
      roomInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    if (!buildingInput && !location) {
      if (locationError) locationError.style.display = 'block';
      if (fallbackLocInput) fallbackLocInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    // 4. Description validation
    if (!description || description.length < 10) {
      if (descError) descError.style.display = 'block';
      if (descInput) descInput.style.borderColor = '#ef4444';
      isValid = false;
    }

    if (!isValid) {
      showToast('Please complete all required fields.', 'warning');
      return;
    }

    try {
      showLoader('Lodging complaint and uploading evidence...');

      const complaintPayload = {
        title,
        category,
        urgency,
        priority: urgency,
        location,
        locationDetails: {
          block: building,
          floor: floor,
          room: room,
          details: locDetails
        },
        description
      };

      const createdComplaint = await createComplaint(
        studentProfile,
        complaintPayload,
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
