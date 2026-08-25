# LinkCloud - Social Messaging Groups & Channels Directory

LinkCloud is a full-featured, secure, fast, and accessible platform built for discovering, submitting, managing, and moderating public social messaging groups and channels across India and globally.

Supported Platforms:
- **WhatsApp Groups & Channels**
- **Telegram Groups & Channels**
- **Discord Servers**
- **Facebook Groups**
- **Instagram Broadcast Channels**
- **X (Twitter) Communities**
- **LinkedIn Groups**
- **YouTube Channels**
- **Reddit Communities**

---

## Key Features

1. **User Authentication (Firebase Auth)**:
   - Email & Password with Email Verification
   - Google One-Tap & Popup OAuth Sign-In
   - Indian Mobile Number SMS OTP Authentication
   - Password Reset & Remember Me capabilities

2. **Group Submission & Moderation**:
   - Multi-step validation (duplicate name check, invite link format check, description character limits 500 max)
   - Category, Location (State/District/City), Language, Content Type, and Minimum Age tagging
   - Group logo/banner uploads via Cloudinary with automatic WebP compression & responsive URL optimization
   - Pending, Approved, and Rejected states with Webmaster review & change requests

3. **Webmaster / Single Admin Control (`linkcloud111@gmail.com`)**:
   - Executive Dashboard with Realtime Metrics
   - Full Group Approval / Rejection Workflow with feedback messages
   - Category, Location, Language, Content Type, and Platform Management
   - User Management (Suspension, Role management, Account Deletion requests)
   - Report & Complaint Triage
   - Maintenance Mode & Global Site Settings

4. **Search, Filter & SEO Engine**:
   - Instant Search with debounce & filter suggestions
   - Realtime Multi-Filter (Platform, Category, Location, Language, Content Type, Age)
   - Pagination & Infinite Scroll support
   - Dynamic Open Graph Meta Tags & Canonical URLs
   - Auto-generated `robots.txt` and `sitemap.xml`

5. **Security & Quality Assurance**:
   - Production-ready Firestore Security Rules
   - Rate limiting & anti-spam cooldowns on submissions, reports, and complaints
   - Input sanitization (whitespace trimming, XSS protection, control character removal)
   - Full Dark / Light Mode with Material Design 3 and WCAG AA Accessibility standards

---

## Technical Architecture

- **Frontend Framework**: React 18 with TypeScript & Vite
- **Styling**: Tailwind CSS with custom MD3 color variables
- **Database**: Google Cloud Firestore (Firebase)
- **Authentication**: Firebase Authentication
- **Media Storage & CDN**: Cloudinary with Firebase Storage fallback
- **Icons**: Lucide React
- **Routing**: React Router DOM v6

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- Firebase Project with Firestore & Authentication enabled
- Cloudinary Account for optimized image uploads

### 2. Environment Variables Setup
Create a `.env` file in the root directory based on `.env.example`:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456

VITE_CLOUDINARY_CLOUD_NAME=linkcloud
VITE_CLOUDINARY_UPLOAD_PRESET=linkcloud_preset
```

### 3. Installation & Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

---

## Firebase Setup Guide

1. Create a Firebase project at [https://console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore Database** in Production mode.
3. Deploy the provided `firestore.rules` file to your Firebase console or using Firebase CLI:
   ```bash
   firebase deploy --only firestore:rules
   ```
4. Enable the following **Authentication Providers** in Firebase Console -> Authentication -> Sign-in method:
   - Email/Password
   - Google
   - Phone (SMS OTP)
5. Set `linkcloud111@gmail.com` as the Webmaster / Admin email. Users signing in with this email are automatically granted Webmaster privileges.

---

## Cloudinary Setup Guide

1. Sign up for a free Cloudinary account at [https://cloudinary.com](https://cloudinary.com).
2. Go to **Settings -> Upload -> Upload Presets**.
3. Click **Add Upload Preset**, set the mode to **Unsigned**, and set the name to `linkcloud_preset`.
4. Copy your **Cloud Name** and update `VITE_CLOUDINARY_CLOUD_NAME` in your environment variables.

---

## Deployment Guide

### Option A: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Select 'dist' as your public directory and configure as single-page app (SPA)
firebase deploy --only hosting
```

### Option B: Vercel / Netlify / Cloud Run
- Connect your GitHub repository to Vercel or Netlify.
- Set Build Command: `npm run build`
- Set Output Directory: `dist`
- Configure all environment variables in project settings.

---

## License & Support

© 2026 LinkCloud. All rights reserved.
For support and webmaster inquiries, contact `linkcloud111@gmail.com`.
