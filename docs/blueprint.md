# **App Name**: Classroom Companion

## Core Features:

- Dashboard: Display key statistics (total students, today's summary) and provide navigation.
- Add Student: Form to add new students, with email uniqueness validation and display of recently added students.
- Mark Attendance: Interface to mark attendance for each student on a given date, pre-filling existing records.
- Summary: Generate daily/monthly attendance summaries with search and export functionality.
- Data Handling: Read and write data to Firestore: add students, save attendance, retrieve attendance data for summaries. Includes email uniqueness check.
- Initial Seed: If the 'students' collection is empty, it automatically creates 3 demo students

## Style Guidelines:

- Primary color: Soft blue (#90CAF9) to evoke a sense of calmness and trust.
- Background color: Very light blue (#E3F2FD) for a clean and airy feel.
- Accent color: Light green (#A5D6A7) to highlight important actions and success states, contrasting softly with the primary.
- Body and headline font: 'PT Sans' (humanist sans-serif) for a modern and friendly appearance that is easy to read in tables and forms.
- Code font: 'Source Code Pro' for displaying snippets of code, with good legibility.
- Use minimalist icons to represent actions and categories throughout the app.
- Employ a clean, card-based layout to organize content and ensure a responsive design across devices.