"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Student,
  AttendanceRecord,
  SummaryData,
  AttendanceDoc,
} from "@/lib/types";
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Download, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { downloadCsv } from "@/lib/utils";

const COLORS = {
  present: '#10B981',
  absent: '#EF4444',
  leave: '#F59E0B'
};

function SummaryCharts({ data, loading }: { data: SummaryData[], loading: boolean }) {
    const aggregatedData = useMemo(() => {
        if (loading || !data || data.length === 0) return [];
        const totals = data.reduce((acc, student) => {
            acc.present += student.present;
            acc.absent += student.absent;
            acc.leave += student.leave;
            return acc;
        }, { present: 0, absent: 0, leave: 0 });

        return [
            { name: 'Present', value: totals.present, color: COLORS.present },
            { name: 'Absent', value: totals.absent, color: COLORS.absent },
            { name: 'Leave', value: totals.leave, color: COLORS.leave }
        ];
    }, [data, loading]);

    const total = aggregatedData.reduce((sum, item) => sum + item.value, 0);
    
    if (loading) return <Skeleton className="h-[120px] w-full" />;
    if (total === 0) return <div className="h-[120px] flex items-center justify-center text-muted-foreground">No attendance data to display for this period.</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
                <div className="w-full bg-[#E5E7EB] rounded-full h-6 flex overflow-hidden">
                    {aggregatedData.map(item => {
                        if (item.value === 0) return null;
                        const pct = Math.round((item.value / total) * 100);
                        return (
                            <div key={item.name} className="h-6 flex items-center justify-center text-white text-xs" style={{ width: `${pct}%`, backgroundColor: item.color, color: item.name === 'Leave' ? 'black' : 'white' }}>
                                {pct > 12 && `${item.name[0]} ${pct}%`}
                            </div>
                        )
                    })}
                </div>
            </div>
            <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={aggregatedData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={5} stroke="hsl(var(--card))">
                            {aggregatedData.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.color} />)}
                        </Pie>
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize: '12px'}}/>
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default function SummaryPage() {
  const [viewMode, setViewMode] = useState<"daily" | "monthly">("daily");
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord[]>>({});
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);
  
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllAttendees = async () => {
      try {
        const q = query(collection(db, "attendees"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        setStudents(
          querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Student))
        );
      } catch (error) {
        console.error("Error fetching attendees:", error);
      }
    };
    fetchAllAttendees();
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "daily") {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const docRef = doc(db, "attendance", dateStr);
        const docSnap = await getDoc(docRef);
        const newRecords: Record<string, AttendanceRecord[]> = {};
        if (docSnap.exists()) {
          const data = docSnap.data() as AttendanceDoc;
          Object.values(data.records || {}).forEach(rec => {
            if (!newRecords[rec.studentId]) newRecords[rec.studentId] = [];
            newRecords[rec.studentId].push(rec);
          });
        }
        setAttendanceRecords(newRecords);
      } else { // monthly
        const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
        const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");
        const q = query(
          collection(db, "attendance"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );
        const querySnapshot = await getDocs(q);
        const monthlyRecords: Record<string, AttendanceRecord[]> = {};
        querySnapshot.forEach(docSnap => {
          const data = docSnap.data() as AttendanceDoc;
          if(data.records) {
            Object.values(data.records).forEach(rec => {
                 if (!monthlyRecords[rec.studentId]) monthlyRecords[rec.studentId] = [];
                 monthlyRecords[rec.studentId].push(rec);
            });
          }
        });
        setAttendanceRecords(monthlyRecords);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setAttendanceRecords({});
    }
    setLoading(false);
  }, [viewMode, selectedDate, selectedMonth]);

  useEffect(() => {
    if (students.length > 0) {
      fetchAttendance();
    }
  }, [students, fetchAttendance]);

  useEffect(() => {
    const processSummary = () => {
      if (!students.length) return;

      const newSummaryData = students.map((student) => {
        const studentAttendance = attendanceRecords[student.id] || [];
        const present = studentAttendance.filter((att) => att.status === "Present").length;
        const absent = studentAttendance.filter((att) => att.status === "Absent").length;
        const leave = studentAttendance.filter((att) => att.status === "Leave").length;
        const denominator = present + absent + leave;
        const attendancePercentage = denominator > 0 ? Math.round((present / denominator) * 100) : 0;
        
        return {
          studentId: student.id,
          studentName: student.name,
          email: student.email,
          present,
          absent,
          leave,
          total: present + absent + leave,
          attendancePercentage,
        };
      });

      setSummaryData(newSummaryData);
    };

    processSummary();
  }, [students, attendanceRecords]);

  const filteredData = useMemo(() => {
    return summaryData.filter(
      (s) =>
        s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [summaryData, searchTerm]);

  const handleExport = () => {
    const dataToExport = filteredData.map(d => ({
        Student: d.studentName,
        Email: d.email,
        Present: d.present,
        Absent: d.absent,
        Leave: d.leave,
        'Attendance %': d.attendancePercentage
    }));
    const dateStr = viewMode === 'daily' ? format(selectedDate, 'yyyy-MM-dd') : format(selectedMonth, 'yyyy-MM');
    downloadCsv(dataToExport, `attendance-summary-${dateStr}.csv`);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Attendance Summary</h1>
        <p className="text-muted-foreground">Review daily or monthly attendance records.</p>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "daily" | "monthly")}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <TabsList>
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full md:w-auto">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                          type="search"
                          placeholder="Search student..."
                          className="pl-8 w-full md:w-[250px]"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className="w-full md:w-[200px] justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {viewMode === 'daily' ? format(selectedDate, "PPP") : format(selectedMonth, "MMM yyyy")}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                           <Calendar
                                mode="single"
                                selected={viewMode === 'daily' ? selectedDate : selectedMonth}
                                onSelect={(d) => {
                                  if (!d) return;
                                  if (viewMode === 'daily') {
                                    setSelectedDate(startOfDay(d));
                                  } else {
                                    setSelectedMonth(startOfMonth(d));
                                  }
                                }}
                                initialFocus
                                numberOfMonths={viewMode === 'monthly' ? 1 : 1}
                                onMonthChange={viewMode === 'monthly' ? setSelectedMonth : undefined}
                                disabled={viewMode === 'monthly' ? (date) => date.getDate() !== 1 : undefined}
                              />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleExport} disabled={filteredData.length === 0}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                </div>
            </div>
            <TabsContent value="daily" />
            <TabsContent value="monthly" />
          </Tabs>
        </CardHeader>
        <CardContent>
            <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Overall Stats for {viewMode === 'daily' ? format(selectedDate, 'PPP') : format(selectedMonth, 'MMMM yyyy')}</h3>
                <SummaryCharts data={filteredData} loading={loading} />
            </div>
            <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Absent</TableHead>
                    <TableHead className="text-center">Leave</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    </TableRow>
                    ))
                ) : filteredData.length > 0 ? (
                    filteredData.map((s) => (
                    <TableRow key={s.studentId}>
                        <TableCell>
                            <div className="font-medium">{s.studentName}</div>
                            <div className="text-sm text-muted-foreground">{s.email}</div>
                        </TableCell>
                        <TableCell className="text-center font-medium" style={{color: COLORS.present}}>{s.present}</TableCell>
                        <TableCell className="text-center font-medium" style={{color: COLORS.absent}}>{s.absent}</TableCell>
                        <TableCell className="text-center font-medium" style={{color: COLORS.leave}}>{s.leave}</TableCell>
                        <TableCell className="text-right font-medium">{s.attendancePercentage}%</TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No attendance records found for the selected period.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
