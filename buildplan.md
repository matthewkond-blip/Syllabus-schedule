SyllabusSync — Full Application Build Plan

1. Project Overview

Build a modern, minimal web application called SyllabusSync.

The application allows university students to upload their course syllabi as PDF or DOCX files. An AI model analyzes the documents, extracts important academic deadlines and events, and allows the user to review and edit the information before adding it to Google Calendar.

This is initially a personal-use application. Do not overengineer it with unnecessary features, user management, payment systems, or complicated infrastructure.

The app should feel like a polished, lightweight productivity tool rather than a school assignment.

Primary workflow:

Upload syllabus → Extract text → AI identifies dates → Review events → Edit/select events → Add to Google Calendar.

2. Technology Stack

Frontend

React with Vite

JavaScript (not TypeScript for the initial version)

Tailwind CSS

Lucide React for icons

Native browser file upload with drag-and-drop support

React state/hooks for managing the interface

Backend

Node.js

Express.js

Multer for handling uploaded files

pdf-parse for extracting PDF text

Mammoth for extracting DOCX text

Google Gemini API for AI-powered event extraction (free tier)

Google Calendar API

Google OAuth 2.0

Zod for validating structured event data

Storage

Initially, avoid a database.

Keep the extracted events in frontend state.

Store API secrets in backend environment variables.

Store Google OAuth tokens securely on the local backend for personal use if persistence is needed.

Never store private credentials or token files in Git.

Delete uploaded temporary files immediately after processing.

If persistent course history and duplicate tracking become necessary, introduce SQLite later.

3. UI/UX Design Requirements

The visual appearance is important.

Create a clean, modern interface inspired by simple productivity dashboards.

Overall Style

White or very light gray background

Dark charcoal text

Soft gray borders

Rounded cards and buttons

Subtle shadows

Generous whitespace

Minimal iconography

Professional typography

Responsive layout

Smooth, subtle transitions

Use Tailwind CSS for styling.

Avoid:

Excessive gradients

Bright colors everywhere

Large distracting animations

Overly complicated navigation

Unnecessary dashboards or analytics

Generic enterprise software styling

Main Layout

Create a centered dashboard with a comfortable maximum width, approximately 1000–1100px.

Header

At the top of the application display:

Calendar icon

SyllabusSync logo/title

Subtitle: "Your academic calendar, simplified"

Google Calendar connection button/status on the right

Upload Section

Display a large rounded rectangular card with a dashed border.

Inside the card:

Cloud upload icon

Heading: "Upload your syllabus"

Supporting text: "Drag and drop your PDF or DOCX file here"

Browse Files button

Accepted file formats displayed underneath

Behavior:

Support dragging files into the upload area.

Allow clicking Browse Files to open the file picker.

Visually highlight the drop zone during drag-over.

Show the uploaded filename.

Restrict uploads to PDF and DOCX.

Enforce a reasonable file-size limit, initially 10 MB.

Show understandable errors for invalid files.

Processing State

After a file is selected, show processing feedback.

Example:

"Reading your syllabus..."
"Finding important dates..."
"Preparing your events..."

Use a subtle spinner or progress indicator.

Do not display fake numerical progress percentages.

Extracted Events Section

After the AI finishes processing, display a card titled:

"Extracted Events"

Also display:

Course name/code

Number of events found

Select All checkbox

Option to add an event manually

Display each event in a clean row.

Each row should contain:

Selection checkbox

Event title

Event type

Due date

Optional due time

Edit icon

Delete icon

Example:

[x] Assignment 1 — Oct 20, 2026
[x] Midterm Exam — Oct 28, 2026
[x] Assignment 2 — Nov 10, 2026
[x] Final Project — Dec 4, 2026

Use subtle category styling for assignments, quizzes, exams, and projects.

Event Editing

Clicking an event's edit icon should open a clean modal or expandable editing area.

Allow editing:

Event title

Course

Event type

Date

Time

All-day status

Optional description

Reminder settings

Events with missing or ambiguous dates must be marked "Needs Review" and must not be synced until corrected.

Calendar Sync Section

Below the event list, show a summary card.

Example:

Selected Events: 4 of 4

Primary button:

"Add to Google Calendar"

When clicked:

Check whether Google Calendar is connected.

If not connected, begin Google OAuth authorization.

Validate the selected events.

Send the selected events to the backend.

Add them to the user's chosen Google Calendar.

Show a success or error message.

Example:

"4 events successfully added to Google Calendar."

If only some succeed, show exactly which events were created and which failed.

Prevent accidentally creating duplicates when the user clicks the button repeatedly.

4. Main Application Features

Feature 1 — File Upload

Create a React component:

FileUpload.jsx

Responsibilities:

Display the drag-and-drop upload interface.

Validate file types and file sizes.

Send the uploaded file to the backend.

Display loading states.

Display validation and upload errors.

Backend endpoint:

POST /api/syllabus/upload

Expected request:
multipart/form-data containing the syllabus file.

Expected response:
Structured information about the course and its extracted events.

Feature 2 — Syllabus Text Extraction

Create a backend service:

fileParser.js

Responsibilities:

Detect whether the uploaded file is a PDF or DOCX.

Extract readable text.

Preserve useful table and section information where practical.

Handle file parsing errors.

Return the extracted text as a string.

For PDF files, use pdf-parse.

For DOCX files, use Mammoth.

Important:
Some syllabi contain scanned pages without selectable text.

For version 1, detect when meaningful text cannot be extracted and display an appropriate error. OCR can be added as a future upgrade.

Do not implement OCR initially.

Feature 3 — AI Deadline Extraction

Create a backend service:

aiExtractor.js

Use the Google Gemini API to analyze the extracted syllabus text.

The AI should identify:

Course code

Course name

Academic term

Academic year

Assignment deadlines

Quiz dates

Midterm exams

Final exams, if explicitly provided

Project deadlines

Presentations

Other important course dates

Return structured JSON rather than free-form text.

Example response:

{
"courseCode": "CP386",
"courseName": "Operating Systems",
"semester": "Fall 2026",
"events": [
{
"title": "Assignment 1 Due",
"type": "assignment",
"date": "2026-10-20",
"time": "23:59",
"allDay": false,
"description": "Assignment 1 submission deadline",
"needsReview": false
}
]
}

Use structured outputs and Zod schema validation.

AI Extraction Rules

The model must:

Never invent missing dates.

Never invent missing due times.

Preserve the actual academic year.

Identify and flag ambiguous dates.

Interpret semester context carefully.

Extract events from tables as well as paragraphs.

Avoid producing duplicate events.

Identify event types correctly.

Return null for unknown dates or times.

Flag dates requiring user review.

For missing times, default to an all-day calendar event, not an arbitrary midnight deadline.

The AI should also provide an optional short source excerpt for each extracted event so users can verify the information against the original syllabus.

Feature 4 — Event Review

Create components:

EventPreview.jsx

EventRow.jsx

EventEditor.jsx

Use React state to manage extracted events.

Required operations:

Select one event

Select all valid events

Deselect events

Edit event information

Delete events

Add events manually

Identify events that need review

Display the number of selected events

Validate changes before they are accepted.

Feature 5 — Google Calendar Integration

Create a backend service:

googleCalendar.js

Implement Google OAuth 2.0 authorization.

Use the minimum Google Calendar permissions necessary to create events.

Required functionality:

Connect Google account

Display connection status

Select a writable calendar where available

Create approved calendar events

Set event titles and descriptions

Apply correct local dates and times

Support all-day events

Configure reminders

Return created event identifiers

Handle expired authorization

Handle API errors gracefully

Use the America/Toronto time zone as the initial default, but make the time zone configurable.

Important:
Use the Google Calendar API from the backend, not the frontend.

Never expose Google API credentials or refresh tokens to the browser.

Feature 6 — Duplicate Prevention

The application must prevent duplicate event creation.

At minimum:

Disable repeated submissions while a sync operation is running.

Track event IDs returned by Google Calendar.

Mark successfully synced events in the interface.

Do not resend successfully synced events unnecessarily.

Use idempotent processing for sync requests where practical.

For version 1, a small local SQLite database may be introduced if needed to persist sync history across browser refreshes.

Do not add complex database infrastructure.

5. Folder Structure

Use the following structure as a starting point:

syllabus-sync/
frontend/
src/
components/
Header.jsx
FileUpload.jsx
EventPreview.jsx
EventRow.jsx
EventEditor.jsx
SyncSummary.jsx
LoadingState.jsx
services/
api.js
App.jsx
main.jsx
index.css
package.json

backend/
routes/
syllabusRoutes.js
calendarRoutes.js
authRoutes.js
services/
fileParser.js
aiExtractor.js
googleCalendar.js
middleware/
uploadMiddleware.js
errorHandler.js
schemas/
eventSchema.js
server.js
package.json
.env.example

.gitignore
README.md

Files may be reorganized when there is a clear technical reason.

6. Development Phases

Build the project in stages.

Phase 1 — Project Initialization

Tasks:

Initialize React with Vite.

Set up Tailwind CSS.

Install Lucide React.

Create Express backend.

Configure CORS for local development.

Create environment variable templates.

Create a health-check endpoint.

Set up project folder structure.

Acceptance criteria:

Frontend starts successfully.

Backend starts successfully.

Frontend can communicate with the backend.

No console errors.

Phase 2 — Build the Complete UI with Mock Data

Important: Build the visual frontend before introducing AI or Google APIs.

Tasks:

Create the main dashboard.

Build the header.

Create the upload drop zone.

Create event list components.

Add editable event forms.

Add selection checkboxes.

Create the calendar sync summary.

Create loading and error states.

Add responsive styling.

Use mocked events for testing.

Acceptance criteria:

UI resembles the requested minimal productivity dashboard.

Upload area supports file selection.

Checkboxes work.

Editing works.

Deleting works.

Selected-event count updates correctly.

Layout works on desktop and mobile.

Do not continue until the interface is visually polished and functional.

Phase 3 — File Upload and Parsing

Tasks:

Implement Multer.

Build the upload endpoint.

Implement PDF extraction.

Implement DOCX extraction.

Handle unsupported or damaged files.

Connect the frontend upload component to the backend.

Acceptance criteria:

Upload a real syllabus.

Backend extracts readable text.

Errors are handled correctly.

Temporary uploads are deleted.

Phase 4 — Google Gemini Integration

Tasks:

Connect Google Gemini API.

Write a reliable extraction prompt.

Define structured event output.

Validate model responses.

Convert extracted data into frontend event objects.

Flag incomplete or ambiguous events.

Acceptance criteria:

Upload a real syllabus.

Extract its assignment and exam dates.

Display extracted events in the interface.

Allow users to edit any incorrect information.

Do not invent missing dates.

Phase 5 — Google Calendar Integration

Tasks:

Set up Google Cloud credentials.

Enable Google Calendar API.

Configure OAuth consent and redirect URLs.

Implement OAuth connection flow.

Implement calendar selection.

Create calendar events.

Store event IDs.

Handle authorization failures.

Implement duplicate protection.

Acceptance criteria:

User can connect Google Calendar.

User can select events.

Clicking Add to Google Calendar creates those events.

Events appear with the correct dates.

Missing dates cannot be synced.

Repeated clicks do not create duplicate events.

Phase 6 — Testing and Cleanup

Test the application against:

PDF syllabi

DOCX syllabi

Syllabi containing tables

Syllabi with missing deadline dates

Syllabi with dates but no times

Multiple events on the same day

Syllabi containing different years

Invalid file uploads

Google Gemini API errors

Google OAuth failures

Calendar event creation failures

Repeated calendar sync attempts

Improve the user experience wherever necessary.

7. Future Features — Do Not Build Initially

Potential future improvements:

Upload multiple syllabi simultaneously

Course dashboard showing all uploaded classes

Persistent course history

Automatic duplicate detection across uploads

Support for revised syllabi

Lecture and lab scheduling

Weekly recurring events

Outlook calendar integration

Apple Calendar compatibility through ICS files

Automatic scheduling of study sessions

Semester overview calendar

Dark mode

OCR support for scanned PDFs

Do not implement these until the core application works.

8. Security and Reliability

Follow these rules:

Keep Gemini keys server-side.

Never commit .env files.

Protect Google OAuth tokens.

Validate uploaded file types and sizes.

Validate AI-generated data before using it.

Require explicit user approval before calendar sync.

Request only necessary Google permissions.

Avoid storing syllabus contents permanently.

Do not log sensitive tokens or complete syllabus contents.

Add reasonable error handling around all external API calls.

9. How Claude Should Work

Follow an incremental development approach.

Do not generate a large, untested application in one step.

For each phase:

Explain the files being created.

Implement the functionality.

Run available checks or tests.

Fix any errors.

Summarize what was completed.

Explain how I can test it locally.

Prioritize simplicity and maintainability.

Use straightforward JavaScript and React patterns rather than unnecessary abstractions.

If credentials or cloud configuration are required, explain exactly what I need to configure.

When implementation is finished, provide:

Installation instructions

Environment variable setup

Instructions for starting the frontend and backend

Google Cloud setup instructions

Testing instructions

README documentation

10. Initial Instruction

Begin with Phase 1 and Phase 2.

Set up the project and build the complete frontend using mock data.

Focus on reproducing the dashboard design:

Minimal header

Large drag-and-drop upload area

Event preview card

Checkboxes

Edit controls

Selected-event summary

Prominent Google Calendar sync button

The interface should feel modern, clean, responsive, and visually polished.

Do not integrate Google Gemini or Google Calendar until the frontend is complete and tested.1