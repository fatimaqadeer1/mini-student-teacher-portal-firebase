
"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile, Student, UserRole } from '@/lib/types';

interface AuthState {
    user: User | null;
    userProfile: UserProfile | null;
    studentProfile: Student | null;
    userRole: UserRole | null;
    loading: boolean;
}

export function useAuth(): AuthState {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [studentProfile, setStudentProfile] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            if (user) {
                setUser(user);
                // Fetch user profile from Firestore
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const profile = userDocSnap.data() as UserProfile;
                    setUserProfile(profile);

                    // If user is a student, fetch their detailed student profile
                    if (profile.role === 'student' && profile.studentId) {
                        const studentDocRef = doc(db, 'attendees', profile.studentId);
                        const studentDocSnap = await getDoc(studentDocRef);
                        if (studentDocSnap.exists()) {
                            setStudentProfile({ id: studentDocSnap.id, ...studentDocSnap.data() } as Student);
                        } else {
                            // Link is broken, clear student profile
                            setStudentProfile(null);
                        }
                    } else {
                        setStudentProfile(null);
                    }
                } else {
                    // User exists in Auth but not in Firestore profiles, something is wrong
                     setUserProfile(null);
                     setStudentProfile(null);
                     setUser(null);
                }
            } else {
                setUser(null);
                setUserProfile(null);
                setStudentProfile(null);
            }
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    return { user, userProfile, studentProfile, userRole: userProfile?.role || null, loading };
}
