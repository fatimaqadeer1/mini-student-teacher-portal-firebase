"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { AttendanceRecord, AttendanceDoc, AttendanceStatus } from "@/lib/types";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = {
  Present: '#10B981', // green
  Absent: '#EF4444', // red
  Leave: '#F59E0B' // amber
};

export default function StudentAttendancePage() {
    const { studentProfile, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStudentAttendance = useCallback(async () => {
      if (!studentProfile) return;
      setLoading(true);
      try {
        const attendanceCol = collection(db, "attendance");
        const querySnapshot = await getDocs(attendanceCol);
        const records: AttendanceRecord[] = [];
        querySnapshot.forEach(doc => {
            const dayData = doc.data() as AttendanceDoc;
            if (dayData.records && dayData.records[studentProfile.id]) {
                records.push({
                    ...dayData.records[studentProfile.id],
                    date: doc.id, // The doc ID is the date string
                });
            }
        });
        setAllRecords(records.sort((a,b) => b.date.localeCompare(a.date)));
      } catch (error) {
        console.error("Error fetching student attendance:", error);
        toast({ title: "Error", description: "Could not load your attendance.", variant: "destructive"});
      }
      setLoading(false);
  }, [studentProfile, toast]);

  useEffect(() => {
      if (!authLoading && studentProfile) {
          fetchStudentAttendance();
      }
  }, [authLoading, studentProfile, fetchStudentAttendance]);

  const monthlySummary = useMemo(() => {
    const currentMonthRecords = allRecords.filter(rec => isWithinInterval(new Date(rec.date), {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date())
    }));
    
    const summary = { Present: 0, Absent: 0, Leave: 0 };
    currentMonthRecords.forEach(rec => {
        summary[rec.status]++;
    });

    const chartData = Object.entries(summary).map(([name, value]) => ({
        name,
        value,
        color: COLORS[name as AttendanceStatus]
    }));

    return { summary, chartData };
  }, [allRecords]);


  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case "Present": return "secondary";
      case "Absent": return "destructive";
      case "Leave": return "accent";
      default: return "default";
    }
  }

  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">My Attendance</h1>
            <p className="text-muted-foreground">A log of your attendance records.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
             <Card className="md:col-span-1">
                <CardHeader><CardTitle>This Month's Summary</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <Skeleton className="h-32 w-full" /> : 
                    monthlySummary.chartData.reduce((sum, d) => sum + d.value, 0) > 0 ? (
                        <div className="flex items-center justify-center">
                            <ResponsiveContainer width={150} height={150}>
                                <PieChart>
                                    <Pie data={monthlySummary.chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5}>
                                        {monthlySummary.chartData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center h-32 flex items-center justify-center">No records for this month.</p>
                    )}
                </CardContent>
             </Card>
             <Card className="md:col-span-2">
                <CardHeader><CardTitle>Attendance History</CardTitle></CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Note from Teacher</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? 
                                Array.from({length: 5}).map((_,i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="w-full h-8"/></TableCell></TableRow>)
                            : allRecords.length > 0 ? allRecords.map(rec => (
                                <TableRow key={rec.id}>
                                    <TableCell>{format(new Date(rec.date), 'PPP')}</TableCell>
                                    <TableCell><Badge variant={getStatusBadge(rec.status)}>{rec.status}</Badge></TableCell>
                                    <TableCell>{rec.note || 'N/A'}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">No attendance records found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
