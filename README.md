# Client Lead Management System (Mini CRM)

An elegant, high-fidelity, and fully responsive Client Lead Management System (Mini CRM) designed for digital agencies, freelancers, and startups. This system contains a public business landing page with a proposal contact form, a secure JWT-authorized admin login portal, and a glassmorphism admin dashboard complete with interactive data charts, search/filters, and a chronological follow-up notes timeline.

---

## ✨ Features

- 🌐 **Creative Agency Landing Page**: Beautiful dark-themed homepage representing "Apex Digital Agency" with clean CSS styling and micro-interaction animations.
- 📝 **Asynchronous Lead Submission**: An interactive contact form that submits leads to the backend database instantly without page reloads, accompanied by custom CSS Toast notifications.
- 🔒 **Secure Authorization**: Token-based security using JSON Web Tokens (JWT) and BCrypt password hashing.
- 📊 **Visual Analytics**: Interactive data charts using Chart.js including:
  - Lead Acquisition Trend (Line Chart) over the last 7 days.
  - Lead Status Breakdown (Doughnut Chart).
  - Lead Sources Distribution (Horizontal Bar Chart).
- 🎛️ **Pipeline Management**: Searchable and filterable table displaying leads by name, email, company, status, and lead source.
- 📋 **Slide-Over Detail Drawer**: A professional detail view panel showing full details of a lead, its message, and its actions.
- 💬 **Activity Timeline**: Time-stamped system logs and custom admin follow-up notes showing the complete client-relationship history.
- 💾 **Self-Contained Database**: Zero-setup local SQLite database integration, allowing instant out-of-the-box operation.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom design systems & glassmorphism), Vanilla JavaScript, Chart.js, FontAwesome.
- **Backend**: Node.js, Express.js, JSON Web Tokens (`jsonwebtoken`), BCryptJS (`bcryptjs`), CORS.
- **Database**: SQLite3.
---
> 🌐 **Live Demo:** [https://future-fs-02-h6oq.onrender.com/](https://future-fs-02-h6oq.onrender.com/)
---

## 📁 Repository Structure

```
CRM PROJECT/
├── public/                 # Static Frontend Files
│   ├── css/
│   │   ├── style.css       # Landing Page Styles
│   │   ├── login.css       # Admin Login Styles
│   │   └── dashboard.css   # Admin Dashboard Styles
│   ├── js/
│   │   ├── main.js         # Landing Page AJAX Logic
│   │   ├── login.js        # Auth Logic & Tokens
│   │   └── dashboard.js    # Table Filters, Modals & Chart.js
│   ├── index.html          # Public Landing Page & Contact Form
│   ├── login.html          # Secure Admin Login Screen
│   └── dashboard.html      # CRM Admin Dashboard
├── database.js             # SQLite Connection & Table Seeding
├── server.js               # Express Server & REST API Routes
├── test.js                 # API Integration Test Script
├── package.json            # Node Metadata & Dependency Specifications
└── README.md               # Setup and Features Documentation
```

---

## 🚀 Setup & Installation Instructions

Follow these simple steps to run the CRM locally:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18.0.0 or higher recommended).

### 1. Install Dependencies
In your terminal, navigate to the project directory and run:
```bash
npm install
```

### 2. Start the Server
Start the Express server:
```bash
npm start
```
*For development with hot-reloading:*
```bash
npm run dev
```

### 3. Open in Browser
- **Public Proposal Form**: Navigate to [http://localhost:3000/](http://localhost:3000/)
- **Admin Dashboard Portal**: Navigate to [http://localhost:3000/login.html](http://localhost:3000/login.html)

### 4. Admin Credentials
Log in with the seeded administrative credentials:
- **Username**: `admin`
- **Password**: `admin123`

### 5. Run Automated Tests
Verify that all backend endpoints and queries work correctly:
```bash
npm test
```
