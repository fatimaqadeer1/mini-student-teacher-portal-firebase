"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db, serverTimestamp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  Student as Attendee,
  AttendanceStatus,
  attendanceStatuses,
  AttendanceRecord,
  AttendanceDoc
} from "@/lib/types";
import { format, startOfDay } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCheck, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

type AttendanceData = Record<string, Omit<AttendanceRecord, 'studentName' | 'email' | 'id' | 'date' | 'updatedAt' | 'studentId'>>;

export default function MarkAttendancePage() {
  const { toast } = useToast();

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({});
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch all attendees
  const fetchAllAttendees = useCallback(async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "attendees"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const fetchedAttendees = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Attendee)
        );
        setAttendees(fetchedAttendees);
      } catch (error) {
        console.error("Error fetching attendees: ", error);
        toast({ title: "Error", description: "Could not fetch attendees.", variant: "destructive" });
      }
      setLoading(false);
    }, [toast]);
    
  // Fetch attendance for a specific date for all attendees
  const fetchAttendanceForDate = useCallback(async () => {
      setLoading(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const attendanceDocRef = doc(db, "attendance", dateStr);
      try {
          const docSnap = await getDoc(attendanceDocRef);
          const newAttendanceData: AttendanceData = {};
          if (docSnap.exists()) {
              const records = docSnap.data().records as Record<string, AttendanceRecord>;
              if(records){
                  Object.keys(records).forEach(attendeeId => {
                      newAttendanceData[attendeeId] = {
                          status: records[attendeeId].status,
                          note: records[attendeeId].note || "",
                      };
                  });
              }
          }
          setAttendanceData(newAttendanceData);
      } catch (error) {
          console.error("Error fetching attendance: ", error);
          toast({ title: "Error", description: "Could not fetch attendance records.", variant: "destructive" });
      }
      setLoading(false);
  }, [selectedDate, toast]);


  useEffect(() => {
    fetchAllAttendees();
  }, [fetchAllAttendees]);

  
  useEffect(() => {
    if (attendees.length > 0) {
      fetchAttendanceForDate();
    }
  }, [selectedDate, attendees, fetchAttendanceForDate]);

  const handleAttendanceChange = (attendeeId: string, key: 'status' | 'note', value: string) => {
    setAttendanceData((prev) => ({
      ...prev,
      [attendeeId]: {
        ...(prev[attendeeId] || { status: "Present", note: "" }),
        [key]: value,
      },
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const docRef = doc(db, "attendance", dateStr);

    try {
        const existingDocSnap = await getDoc(docRef);
        const existingRecords = existingDocSnap.exists() ? existingDocSnap.data().records || {} : {};

        const records: Record<string, AttendanceRecord> = { ...existingRecords };
        
        attendees.forEach(attendee => {
            const attendeeAttendance = attendanceData[attendee.id];
            if(attendeeAttendance?.status) {
                records[attendee.id] = {
                    id: `${dateStr}_${attendee.id}`,
                    studentId: attendee.id,
                    studentName: attendee.name,
                    email: attendee.email,
                    date: dateStr,
                    status: attendeeAttendance.status,
                    note: attendeeAttendance.note || "",
                    updatedAt: serverTimestamp() as Timestamp,
                };
            }
        });
        
        const summary = { present: 0, absent: 0, leave: 0, total: 0 };
        Object.values(records).forEach(rec => {
            if (rec.status === "Present") summary.present++;
            else if (rec.status === "Absent") summary.absent++;
            else if (rec.status === "Leave") summary.leave++;
        });
        summary.total = Object.keys(records).length;

        const docPayload: AttendanceDoc = { date: dateStr, records, summary };
        await setDoc(docRef, docPayload, { merge: true });

        toast({
            title: "Success",
            description: `Attendance for ${dateStr} saved successfully.`,
        });
    } catch (error) {
      console.error("Error saving attendance: ", error);
      toast({ title: "Error", description: "Failed to save attendance.", variant: "destructive" });
    }
    setIsSaving(false);
  };
  
  const handleClearSelections = () => {
    setAttendanceData({});
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const newAttendanceData: AttendanceData = {};
    attendees.forEach(attendee => {
      newAttendanceData[attendee.id] = {
        status: status,
        note: attendanceData[attendee.id]?.note || ""
      }
    });
    setAttendanceData(newAttendanceData);
    toast({ title: "Updated", description: `All attendees marked as ${status}. Click Save to confirm.`});
  }

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
        <h1 className="text-3xl font-bold tracking-tight font-headline">Mark Attendance</h1>
        <p className="text-muted-foreground">
          Select a date and mark the attendance for each attendee.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <CardTitle>Attendees List for {format(selectedDate, "PPP")}</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className="w-full sm:w-[280px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                    initialFocus
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
               <Button onClick={() => handleMarkAll("Present")} variant="secondary" size="sm" disabled={isSaving}><CheckCheck className="h-4 w-4 mr-2"/>Mark All Present</Button>
               <Button onClick={handleClearSelections} variant="outline" size="sm" disabled={isSaving}><XCircle className="h-4 w-4 mr-2"/>Clear All</Button>
              <Button onClick={handleSaveAll} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
          <CardDescription>Changes are saved for the entire day. Unmarked attendees are not saved until a status is chosen.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Attendee</TableHead>
                  <TableHead className="min-w-[280px]">Status</TableHead>
                  <TableHead className="min-w-[250px]">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : attendees.length > 0 ? (
                  attendees.map((attendee) => (
                    <TableRow key={attendee.id}>
                      <TableCell>
                        <div className="font-medium">{attendee.name}</div>
                        <div className="text-sm text-muted-foreground">{attendee.email}</div>
                      </TableCell>
                      <TableCell>
                        <RadioGroup
                          value={attendanceData[attendee.id]?.status}
                          onValueChange={(value) =>
                            handleAttendanceChange(attendee.id, "status", value)
                          }
                          className="flex space-x-4"
                        >
                          {attendanceStatuses.map((status) => (
                            <div key={status} className="flex items-center space-x-2">
                                <RadioGroupItem value={status} id={`${attendee.id}-${status}`} />
                                <Label htmlFor={`${attendee.id}-${status}`}>
                                    <Badge variant={getStatusBadge(status)} className="border">{status}</Badge>
                                </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional note for attendee..."
                          value={attendanceData[attendee.id]?.note || ""}
                          onChange={(e) =>
                            handleAttendanceChange(attendee.id, "note", e.target.value)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No attendees found. Please add attendees first.
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
