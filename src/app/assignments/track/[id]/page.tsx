
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db, serverTimestamp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Assignment, AssignmentStatus, assignmentStatuses, StudentAssignmentStatus, Student } from "@/lib/types";
import { format } from "date-fns";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Download, FileCheck, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


export default function TrackAssignmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, StudentAssignmentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchAssignment = useCallback(async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "assignments", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Assignment;
        setAssignment(data);
        setStatusMap(data.statusMap || {});
      } else {
        toast({ title: "Error", description: "Assignment not found.", variant: "destructive" });
        router.push("/assignments");
      }
    } catch (error) {
      console.error("Error fetching assignment:", error);
      toast({ title: "Error", description: "Failed to load assignment data.", variant: "destructive" });
    }
    setLoading(false);
  }, [id, router, toast]);

  useEffect(() => {
    if (!id) return;
    fetchAssignment();
  }, [id, fetchAssignment]);

  const handleFieldChange = (studentId: string, field: keyof Omit<StudentAssignmentStatus, 'studentId' | 'studentName' | 'email' | 'updatedAt' | 'fileURL' | 'fileName'>, value: string) => {
    setStatusMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  const handleBulkUpdate = (status: AssignmentStatus) => {
    const newStatusMap = { ...statusMap };
    Object.keys(newStatusMap).forEach(studentId => {
      newStatusMap[studentId] = {
        ...newStatusMap[studentId],
        status,
        updatedAt: serverTimestamp(),
      };
    });
    setStatusMap(newStatusMap);
    toast({ title: "Info", description: `All students marked as ${status}. Click 'Save Changes' to confirm.` });
  };
  
  const handleSyncAttendees = async () => {
    setIsSyncing(true);
    try {
        const attendeesQuery = query(collection(db, "attendees"), orderBy("name"));
        const attendeesSnapshot = await getDocs(attendeesQuery);
        const allAttendees = attendeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));

        const newStatusMap = { ...statusMap };
        let newAttendeesCount = 0;

        allAttendees.forEach(attendee => {
            if (!newStatusMap[attendee.id]) {
                newStatusMap[attendee.id] = {
                    studentId: attendee.id,
                    studentName: attendee.name,
                    email: attendee.email,
                    status: "Assigned",
                    grade: "",
                    note: "",
                    updatedAt: serverTimestamp(),
                };
                newAttendeesCount++;
            }
        });
        
        if (newAttendeesCount > 0) {
            setStatusMap(newStatusMap);
            await handleSaveChanges(newStatusMap); // Save the synced data
            toast({
                title: "Sync Successful",
                description: `${newAttendeesCount} new attendee(s) have been assigned. The list is now up to date.`,
            });
            await fetchAssignment(); // Re-fetch to get latest state
        } else {
            toast({
                title: "Already in Sync",
                description: "No new attendees to add. The assignment is already up to date.",
            });
        }
    } catch (error) {
        console.error("Error syncing attendees:", error);
        toast({ title: "Error", description: "Failed to sync attendees.", variant: "destructive" });
    }
    setIsSyncing(false);
  };

  const handleSaveChanges = async (mapToSave = statusMap) => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "assignments", id);
      const updatedStatusMap = { ...mapToSave };

      Object.keys(updatedStatusMap).forEach(studentId => {
        const originalStatus = assignment?.statusMap[studentId];
        const currentStatus = updatedStatusMap[studentId];
        
        // This check is imperfect with serverTimestamps, but good enough for this purpose
        if (JSON.stringify(originalStatus) !== JSON.stringify(currentStatus)) {
           updatedStatusMap[studentId] = {
               ...currentStatus,
               updatedAt: serverTimestamp()
           };
        }
      });
      
      await updateDoc(docRef, { statusMap: updatedStatusMap });
      toast({ title: "Success", description: "Assignment progress saved." });
      setAssignment(prev => prev ? { ...prev, statusMap: updatedStatusMap } : null);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
    setIsSaving(false);
  };
  
  const studentArray = useMemo(() => {
    return Object.values(statusMap).sort((a,b) => a.studentName.localeCompare(b.studentName));
  }, [statusMap]);

  const summary = useMemo(() => {
    const values = Object.values(statusMap);
    return {
        total: values.length,
        assigned: values.filter(v => v.status === 'Assigned').length,
        submitted: values.filter(v => v.status === 'Submitted').length,
        graded: values.filter(v => v.status === 'Graded').length
    }
  }, [statusMap]);

  if (loading) {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-10 w-1/2" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/4" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {Array.from({length: 5}).map((_, i) => (
                           <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
  }

  if (!assignment) {
    return <div>Assignment not found.</div>;
  }
  
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" onClick={() => router.push('/assignments')} className="mb-2">
          <ArrowLeft className="mr-2" /> Back to Assignments
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">{assignment.title}</h1>
        <p className="text-muted-foreground">
          Due on {format(new Date(assignment.dueDate), "PPP")}
        </p>
         <div className="mt-4 flex gap-4 text-sm">
            <span>Total: <strong>{summary.total}</strong></span>
            <span>Assigned: <strong>{summary.assigned}</strong></span>
            <span>Submitted: <strong>{summary.submitted}</strong></span>
            <span>Graded: <strong>{summary.graded}</strong></span>
        </div>
      </div>
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <CardTitle>Track Submissions</CardTitle>
                <div className="flex gap-2 flex-wrap">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="outline" size="sm" disabled={isSyncing}><RefreshCw className="mr-2"/>{isSyncing ? "Syncing..." : "Sync Attendees"}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Sync with latest attendee list?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This will add any new attendees to this assignment. It will not remove anyone. This action is irreversible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSyncAttendees}>
                                Sync
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    
                    <Link href={`/assignments/review/${id}`}>
                      <Button variant="secondary"><FileCheck className="mr-2"/>Review Submissions</Button>
                    </Link>
                    <Button onClick={() => handleSaveChanges()} disabled={isSaving}>
                        <Save className="mr-2"/>{isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
            <CardDescription>Update the status, grade, and notes for each student. To grade and give feedback, go to the Review page.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Student</TableHead>
                  <TableHead className="min-w-[150px]">Status</TableHead>
                  <TableHead className="min-w-[100px]">Grade</TableHead>
                  <TableHead className="min-w-[250px]">Note</TableHead>
                  <TableHead className="min-w-[150px]">Submission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentArray.map((studentStatus) => (
                  <TableRow key={studentStatus.studentId}>
                    <TableCell>
                      <div className="font-medium">{studentStatus.studentName}</div>
                      <div className="text-sm text-muted-foreground">{studentStatus.email}</div>
                    </TableCell>
                    <TableCell>
                        <Select
                            value={studentStatus.status}
                            onValueChange={(value) => handleFieldChange(studentStatus.studentId, 'status', value as AssignmentStatus)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                                {assignmentStatuses.map(status => (
                                    <SelectItem key={status} value={status}>{status}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="N/A"
                        value={studentStatus.grade || ""}
                        onChange={(e) => handleFieldChange(studentStatus.studentId, 'grade', e.target.value)}
                      />
                    </TableCell>
                     <TableCell>
                      <Input
                        placeholder="Optional note..."
                        value={studentStatus.note || ""}
                        onChange={(e) => handleFieldChange(studentStatus.studentId, 'note', e.target.value)}
                      />
                    </TableCell>
                     <TableCell>
                        {studentStatus.fileURL ? (
                            <Link href={studentStatus.fileURL} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                    <Download className="mr-2" /> {studentStatus.fileName || 'Download'}
                                </Button>
                            </Link>
                        ) : 'No file'}
                     </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
