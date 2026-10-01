# CampusCare – Digital Complaint Management System

CampusCare is an institutional, production-quality digital complaint management web application engineered for universities, colleges, and residential campuses. It establishes a complete, transparent, and accountable **3-Role Operational Workflow**:

```
                    CAMPUSCARE
                        │
          ┌─────────────┼─────────────┐
          │             │             │
       STUDENT       FACULTY        ADMIN
          │             │             │
   Create Complaint     │       Manage Complaints
   Track Status         │       Assign Faculty
   Submit Feedback      │       System Analytics
          │             │       User Management
          ▼             │
      SUBMITTED ────────┤
                        │
                        ▼
                    ASSIGNED
                        │
                        ▼
                    ACCEPTED
                        │
                        ▼
                  IN PROGRESS
                        │
                        ▼
                    RESOLVED
                        │
                        ▼
                     CLOSED
                        │
                        ▼
               STUDENT FEEDBACK
```

---

## 👥 Supported User Roles

CampusCare supports exactly **3 user roles**:

### 1. `student`
The Student role is responsible for creating complaints, tracking their live lifecycle, and providing feedback after resolution.
- **Raise Complaint**: Submit tickets with category, structured location (*Building/Block, Floor, Room, Details*), urgency (*Low, Medium, High, Critical*), and photo evidence.
- **Client-Side File Validation**: Image type checking (PNG, JPG, WEBP) and 5MB size limit validation before upload.
- **My Complaints & Tracking**: Real-time Firestore stream of personal complaints with live status badges.
- **Timeline & Audit Trail**: Visual chronological step-by-step history of all lifecycle transitions and notes.
- **Cancel Ticket**: Allows canceling complaints while in `Submitted` or `Assigned` states if the issue no longer exists.
- **Reopen Ticket**: Allows reopening tickets from `Resolved` or `Closed` if the underlying issue persists.
- **Resolution Rating & Review**: Submit 1–5 star ratings and written reviews once an issue is resolved.
- **Student Profile**: Manage personal profile information and change passwords.
- **Role Isolation**: Students can strictly access their own complaints and notifications.

### 2. `faculty`
A dedicated **Faculty Portal** designed for assigned faculty members and department in-charges. Faculty members only access complaints assigned directly to them.
- **Faculty Dashboard**: 6 metric counters (*Total Assigned, New Assignments, In Progress, Resolved, Pending, Reopened*), interactive workflow stepper, and quick action modals.
- **Assigned Complaints Roster**: Filter complaints assigned to the logged-in faculty member by status, category, and priority.
- **Complaint Triage & Resolution Workflow**:
  - `Accept Assignment`: Transition status from `Assigned` $\rightarrow$ `Accepted`.
  - `Start Work`: Transition status from `Accepted` $\rightarrow$ `In Progress`.
  - `Update Progress & Notes`: Append notes and updates directly into the ticket timeline.
  - `Upload Resolution Evidence`: Attach photo evidence proving completion of maintenance work.
  - `Mark Resolved`: Transition status from `In Progress` $\rightarrow$ `Resolved`.
  - `Request Reassignment`: Request admin to reassign ticket to another department or faculty lead.
- **Faculty Profile**: Update contact details and change password.
- **Role Isolation**: Faculty cannot view other faculty members' complaints, edit administrative settings, delete complaints, or access admin-only features.

### 3. `admin`
Central administrative authority with global oversight of all campus complaints and institutional operations.
- **Executive Analytics Dashboard**:
  - 8 real-time KPI counters (*Total, Submitted, In Progress, Resolved, Closed, Rejected, High/Critical, Pending Faculty Action*).
  - 5 Chart.js data visualizations (*Category Distribution, Departmental Workload, Urgency Breakdown, Lifecycle Status, Faculty Workload*).
- **Global Complaint Management**: Search complaints by Ticket ID, Title, Student Name, Student ID, or Department. Filter by status, category, priority, and assigned faculty.
- **Assignment & Triage**:
  - Assign or reassign tickets to specific faculty members with custom instruction notes.
  - Verify faculty resolution evidence and transition status to `Closed`.
  - Reject invalid or duplicate tickets with required institutional reasons.
  - Reopen closed tickets back to active triage.
  - Add internal administrative action notes to ticket timelines.
- **Faculty Roster Management**: View faculty roster, register new faculty accounts, edit profiles, and activate/deactivate faculty members.
- **Category Management**: Create, edit, and delete institutional complaint categories.
- **Student Database**: View student roster and contact details.
- **Reports & Export**: Export comprehensive CSV audit reports of complaints and metrics.

---

## 🔑 Predefined Demo Accounts

CampusCare provides pre-seeded accounts for immediate evaluation:

| Role | Email | Password | Full Name / Department |
| :--- | :--- | :--- | :--- |
| **Student** | `student@campuscare.edu` | `Student@123` | Alex Morgan (CSE) |
| **Faculty** | `faculty@campuscare.edu` | `Faculty@123` | Prof. Sarah Jenkins (CSE) |
| **Admin** | `admin@campuscare.edu` | `Admin@123` | Dr. Robert Vance (Campus Operations) |

---

## 🔄 Complaint Status Lifecycle

CampusCare enforces a strict state machine across all 3 roles:

```text
Submitted ──► Assigned ──► Accepted ──► In Progress ──► Resolved ──► Closed
    │             │                                        │            │
    ▼             ▼                                        ▼            ▼
[Student Cancel / Admin Reject]                       [Student / Admin Reopen]
```

1. **Submitted**: Student raises the complaint with details and optional photo evidence.
2. **Assigned**: Central Admin assigns the ticket to a specific Faculty member.
3. **Accepted**: Faculty member opens the ticket and accepts the assignment.
4. **In Progress**: Faculty member begins maintenance/resolution work.
5. **Resolved**: Faculty member finishes work, uploads resolution photo evidence, and marks the complaint resolved.
6. **Closed**: Admin verifies the resolution and officially closes the ticket.
7. **Student Feedback**: Student provides a 1–5 star rating and feedback review.

---

## 🛠️ Technology Stack & Architecture

- **Zero-Build Vanilla Web Application**: Pure HTML5, modern Vanilla JavaScript (ES6 modules), and custom CSS. No build tools (Webpack/Vite) required.
- **Styling System**: CSS custom variables, modern glassmorphism, responsive flex/grid layouts, light/dark mode theme toggle.
- **Data & Storage Layer**:
  - **Firebase Authentication**: Session management and email/password authentication.
  - **Cloud Firestore**: Real-time document updates, subcollections (`complaints/{complaintId}/timeline`), and RBAC security rules.
  - **Firebase Storage**: Secure file uploads under `/complaint_images/` and `/resolution_images/` with client-side and server-side image validation (< 5MB).
  - **Offline/Demo Persistence**: Automatic fallback to `localStorage` with seed datasets if Firestore is offline or credentials are in demo mode.
- **Visualizations**: [Chart.js](https://www.chartjs.org/) via CDN.
- **PDF Generation**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) for official 1-page institutional complaint summary reports.

---

## 📁 Directory Structure

```
CampusCare/
├── firebase.json                       # Firebase Hosting & Firestore configuration
├── .firestore.rules                    # Cloud Firestore RBAC Security Rules (3 roles)
├── .storage.rules                      # Firebase Storage Security Rules
├── firestore.indexes.json              # Firestore composite index definitions
├── README.md                           # Documentation
└── public/                             # Web Application Root
    ├── index.html                      # Institutional Landing Page
    ├── login.html                      # Sign-In with 3-Role Demo Switcher
    │
    ├── student/                        # Student Portal
    │   ├── dashboard.html              # Student Dashboard & My Complaints
    │   ├── raise-complaint.html        # Complaint Form + Location + Evidence Dropzone
    │   ├── view-complaint.html         # Ticket Detail + Timeline + Action Bar (Cancel/Reopen)
    │   ├── feedback.html               # Resolution Rating & Review Center
    │   └── profile.html                # Student Profile Management
    │
    ├── faculty/                        # Faculty Portal
    │   ├── dashboard.html              # Faculty Dashboard (Metrics & Workflow Stepper)
    │   ├── complaints.html             # Assigned Complaints Table & Action Modals
    │   ├── detail.html                 # Ticket Details, Evidence & Action Toolbar
    │   └── profile.html                # Faculty Profile Management
    │
    ├── admin/                          # Admin Portal
    │   ├── dashboard.html              # Executive Command Center (8 KPIs, 5 Charts, Triage)
    │   ├── complaints.html             # Master Complaints Database (Search, Filter, Export)
    │   ├── detail.html                 # Admin Triage View (Assign, Verify, Close, Reject)
    │   ├── feedback.html               # Student Feedback Analytics
    │   └── profile.html                # Admin Settings
    │
    ├── css/
    │   ├── variables.css               # Design tokens, palette, and glassmorphism
    │   ├── base.css                    # Resets, navbar, and sidebar layout
    │   ├── components.css              # Cards, badges, modals, timeline, priority styles
    │   ├── responsive.css              # Mobile and tablet breakpoints
    │   ├── student.css                 # Student-specific styles
    │   ├── faculty.css                 # Faculty-specific styles & stepper
    │   └── admin.css                   # Admin-specific styles & analytics
    │
    └── js/                             # ES6 Modular JavaScript
        ├── config/
        │   └── firebase-config.js      # Firebase SDK initialization
        ├── services/                   # Service Layer
        │   ├── auth.service.js         # Authentication & profile methods
        │   ├── user.service.js         # User, student, and faculty management
        │   ├── complaint.service.js    # Master 3-role complaint lifecycle logic
        │   ├── notification.service.js # Role-aware notification dispatch
        │   ├── analytics.service.js    # KPI metric & chart calculations
        │   └── storage.service.js      # Evidence image upload & validation
        ├── utils/                      # Utilities
        │   ├── guards.js               # RBAC route guards (`requireRole`, `redirectByRole`)
        │   ├── formatters.js           # Date, Ticket ID, Status & Priority badge formatters
        │   ├── toast.js                # Toast alert notifications
        │   ├── loader.js               # Loading overlay
        │   └── notification-dropdown.js# In-app notification bell dropdown
        └── controllers/                # Page Controllers
            ├── login.controller.js     # Login handler & demo button bindings
            ├── student-dashboard.js    # Student dashboard logic
            ├── raise-complaint.js      # Form validation & upload handler
            ├── view-complaint.js       # Unified ticket view for Student & Admin
            ├── student-feedback.js     # Student feedback submission
            ├── faculty-dashboard.js    # Faculty dashboard & quick actions
            ├── faculty-complaints.js   # Faculty assigned complaints table
            ├── faculty-detail.js       # Faculty detail & resolution actions
            ├── admin-dashboard.js      # Admin analytics, charts & triage
            ├── admin-complaints.js     # Admin complaints database & filters
            ├── admin-feedback.js       # Admin feedback overview
            └── profile.controller.js   # Universal profile management
```

---

## ⚡ Running Locally

CampusCare runs in any modern web browser without a build step:

1. Open your terminal in the project directory:
   ```bash
   cd c:\Users\ashis\Desktop\CampusCare
   ```

2. Start a static local HTTP server serving the `public` directory:
   ```bash
   npx serve public -l 3000
   ```
   *or with Python 3:*
   ```bash
   python -m http.server 3000 --directory public
   ```

3. Open your browser to:
   ```
   http://localhost:3000
   ```

---

## 🛡️ Security Rules

CampusCare enforces real role-based security boundaries in `.firestore.rules` and `.storage.rules`:

- **Firestore**:
  - `student`: Can create complaints, read own complaints, append to own timeline, submit feedback, read own profile, read own notifications. Cannot view or edit other users' complaints.
  - `faculty`: Can read complaints assigned to them, update status to `Accepted`, `In Progress`, or `Resolved`, upload resolution evidence, add timeline notes, and read own notifications. Cannot view unassigned complaints or administrative settings.
  - `admin`: Full administrative access to manage complaints, assign faculty, close/reject/reopen tickets, manage categories, and manage users.
- **Storage**:
  - Restricts uploads to images only (PNG, JPG, WEBP) under 5MB.
  - Allows students to upload under `/complaint_images/{complaintId}/`.
  - Allows assigned faculty and admins to upload under `/resolution_images/{complaintId}/`.
