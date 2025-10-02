"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  getCountFromServer,
  doc,
  getDoc,
  addDoc,
  query,
} from "firebase/firestore";
import { db, serverTimestamp } from "@/lib/firebase";
import { Student as Attendee, AttendanceDoc } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Users, UserCheck, UserX, UserMinus } from "lucide-react";
import { format, startOfDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useRouter } from "next/navigation";


const COLORS = {
  present: '#10B981', // green
  absent: '#EF4444', // red
  leave: '#F59E0B' // amber
};

export default function Dashboard() {
  const router = useRouter();
  const { user, userRole, loading } = useAuth();
  
  // Teacher-specific state
  const [totalAttendees, setTotalAttendees] = useState<number | null>(null);
  const [summary, setSummary] = useState({ present: 0, absent: 0, leave: 0, total: 0 });
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  
  // Redirect to student page if role is student
  useEffect(() => {
    if (!loading && userRole === 'student') {
        router.replace('/student');
    }
  }, [userRole, loading, router]);
  
  // Teacher stats fetching
  useEffect(() => {
    if (userRole !== 'teacher') return;

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const attendeesCollection = collection(db, "attendees");
        const snapshot = await getCountFromServer(attendeesCollection);
        setTotalAttendees(snapshot.data().count);
      } catch (error) {
        console.error("Error fetching total attendees: ", error);
        setTotalAttendees(0);
      }
      setLoadingStats(false);
    };

    fetchStats();
  }, [userRole]);

  // Teacher attendance summary fetching
  useEffect(() => {
    if (userRole !== 'teacher') return;

    const fetchSummary = async () => {
      setLoadingSummary(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const attendanceDocRef = doc(db, "attendance", dateStr);
      
      try {
        const docSnap = await getDoc(attendanceDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data() as AttendanceDoc;
            setSummary(data.summary || { present: 0, absent: 0, leave: 0, total: 0 });
        } else {
             setSummary({ present: 0, absent: 0, leave: 0, total: 0 });
        }
      } catch (error) {
        console.error("Error fetching attendance summary: ", error);
        setSummary({ present: 0, absent: 0, leave: 0, total: 0 });
      }
      setLoadingSummary(false);
    };

    fetchSummary();
  }, [selectedDate, userRole]);
  
  const formattedDate = useMemo(() => format(selectedDate, "PPP"), [selectedDate]);
  
  const chartData = useMemo(() => [
    { name: 'Present', value: summary.present, color: COLORS.present },
    { name: 'Absent', value: summary.absent, color: COLORS.absent },
    { name: 'Leave', value: summary.leave, color: COLORS.leave },
  ], [summary]);

  const totalForChart = Math.max(1, summary.total);
  const presentPct = Math.round((summary.present / totalForChart) * 100);
  const absentPct = Math.round((summary.absent / totalForChart) * 100);
  const leavePct = Math.round((summary.leave / totalForChart) * 100);

  if (loading || userRole !== 'teacher') {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  // TEACHER VIEW
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Welcome, {user?.email}</h1>
        <p className="text-muted-foreground">An overview of your classroom activity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md rounded-xl hover:scale-105 transition-transform duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">{totalAttendees}</div>
            )}
            <p className="text-xs text-muted-foreground">Currently enrolled</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-md rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">
              Attendance Summary for {formattedDate}
            </CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  size="sm"
                  className="w-[200px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <span>{formattedDate}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
               <div className="space-y-4 pt-2">
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
                <Skeleton className="h-12 w-full mt-4" />
               </div>
            ) : (
            <>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div style={{backgroundColor: COLORS.present}} className="flex items-center justify-center gap-2 rounded-lg p-2 text-white">
                  <UserCheck className="h-5 w-5" />
                  <div>
                    <p className="text-2xl font-bold">{summary.present}</p>
                    <p className="text-sm">Present</p>
                  </div>
                </div>
                 <div style={{backgroundColor: COLORS.absent}} className="flex items-center justify-center gap-2 rounded-lg p-2 text-white">
                  <UserX className="h-5 w-5" />
                   <div>
                    <p className="text-2xl font-bold">{summary.absent}</p>
                    <p className="text-sm">Absent</p>
                  </div>
                </div>
                <div style={{backgroundColor: COLORS.leave}} className="flex items-center justify-center gap-2 rounded-lg p-2 text-black">
                  <UserMinus className="h-5 w-5" />
                  <div>
                    <p className="text-2xl font-bold">{summary.leave}</p>
                    <p className="text-sm">Leave</p>                  </div>
                </div>
              </div>
              {summary.total > 0 ? (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div>
                         <div className="w-full bg-[#E5E7EB] rounded-full h-6 flex overflow-hidden">
                            <div style={{ width: `${presentPct}%`, backgroundColor: COLORS.present }} className="h-6 flex items-center justify-center text-white text-xs">
                                {presentPct > 12 && `P ${presentPct}%`}
                            </div>
                            <div style={{ width: `${absentPct}%`, backgroundColor: COLORS.absent }} className="h-6 flex items-center justify-center text-white text-xs">
                                {absentPct > 12 && `A ${absentPct}%`}
                            </div>
                             <div style={{ width: `${leavePct}%`, backgroundColor: COLORS.leave }} className="h-6 flex items-center justify-center text-black text-xs">
                                {leavePct > 12 && `L ${leavePct}%`}
                            </div>
                        </div>
                    </div>
                    <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={5} stroke="hsl(var(--card))">
                                    {chartData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                                </Pie>
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize: '12px'}}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
              ) : (
                <div className="mt-6 text-center text-muted-foreground text-sm">
                   No attendance saved for this date yet.
                </div>
              )}
            </>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
