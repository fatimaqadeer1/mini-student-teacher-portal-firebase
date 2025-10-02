
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  doc,
  orderBy,
  query,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { db, serverTimestamp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Assignment, StudentAssignmentStatus } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Download } from "lucide-react";
import { format } from 'date-fns';
import Link from 'next/link';

export default function StudentAssignmentsPage() {
  const { toast } = useToast();
  const { user, studentProfile, loading: authLoading } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissionNote, setSubmissionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "assignments"), orderBy("dueDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedAssignments = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Assignment));
      setAssignments(fetchedAssignments);
    } catch (error) {
      console.error("Error fetching assignments: ", error);
      toast({
        title: "Error",
        description: "Could not fetch assignments.",
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
        fetchAssignments();
    }
  }, [fetchAssignments, authLoading]);
  
  const resetSubmissionState = () => {
      setSelectedAssignment(null);
      setSubmissionNote('');
      setIsSubmitting(false);
  }
  
  const handleSubmitAssignment = async () => {
    if (!selectedAssignment || !studentProfile || !user) return;
    setIsSubmitting(true);
    const studentId = studentProfile.id;
    try {
        const submissionDocRef = doc(db, "submissions", `${selectedAssignment.id}_${studentId}`);
        await setDoc(submissionDocRef, {
            assignmentId: selectedAssignment.id,
            studentId: studentId,
            studentEmail: user.email,
            notes: submissionNote,
            submittedAt: serverTimestamp(),
            status: "submitted",
        }, { merge: true });

        const assignmentRef = doc(db, 'assignments', selectedAssignment.id);
        await updateDoc(assignmentRef, {
          [`statusMap.${studentId}.status`]: 'Submitted',
          [`statusMap.${studentId}.note`]: submissionNote,
          [`statusMap.${studentId}.fileURL`]: '', // Clear out old data
          [`statusMap.${studentId}.fileName`]: '', // Clear out old data
          [`statusMap.${studentId}.updatedAt`]: serverTimestamp(),
        });

        toast({ title: 'Success', description: 'Assignment submitted.' });
        fetchAssignments(); 
        resetSubmissionState();
    } catch(error) {
      console.error("Error submitting assignment:", error);
      toast({ title: 'Error', description: 'Failed to submit assignment.', variant: 'destructive'});
    } finally {
        setIsSubmitting(false);
    }
  }

   const handleOpenSubmitDialog = (assignment: Assignment) => {
    if (!studentProfile) return;
    const studentStatus = assignment.statusMap?.[studentProfile.id];
    setSubmissionNote(studentStatus?.note || '');
    setIsSubmitting(false);
    setSelectedAssignment(assignment);
  };
  
  if (authLoading || loading) {
      return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-10 w-1/3" />
            <Card>
                <CardHeader><Skeleton className="h-8 w-1/4" /></CardHeader>
                <CardContent>
                    <Skeleton className="h-40 w-full" />
                </CardContent>
            </Card>
        </div>
      )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">My Assignments</h1>
          <p className="text-muted-foreground">View and submit your assignments here.</p>
      </div>
      <Card>
          <CardHeader>
              <CardTitle>Assignment List</CardTitle>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Submission</TableHead>
                           <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {assignments.length > 0 ? assignments.map(assignment => {
                          const studentStatus: StudentAssignmentStatus | undefined = studentProfile ? assignment.statusMap?.[studentProfile.id] : undefined;
                          if (!studentStatus) return null;

                          return (
                              <TableRow key={assignment.id}>
                                  <TableCell className="font-medium">{assignment.title}</TableCell>
                                  <TableCell>{format(new Date(assignment.dueDate), 'PPP')}</TableCell>
                                  <TableCell>{studentStatus.status}</TableCell>
                                  <TableCell>{studentStatus.grade || 'N/A'}</TableCell>
                                  <TableCell>
                                    {studentStatus.fileURL ? (
                                        <Link href={studentStatus.fileURL} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                                            <Download className="h-4 w-4" />
                                            {studentStatus.fileName || 'View File'}
                                        </Link>
                                    ) : (studentStatus.note ? 'Note submitted' : 'N/A')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                      {(studentStatus.status === 'Assigned' || studentStatus.status === 'Submitted') && (
                                          <Button size="sm" onClick={() => handleOpenSubmitDialog(assignment)}>
                                            {studentStatus.status === 'Submitted' ? 'Update' : <><Send className="mr-2 h-4 w-4"/> Submit</>}
                                          </Button>
                                      )}
                                      {studentStatus.status === 'Graded' && (
                                          <Button size="sm" variant="secondary" disabled>Graded</Button>
                                      )}
                                  </TableCell>
                              </TableRow>
                          )
                      }) : (
                          <TableRow>
                              <TableCell colSpan={6} className="text-center h-24">No assignments found.</TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
               <Dialog open={!!selectedAssignment} onOpenChange={(isOpen) => !isOpen && resetSubmissionState()}>
                  <DialogContent className="sm:max-w-[525px]">
                      <DialogHeader>
                          <DialogTitle>Submit: {selectedAssignment?.title}</DialogTitle>
                          <CardDescription>You can add a note or a link to your work. You can update this until it is graded.</CardDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4">
                           <div>
                             <label htmlFor="notes" className="block text-sm font-medium text-muted-foreground mb-2">
                                Submission Note
                            </label>
                            <Textarea 
                                id="notes"
                                placeholder="Write your notes or paste links here..."
                                value={submissionNote}
                                onChange={(e) => setSubmissionNote(e.target.value)}
                            />
                           </div>
                      </div>
                      <DialogFooter>
                          <DialogClose asChild>
                              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                          </DialogClose>
                          <Button onClick={handleSubmitAssignment} disabled={isSubmitting}>
                              {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
                          </Button>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>
          </CardContent>
      </Card>
    </div>
  );
}
