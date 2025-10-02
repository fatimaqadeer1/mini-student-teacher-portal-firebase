
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Assignment, AttendanceDoc } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileClock, CalendarDays, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function StudentPage() {
    const router = useRouter();
    const { user, studentProfile, loading } = useAuth();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [lastAttendance, setLastAttendance] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!loading && studentProfile) {
            const fetchData = async () => {
                setLoadingData(true);
                
                // Fetch next due assignments
                const assignmentsQuery = query(
                    collection(db, "assignments"),
                    where(`statusMap.${studentProfile.id}.status`, "in", ["Assigned", "Submitted"]),
                    limit(3)
                );
                const assignmentsSnapshot = await getDocs(assignmentsQuery);
                const nextAssignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment));
                setAssignments(nextAssignments);

                // Fetch last attendance
                const attendanceQuery = query(collection(db, "attendance"), orderBy('date', 'desc'), limit(1));
                const attendanceSnapshot = await getDocs(attendanceQuery);
                if (!attendanceSnapshot.empty) {
                    const doc = attendanceSnapshot.docs[0];
                    const data = doc.data() as AttendanceDoc;
                    if (data.records && data.records[studentProfile.id]) {
                        setLastAttendance({
                            date: data.date,
                            status: data.records[studentProfile.id].status,
                        });
                    }
                }
                setLoadingData(false);
            };
            fetchData();
        }
    }, [user, studentProfile, loading]);

    if (loading || loadingData || !studentProfile) {
        return (
            <div className="flex flex-col gap-8">
                 <Skeleton className="h-10 w-1/2" />
                 <div className="grid gap-6 md:grid-cols-3">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                 </div>
            </div>
        );
    }

    return (
       <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Student Portal</h1>
                <p className="text-muted-foreground">Welcome, {studentProfile.name || user?.email}!</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="shadow-md rounded-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                           <FileClock className="text-primary" /> Next Due Assignments
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {assignments.length > 0 ? assignments.map(a => (
                            <div key={a.id} className="text-sm">
                                <p className="font-medium">{a.title}</p>
                                <p className="text-muted-foreground">Due: {format(new Date(a.dueDate), 'PPP')}</p>
                            </div>
                        )) : (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                               <CheckCircle /> No pending assignments. Great job!
                            </div>
                        )}
                         <Button variant="link" size="sm" className="p-0" onClick={() => router.push('/student/assignments')}>View All</Button>
                    </CardContent>
                </Card>
                 <Card className="shadow-md rounded-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                           <CalendarDays className="text-secondary" /> Last Attendance
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                       {lastAttendance ? (
                            <div>
                                <p className="text-2xl font-bold">{lastAttendance.status}</p>
                                <p className="text-muted-foreground">on {format(new Date(lastAttendance.date), 'PPP')}</p>
                            </div>
                       ) : (
                           <p className="text-muted-foreground text-sm">No attendance records found yet.</p>
                       )}
                       <Button variant="link" size="sm" className="p-0 mt-2" onClick={() => router.push('/student/attendance')}>View History</Button>
                    </CardContent>
                </Card>
            </div>
       </div>
    )
}
