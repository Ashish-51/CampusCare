# CampusCare – Digital Complaint Management System

CampusCare is a production-quality, modern, full-stack digital complaint management web application designed for educational institutions (Colleges, Universities, Hostels). It empowers Students to easily lodge complaints with photo evidence and track resolution lifecycles step-by-step, while providing Administrators with an analytics dashboard (powered by Chart.js) and triage tools to efficiently assign, manage, and resolve tickets.

---

## 🚀 Key Features

### For Students:
- **Registration & Authentication**: Secure account creation with institutional email, department, roll number, and phone.
- **Raise Complaint**: Lodge complaints under specific categories (*Hostel, Academics, Infrastructure, Mess/Catering, Electrical, IT/Wifi, General*) with location details and urgency level.
- **Drag & Drop Evidence Upload**: File attachment dropzone with real-time image preview and validation (< 5MB).
- **Complaint Tracking & Interactive Timeline**: View real-time status updates (*Submitted $\rightarrow$ In Progress $\rightarrow$ Resolved $\rightarrow$ Closed*) and step-by-step progress notes.
- **Post-Resolution Rating & Feedback**: Rate resolution quality (1 to 5 stars) and submit review comments upon ticket resolution.
- **Student Profile**: Manage personal contact details and update account security password.

### For Administrators:
- **Analytics Dashboard**: Interactive Chart.js graphs displaying:
  - Total, Submitted, In-Progress, and Resolved metric counters.
  - Category breakdown doughnut chart.
  - Departmental distribution bar chart.
- **Master Complaints Database**: Search by Ticket ID, Title, Student Name, or Department. Filter by Status, Category, and Urgency.
- **Status Triage & Assignment**: Change ticket status (*Submitted, In Progress, Resolved, Rejected*), assign maintenance teams, attach admin notes, and trigger automatic timeline logs.
- **Admin Profile**: Manage administrator credentials and departmental assignments.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6 Modules), CSS3 (Custom Variables, Glassmorphism, Flexbox/Grid, Dark/Light Mode Theme Toggle).
- **Charts & Visualization**: [Chart.js](https://www.chartjs.org/) (CDN).
- **Backend Services**:
  - **Firebase Authentication**: Email / Password session management.
  - **Cloud Firestore**: Real-time NoSQL database with structured collections and sub-collections.
  - **Firebase Storage**: Image file uploads for complaint photo evidence.
  - **Firebase Hosting**: Fast static asset distribution.

---

## 📁 Project Structure

```
CampusCare/
├── firebase.json                # Firebase Hosting & Firestore configuration
├── .firestore.rules             # Cloud Firestore Security Rules
├── .storage.rules               # Firebase Storage Security Rules
├── firestore.indexes.json       # Firestore composite index definitions
├── README.md                    # Documentation
└── public/                      # Web Root
    ├── index.html               # Landing page / router
    ├── login.html               # Authentication (Student / Admin toggle)
    ├── student/                 # Student Portal Views
    │   ├── dashboard.html       # Student Dashboard (My Complaints, metrics)
    │   ├── raise-complaint.html # Raise Complaint Form + Drag & Drop Upload
    │   ├── view-complaint.html  # Detailed View + Timeline + Star Rating Feedback
    │   └── profile.html         # Student Account Settings
    ├── admin/                   # Admin Portal Views
    │   ├── dashboard.html       # Admin Analytics (Chart.js stats & charts)
    │   ├── complaints.html      # Master Complaints Database & Triage Modal
    │   ├── detail.html          # Detailed Triage View
    │   └── profile.html         # Admin Settings
    ├── css/
    │   ├── variables.css        # CSS Custom Properties (Theme tokens & Glassmorphism)
    │   ├── base.css             # Resets, layout, navigation bars
    │   ├── components.css       # Buttons, cards, badges, modals, timeline, dropzone
    │   ├── student.css          # Student portal custom styles
    │   └── admin.css            # Admin portal custom styles & data tables
    └── js/                      # Modular JavaScript Codebase (ES Modules)
        ├── config/
        │   └── firebase-config.js # Firebase initialization & SDK exports
        ├── services/            # Service / Data Access Layer
        │   ├── auth.service.js
        │   ├── user.service.js
        │   ├── complaint.service.js
        │   ├── storage.service.js
        │   └── analytics.service.js
        ├── utils/               # Helper modules
        │   ├── guards.js        # Auth & Role-based route guard
        │   ├── formatters.js    # Date, ticket ID, status badge mappers
        │   ├── toast.js         # Toast notification library
        │   └── loader.js        # Loading spinner overlay
        ├── controllers/         # Page controllers handling UI events
        │   ├── login.controller.js
        │   ├── student-dashboard.js
        │   ├── raise-complaint.js
        │   ├── view-complaint.js
        │   ├── admin-dashboard.js
        │   ├── admin-complaints.js
        │   └── profile.controller.js
        └── app.js               # Global initializations (Theme toggle, sidebar)
```

---

## ⚡ Running the Application Locally

1. Open a terminal in the project directory:
   ```bash
   cd c:\Users\ashis\Desktop\CampusCare
   ```

2. Start a static HTTP web server serving the `public/` directory. For example, using Python or `npx serve`:
   ```bash
   npx serve public -l 3000
   ```
   *or using Python:*
   ```bash
   python -m http.server 3000 --directory public
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
---

## 🛡️ Firebase Deployment

To deploy to Firebase Hosting, Cloud Firestore, and Firebase Storage:

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Deploy rules & static files:
   ```bash
   firebase deploy
   ```
