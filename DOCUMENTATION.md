# Bareeq Installer Rewards Program - Technical Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication System](#authentication-system)
4. [Badge System](#badge-system)
5. [QR Code Scanning](#qr-code-scanning)
6. [Transaction System](#transaction-system)
7. [Version Management](#version-management)
8. [Frontend Components](#frontend-components)
9. [API Endpoints](#api-endpoints)
10. [Database Schema](#database-schema)

## Overview

The Bareeq Installer Rewards Program is a sophisticated mobile-first web application designed for managing an installer rewards program in both Arabic and English. The application focuses on accurate points tracking and user engagement through innovative UI/UX design.

### Key Features

- Mobile-responsive bilingual interface (Arabic/English)
- Secure authentication via WhatsApp and SMS
- QR code scanning for product verification and installation tracking
- Badge/achievement system for user engagement
- Points tracking and transaction history
- Admin dashboard for user management and system configuration
- Semantic versioning system for tracking application changes

## Architecture

The application follows a modern full-stack JavaScript architecture:

- **Frontend**: React with TypeScript, styled with Tailwind CSS
- **Backend**: Express.js server
- **Database**: PostgreSQL with Drizzle ORM
- **API**: RESTful API design with proper authentication and validation
- **Authentication**: Session-based authentication with SMS/WhatsApp verification
- **Scanning**: Scandit SDK for advanced QR code scanning capabilities

## Authentication System

### Authentication Methods

1. **SMS-based Authentication**
   - Users receive a one-time password via SMS
   - OTP validated server-side with proper expiration handling
   - Secure session creation upon successful validation

2. **WhatsApp Authentication (via Wasage)**
   - Integration with Wasage service for WhatsApp-based authentication
   - Callback-based flow for secure authentication

### Session Management

- Secure HTTP-only cookies with proper SameSite and Secure attributes
- Session timeout and automatic renewal
- Enhanced logout functionality to ensure proper session termination
- User session tracking with device and location information
- Session revocation capability for security purposes

## Badge System

The badge system rewards users based on their achievements in the app, primarily through installation counts and points earned.

### Badge Qualification Principles

1. Badges are based on lifetime achievements (total installations and points)
2. Once earned, badges remain unless requirements change
3. Badge qualifications are recalculated on login and after QR scans
4. Badge requirements can be adjusted by administrators

### Badge Calculation Process

```
calculateUserBadgeQualifications(userId: number, forceUpdate = false)
```

This central function determines which badges a user qualifies for by:
1. Fetching active badges from the database
2. Retrieving user's transaction history
3. Calculating total installations and points balance
4. Checking each badge's requirements against user's stats
5. Updating user's badge_ids in the database when changes are detected

### Badge Display

- Circular progress indicators show completion percentage
- Tooltips display detailed progress on both points and installation requirements
- Badges are prominently displayed on the dashboard for user engagement

## QR Code Scanning

### Scanning Methods

1. **Standard QR Code Scanning**
   - HTML5-based QR code scanning for basic compatibility
   - Validation of Bareeq-specific QR code format

2. **Advanced Scanning with Scandit**
   - High-performance barcode scanning
   - OCR capabilities for text recognition
   - ID scanning for document verification

### QR Code Validation Process

1. URL format validation (warranty.bareeq.lighting and w.bareeq.lighting)
2. UUID extraction and validation
3. Server-side verification to check if product exists and hasn't been scanned before
4. Points awarding upon successful verification
5. Transaction recording for points history
6. Badge recalculation triggered after successful scan

## Transaction System

Transactions are the core data structure for tracking user points and activities.

### Transaction Types

1. **Earning** - Points earned from product installations
2. **Redemption** - Points redeemed for rewards

### Points Calculation

- Points balance = Sum of earning transactions - Sum of redemption transactions
- Installation count = Number of earning transactions with product descriptions
- All calculations are case-insensitive to prevent discrepancies

### Transaction Display

- Chronological listing with filtering options
- Month/year grouping for better readability
- Visual indicators for transaction types

## Version Management

The application implements semantic versioning to track changes across updates.

### Version Components

- **Major**: Significant changes that may affect compatibility
- **Minor**: New features with backward compatibility
- **Patch**: Bug fixes and small improvements

### Version Update Process

1. Version incremented via scripts during deployment
2. Version displayed consistently across application layouts
3. Version history tracked for support and debugging

## Frontend Components

### Key Components

1. **Layouts**
   - `InstallerLayout`: Main layout for installer-facing pages
   - `AdminLayout`: Layout for admin dashboard with navigation

2. **Authentication**
   - `LoginPage`: SMS and WhatsApp authentication options
   - `OtpVerificationPage`: OTP entry and validation

3. **Dashboard**
   - `InstallerDashboard`: Main user dashboard with stats and badges
   - `AdminDashboard`: System administration and monitoring

4. **Scanning**
   - `ScanPage`: Simple QR scanning interface
   - `AdvancedScanPage`: Enhanced scanning with Scandit integration

5. **Profile**
   - `InstallerProfile`: User profile and account information
   - `BadgeDisplay`: Visual representation of earned achievements

6. **Shared Components**
   - `AchievementCard`: Displays badge with progress indicator
   - `VersionDisplay`: Shows current application version

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/request-otp`: Request SMS verification code
- `POST /api/auth/verify-otp`: Verify OTP and create session
- `POST /api/auth/wasage/otp`: Initiate WhatsApp authentication
- `GET /api/auth/wasage/status`: Check WhatsApp auth status
- `GET /api/auth/sessions`: List user's active sessions
- `DELETE /api/auth/sessions/:sessionId`: Revoke specific session
- `POST /api/logout`: End current user session

### User Endpoints

- `GET /api/users/me`: Get current user information
- `GET /api/admin/users`: List all users (admin only)
- `POST /api/admin/users`: Create new user (admin only)
- `PATCH /api/admin/users/:userId`: Update user (admin only)
- `DELETE /api/admin/users/:userId`: Delete user (admin only)

### Scanning Endpoints

- `POST /api/scan-qr`: Validate QR code and award points
- `GET /api/scanned-products`: List user's scanned products

### Badge Endpoints

- `GET /api/badges`: Get all badges or user's badges
- `POST /api/admin/badges`: Create new badge (admin only)
- `PATCH /api/admin/badges/:id`: Update badge (admin only)
- `DELETE /api/admin/badges/:id`: Delete badge (admin only)
- `POST /api/admin/recalculate-badges`: Recalculate all users' badges
- `POST /api/admin/recalculate-user-badges/:userId`: Recalculate specific user's badges

### Transaction Endpoints

- `GET /api/transactions`: Get user's transaction history
- `GET /api/admin/transactions`: Get all transactions (admin only)
- `POST /api/admin/points`: Add/remove points manually (admin only)

## Database Schema

### Main Tables

1. **users**
   - Primary user information and authentication details
   - Stores badge_ids as a JSON array or string of numbers

2. **transactions**
   - Records all point earning and redemption activities
   - Links to users via userId foreign key

3. **badges**
   - Defines achievement badges with requirements
   - Stores requiredPoints and minInstallations for qualification

4. **products**
   - Product catalog information
   - Used for verification during QR scanning

5. **scanned_codes**
   - Records of previously scanned QR codes
   - Prevents duplicate scanning

6. **sessions**
   - User session information for authentication
   - Includes device and IP data for security

### Key Relationships

- User 1:N Transactions
- User N:M Badges (via badge_ids array in User table)
- User 1:N ScannedCodes
- User 1:N Sessions