
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Assignment } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Search, PlusCircle, Pencil, Trash2, Eye } from "lucide-react";
import { format } from 'date-fns';

export default function AssignmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "assignments"), orderBy("dueDate", sortOrder));
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
  }, [sortOrder, toast]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) =>
      assignment.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [assignments, searchTerm]);

  const handleDelete = async (assignmentId: string) => {
    try {
      await deleteDoc(doc(db, "assignments", assignmentId));
      toast({
        title: "Success",
        description: "Assignment deleted successfully.",
      });
      fetchAssignments(); // Re-fetch assignments to update the UI
    } catch (error) {
      console.error("Error deleting assignment: ", error);
      toast({
        title: "Error",
        description: "Failed to delete assignment.",
        variant: "destructive",
      });
    }
  };

  const getStatusCounts = (statusMap: Assignment['statusMap']) => {
    if (!statusMap) return { total: 0, submitted: 0, graded: 0 };
    const values = Object.values(statusMap);
    return {
        total: values.length,
        submitted: values.filter(v => v.status === 'Submitted').length,
        graded: values.filter(v => v.status === 'Graded').length
    }
  }
  
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Assignments</h1>
            <p className="text-muted-foreground">Manage and track course assignments.</p>
        </div>
        <Button onClick={() => router.push('/assignments/create')}>
          <PlusCircle className="mr-2"/> Create Assignment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
             <CardTitle>Assignments List</CardTitle>
             <div className="flex items-center gap-2">
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by title..."
                        className="pl-8 w-full md:w-[250px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button variant="outline" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                    Due Date: {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                </Button>
             </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-center">Total Students</TableHead>
                  <TableHead className="text-center">Submitted</TableHead>
                  <TableHead className="text-center">Graded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredAssignments.length > 0 ? (
                  filteredAssignments.map((assignment) => {
                    const {total, submitted, graded} = getStatusCounts(assignment.statusMap);
                    return (
                        <TableRow key={assignment.id}>
                        <TableCell className="font-medium">{assignment.title}</TableCell>
                        <TableCell>{format(new Date(assignment.dueDate), 'PPP')}</TableCell>
                        <TableCell className="text-center">{total}</TableCell>
                        <TableCell className="text-center">{submitted}</TableCell>
                        <TableCell className="text-center">{graded}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Link href={`/assignments/track/${assignment.id}`}>
                                    <Button variant="outline" size="sm"><Eye className="mr-2"/>View</Button>
                                </Link>
                                <Link href={`/assignments/edit/${assignment.id}`}>
                                    <Button variant="secondary" size="sm"><Pencil className="mr-2"/>Edit</Button>
                                </Link>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm"><Trash2 className="mr-2"/>Delete</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This will permanently delete the assignment and all associated tracking data. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(assignment.id)}>
                                        Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                        </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No assignments found.
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
