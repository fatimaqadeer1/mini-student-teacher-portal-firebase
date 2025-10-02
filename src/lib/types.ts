
import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'teacher' | 'student';

export type UserProfile = {
    uid: string;
    email: string;
    role: UserRole;
    studentId?: string; // Corresponds to ID in 'attendees' collection
    createdAt: Timestamp;
}

export type Student = {
  id: string;
  name: string;
  email: string;
  createdAt?: Timestamp;
  restoredAt?: Timestamp;
};

export type ArchivedStudent = {
    id:string;
    originalId: string;
    name: string;
    email: string;
    createdAt?: Timestamp;
    deletedAt: Timestamp;
    restoredAt?: Timestamp;
};

export type AttendanceStatus = 'Present' | 'Absent' | 'Leave';

export const attendanceStatuses: AttendanceStatus[] = ['Present', 'Absent', 'Leave'];

export type AttendanceRecord = {
  id: string; // YYYY-MM-DD_studentId
  studentId: string;
  studentName: string;
  email: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  updatedAt: Timestamp;
};

// Represents the document stored in `attendance/{YYYY-MM-DD}`
export type AttendanceDoc = {
    date: string; // YYYY-MM-DD
    records: Record<string, AttendanceRecord>; // Keyed by studentId
    summary: {
        present: number;
        absent: number;
        leave: number;
        total: number;
    };
}

export type SummaryData = {
  studentId: string;
  studentName: string;
  email: string;
  present: number;
  absent: number;
  leave: number;
  total: number;
  attendancePercentage: number;
};

// Types for Assignments
export type AssignmentStatus = 'Assigned' | 'Submitted' | 'Graded';
export const assignmentStatuses: AssignmentStatus[] = ['Assigned', 'Submitted', 'Graded'];

export type StudentAssignmentStatus = {
    studentId: string;
    studentName: string;
    email: string;
    status: AssignmentStatus;
    grade?: string;
    note?: string;
    fileURL?: string;
    fileName?: string;
    updatedAt: any; // Allow for server timestamp
}

export type Assignment = {
    id: string;
    title: string;
    description?: string;
    dueDate: string; // YYYY-MM-DD
    resourceUrl?: string;
    createdAt: Timestamp;
    statusMap: Record<string, StudentAssignmentStatus>; // Keyed by studentId
}

export type AllowedTeacher = {
    email: string;
}

export type Submission = {
    id: string;
    assignmentId: string;
    studentId: string;
    studentEmail: string;
    fileURL: string;
    fileName: string;
    notes?: string;
    submittedAt: Timestamp;
    status: 'submitted' | 'graded';
    grade?: string;
    feedback?: string;
}
