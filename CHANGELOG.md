# Changelog

All notable changes to the Trinity Family School Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [6.5] - 2026-10-24

### Improvements

- Android school apps: added signed Trinity Live and Trinity Ganda downloads, in-app updates, native push notifications, app shortcuts, and secure offline access.
- iPhone Home Screen app: added installation support and secure access to prepared offline school data.
- App Settings: brought appearance, profile, account, security, live tracking, push notifications, lesson reminders, widgets, storage, and app details into searchable section tabs with compact controls.
- Appearance: unified light and dark themes, colour presets, shared glass headers, search bars, and navigation; added optional Android Material You colours.
- Live tracking: added direct controls for the timetable notification, visible timetables, lesson progress, event cards, and event reminder alerts.
- Lesson reminders: added timetable, class, subject, teacher, and period filters, reminder previews, selected days, quiet hours, sound, vibration, and snooze controls in App Settings.
- Home widgets: added individual widget settings for tracked lessons and subjects, visible cards, progress, events, and card order.
- App sharing: added a public download page that needs no sign-in, a desktop QR code, and version information and a sharing QR code inside the installed app.
- Timetables: added consolidated and separate stream layouts with day and lesson overrides, selectable live cards, class selection for printing, and narrower class columns in day and week views.
- Calendar and events: redesigned term and year planning, added audience reminders and dashboard briefings, and grouped batch exams into one calendar event with class details.
- Exams: improved report access, grading defaults for future assessment sets, individual grading overrides, snapshot editing, blank assessment printing, and management controls.
- Reports and documents: added selectable school reports and consistent, compact layouts for collection reports, lists, previews, printouts, and PDF downloads.
- Pupil photos: improved camera capture, JPEG portrait processing, face-guided framing, manual cropping, enhancement previews, and consistent photo treatment across documents.
- Photo Studio: added PDF artwork, layer groups, selections, feather controls, local editing, and a persistent workspace.
- Pupils and staff: standardised pupil name display and search, improved sibling navigation and daily history groups, and expanded staff profiles, teaching assignments, and term-based MOFUS.
- Fees and SchoolPay: improved term allocation and excess-payment transfers, added fee promises and custom reminders, and made pupil fee Notes optional.
- Bulk SMS: added personalised fields and conditional message sections, with fee totals that follow the selected pupil filters.

### Bug Fixes

- Stopped username fields from forcing capital letters; usernames retain the typed case and accept numbers.
- Fixed iPhone PDF compatibility errors and reduced memory pressure when pinching an open PDF.
- Kept minimised PDF previews, sidebars, top bars, glass headers, and bottom navigation anchored correctly on iPhone; corrected the persistent bottom gap in the Home Screen app.
- Improved iPhone camera capture quality before photos reach the crop editor.
- Fixed App Settings links that restarted the app, restored storage information, and showed account and biometric controls directly in their sections.
- Fixed Android timetable and widget refresh after sleep, missed alarms, frozen countdowns, and shortcut session recovery.
- Improved PDF saving on Android: documents download only when requested, use consistent filenames, and keep preview and printed output aligned.
- Fixed stale class-stream labels, preserved streamed lesson details, and corrected clipped timetable PDF labels and merged cells.
- Fixed exam editing locks, grading inheritance, class navigation, and report layout issues.
- Corrected previous-balance binding, legacy academic dates in fee Notes, uniform refresh loops, and filtered fee totals; improved payment-draft recovery.
- Fixed saved-session startup and offline route recovery, reduced repeated cache resets, and removed misleading background-sync warnings.

### Updates

- Added Circumference access limits for staff by class, section, and gender, with matching restrictions on school data and prepared offline content.
- Improved cache-first loading, change-driven data refresh, and first-time workspace setup progress to reduce repeated reads and unnecessary downloads.
- Enabled browser page pinch zoom on touchscreens and desktop touchpads while retaining the installed Android app gesture support.
- Kept Android-only settings hidden in browsers and on iPhone; device settings remain editable offline while school-record changes still require a connection.
- Updated the shared web experience to version 6.5. The Android packages retain their separate version numbering, with version 1.33 providing the integrated native settings.

## [Unreleased] - 2025-01-XX

### Added

#### Staff-Pupil Assignment (Mofus) Feature
- **New Mofus Page** (`/staff/mofus`): Centralized page for managing staff-pupil assignments and fees holidays
  - Displays all teaching staff with their assigned pupils
  - Clickable staff and pupil names linking to their respective detail pages
  - Integrated fees holiday management for assigned pupils
  - Single-page interface for all staff-pupil relationship management

- **Staff-Pupil Relationships**:
  - Added `assignedStaffId` field to `Pupil` interface
  - Staff members can now be assigned to pupils as "relatives"
  - Pupil detail page shows "Staff Relative" section when assigned
  - Staff detail page shows "Pupil Relatives" section with assigned pupils
  - Both sections only display when active relationships exist

#### Fees Holiday Feature
- **Fees Holiday System**: Comprehensive discount system for staff privilege
  - Create fees holidays with default reason "staff privilege"
  - Support for multiple fee categories (Required Fees, Non-Required Fees, or both)
  - Multiple discount types: Full (100%), Half (50%), Quarter (25%), or Custom Percentage
  - Active fees holidays apply continuously until disabled
  - Fees holidays do not affect historical payments
  - Visual indication on fees collection page with staff member information

- **Fees Holiday Display**:
  - Custom message format: "This fee has been halted as part of staff privilege to Mr/Mrs [Staff Name]"
  - Shows applied fee information without discount amount, category, or term details
  - Staff member name and gender-based title (Mr/Mrs) displayed
  - Clickable staff names linking to staff detail pages

- **Fees Holiday Integration**:
  - Integrated into individual pupil fees collection page
  - Integrated into family fees summary page
  - Applied to previous term balance calculations (prevents cleared fees from carrying forward)
  - Proper handling in fee processing logic

#### Family Fees Summary Page Enhancements
- **View Modes**: Added Summary/Detail toggle
  - Summary mode: Fee breakdowns collapsed by default
  - Detail mode: All fee breakdowns expanded automatically
  - Individual expand/collapse buttons on each pupil card work independently

- **Compact Card Design**:
  - Pupil cards use class code instead of class name
  - PIN displayed inline with class and section (removed "PIN:" label)
  - Format: `{classCode} | {section} | {admissionNumber}`
  - Clickable pupil names linking to pupil detail pages

- **Family Summary Card**:
  - Glossy rounded card showing Total Amount, Total Paid, and Total Balance
  - Gradient background with backdrop blur effect
  - Replaced text-based family balance display
  - Hidden family ID for cleaner interface

- **Modernized UI**:
  - All buttons redesigned with distinct colors and enhanced glossy effects
  - Back button: Sky-blue gradient
  - Year & Term selector: Purple-indigo gradient with modernized dropdowns
  - View toggle buttons: Amber-orange gradient when active
  - Pay button: Emerald-green gradient with "Pay" label
  - Print button: Rose-pink gradient
  - Expand/Collapse buttons: Violet-purple gradient
  - Enhanced shadows, backdrop blur, and shine effects on all buttons
  - Removed scrolling from fee breakdown sections

### Changed

#### Fees Holiday Service
- Updated `FeesHoliday` type to support multiple categories (array instead of single value)
- Modified `createFeesHoliday` and `updateFeesHoliday` to handle category arrays
- Added data cleaning to prevent `undefined` values in Firebase
- Removed reason input field (defaults to "staff privilege")
- Updated fee processing to correctly apply fees holidays based on category matching

#### Fee Processing Logic
- Enhanced `processPupilFees` to accept and apply fees holidays
- Updated `calculatePreviousTermBalances` to account for fees holidays in carry-forward calculations
- Fees cleared by staff privilege no longer appear in previous term balances
- Proper handling of fees holiday discounts in fee calculations

#### Staff Page
- Moved "Mofus" button from individual staff dropdowns to main page header
- Button positioned next to "Add New Staff" button
- Removed individual "Mofus" options from staff member cards

#### Pupil Detail Page
- Added "Staff Relative" section (conditional display)
- Shows assigned staff member information with clickable link
- Displays staff photo, name, employee ID, role, email, phone, and department
- Positioned after personal information section

#### Staff Detail Page
- Added "Pupil Relatives" section (conditional display)
- Shows all pupils assigned to the staff member
- Displays pupil names (clickable), admission numbers, classes, and status
- Collapsible section with expand/collapse functionality

### Fixed

#### Fees Holiday Issues
- Fixed HTML validation error (removed `<div>` inside `<p>` tag)
- Fixed Firebase error for `undefined` `discountValue` field
- Implemented proper data cleaning before Firebase writes
- Fixed duplicate import of `useActiveFeesHolidaysByPupil` hook
- Resolved fees holiday query index requirement by removing `orderBy` and sorting in memory

#### Previous Term Balance Calculation
- Fixed issue where fees cleared by staff privilege were still appearing in carry-forward balances
- Fees holidays now properly applied when calculating previous term balances
- Ensures accurate balance calculations for all terms

#### Family Fees Summary
- Fixed missing fees holiday detection on family fees page
- Added fees holiday fetching and passing to fee processing functions
- Ensured consistent fee calculations between individual and family views

### Technical Improvements

#### Code Quality
- Added proper TypeScript types for fees holiday features
- Improved error handling in fees holiday service
- Enhanced data validation before Firebase operations
- Better separation of concerns in fee processing logic

#### Performance
- Optimized fees holiday queries (removed unnecessary index requirement)
- Improved fee calculation performance with proper caching
- Enhanced family fees page data fetching

#### UI/UX Enhancements
- Modernized button designs with distinct color schemes
- Enhanced visual feedback with glossy effects and animations
- Improved information density with compact card layouts
- Better navigation with clickable names throughout the system

---

## Previous Updates

*Note: Previous changelog entries would be documented here as the project evolves.*

---

**Last Updated**: January 2025
**Version**: Development








