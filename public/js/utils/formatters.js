/* ==========================================================================
   CampusCare - Formatters & Status Mappers
   ========================================================================== */

export function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval}y ago`;

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval}mo ago`;

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval}d ago`;

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval}h ago`;

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval}m ago`;

  return 'Just now';
}

export function renderStatusBadge(status) {
  const statusMap = {
    'Submitted': 'badge-submitted',
    'Under Review': 'badge-underreview',
    'Assigned': 'badge-assigned',
    'In Progress': 'badge-inprogress',
    'Resolved': 'badge-resolved',
    'Rejected': 'badge-rejected',
    'Closed': 'badge-closed'
  };

  const cssClass = statusMap[status] || 'badge-submitted';
  return `<span class="badge ${cssClass}">${status || 'Submitted'}</span>`;
}

export function renderUrgencyBadge(urgency) {
  return `<span class="badge badge-urgency-${urgency}">${urgency || 'Medium'}</span>`;
}

export function generateTicketId() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const year = new Date().getFullYear();
  return `CC-${year}-${randomNum}`;
}
