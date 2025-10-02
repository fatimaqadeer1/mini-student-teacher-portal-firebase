
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db, serverTimestamp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Student as Attendee, ArchivedStudent as ArchivedAttendee } from "@/lib/types";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Trash2, Edit, RotateCcw, UserPlus } from "lucide-react";
import { format } from "date-fns";

const attendeeSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type AttendeeFormValues = z.infer<typeof attendeeSchema>;

function AttendeeForm({ onSave, attendeeToEdit, onOpenChange }: { onSave: () => void, attendeeToEdit: Attendee | null, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const form = useForm<AttendeeFormValues>({
    resolver: zodResolver(attendeeSchema),
    defaultValues: { name: "", email: "" },
  });
  
  const isEditing = !!attendeeToEdit;

  useEffect(() => {
    if (attendeeToEdit) {
      form.reset({ name: attendeeToEdit.name, email: attendeeToEdit.email });
    } else {
      form.reset({ name: "", email: "" });
    }
  }, [attendeeToEdit, form]);

  const onSubmit = async (data: AttendeeFormValues) => {
    try {
      const attendeesRef = collection(db, "attendees");
      // Check for email uniqueness across both active and deleted attendees for robustness
      const activeQ = query(attendeesRef, where("email", "==", data.email));
      const deletedQ = query(collection(db, "deleted_attendees"), where("email", "==", data.email));
      const [activeSnapshot, deletedSnapshot] = await Promise.all([getDocs(activeQ), getDocs(deletedQ)]);
      
      let emailExists = false;
      if (!activeSnapshot.empty) {
        if (isEditing && attendeeToEdit) {
          // In edit mode, the email is valid if it belongs to the attendee being edited
          emailExists = activeSnapshot.docs[0].id !== attendeeToEdit.id;
        } else {
          // In add mode, any existing doc means the email is a duplicate
          emailExists = true;
        }
      }
      if (!deletedSnapshot.empty) {
        // An email in the deleted list also counts as "in use" to prevent re-activation issues
        emailExists = true;
      }


      if (emailExists) {
        form.setError("email", { type: "manual", message: "This email address is already in use by an active or deleted attendee." });
        return;
      }

      if (isEditing && attendeeToEdit) {
        const attendeeRef = doc(db, "attendees", attendeeToEdit.id);
        await updateDoc(attendeeRef, data);
        toast({ title: "Success", description: "Attendee updated successfully." });
      } else {
        await addDoc(collection(db, "attendees"), { ...data, createdAt: serverTimestamp() });
        toast({ title: "Attendee Added", description: `Ask the attendee to sign up using ${data.email} to set their password.` });
      }
      
      form.reset();
      onSave();
      onOpenChange(false); // Close dialog

    } catch (error) {
      console.error("Error saving attendee: ", error);
      toast({
        title: "Error",
        description: "Failed to save attendee. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Attendee' : 'Add New Attendee'}</DialogTitle>
        <DialogDescription>
          {isEditing ? `Update details for ${attendeeToEdit?.name}.` : "Enter the new attendee's details. They will use this email to sign up."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl><Input placeholder="e.g., John Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl><Input type="email" placeholder="e.g., john.doe@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : (isEditing ? "Save Changes" : "Add Attendee")}
              </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}


export default function AttendeesPage() {
  const [attendees, setAttendees] = useState<(Attendee | ArchivedAttendee)[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'active' | 'deleted'>('active');
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [attendeeToEdit, setAttendeeToEdit] = useState<Attendee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { toast } = useToast();

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    const isDeletedView = view === 'deleted';
    const collectionName = isDeletedView ? "deleted_attendees" : "attendees";
    const collectionRef = collection(db, collectionName);
    const orderByField = isDeletedView ? "deletedAt" : "name";
    
    try {
      const q = query(collectionRef, orderBy(orderByField, sortOrder));
      const querySnapshot = await getDocs(q);
      const fetchedAttendees = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Attendee | ArchivedAttendee)
      );
      setAttendees(fetchedAttendees);
    } catch (error) {
      console.error(`Error fetching ${view} attendees: `, error);
      toast({ title: "Error", description: `Could not fetch ${view} attendees.`, variant: "destructive" });
    }
    setLoading(false);
  }, [view, sortOrder, toast]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);
  
  const handleViewChange = (newView: 'active' | 'deleted' | string) => {
    if(!newView || (newView !== 'active' && newView !== 'deleted')) return;
    setView(newView as 'active' | 'deleted');
    setSearchTerm("");
  }
  
  const handleSoftDelete = async (attendee: Attendee) => {
    try {
        const archivedAttendeeRef = doc(db, 'deleted_attendees', attendee.id);
        
        const attendeeData = { ...attendee };
        
        await setDoc(archivedAttendeeRef, {
            ...attendeeData,
            originalId: attendee.id,
            deletedAt: serverTimestamp(),
        });
        await deleteDoc(doc(db, 'attendees', attendee.id));

        toast({ title: "Success", description: "Attendee has been moved to the deleted list." });
        fetchAttendees();
    } catch(error) {
        console.error("Error deleting attendee:", error);
        toast({ title: "Error", description: "Failed to delete attendee.", variant: "destructive" });
    }
  }

  const handleRestore = async (attendee: ArchivedAttendee) => {
    try {
        const q = query(collection(db, 'attendees'), where('email', '==', attendee.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            toast({ title: "Error", description: "An attendee with this email already exists in the active list.", variant: "destructive" });
            return;
        }

        const { originalId, deletedAt, ...restoredAttendeeData } = attendee;
        
        const attendeeRef = doc(db, 'attendees', attendee.originalId || attendee.id);
        await setDoc(attendeeRef, {
            ...restoredAttendeeData,
            createdAt: attendee.createdAt || serverTimestamp(), // Preserve original creation date if exists
            restoredAt: serverTimestamp(),
        });

        await deleteDoc(doc(db, 'deleted_attendees', attendee.id));

        toast({ title: "Success", description: "Attendee restored successfully." });
        fetchAttendees();
    } catch (error) {
         console.error("Error restoring attendee:", error);
         toast({ title: "Error", description: "Failed to restore attendee.", variant: "destructive" });
    }
  }

  const handleAddNew = () => {
    setAttendeeToEdit(null);
    setIsFormOpen(true);
  }

  const handleEdit = (attendee: Attendee) => {
    setAttendeeToEdit(attendee);
    setIsFormOpen(true);
  };

  const filteredAttendees = useMemo(() => {
    return attendees.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [attendees, searchTerm]);

  const onFormOpenChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setAttendeeToEdit(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
        <Dialog open={isFormOpen} onOpenChange={onFormOpenChange}>
            <DialogContent>
            <AttendeeForm onSave={fetchAttendees} attendeeToEdit={attendeeToEdit} onOpenChange={onFormOpenChange}/>
            </DialogContent>
        </Dialog>
      
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Manage Attendees</h1>
            <p className="text-muted-foreground">Add, edit, delete, and restore attendee records.</p>
            </div>
            <Button onClick={handleAddNew}>
                <UserPlus className="mr-2"/> Add Attendee
            </Button>
        </div>

        <Tabs value={view} onValueChange={handleViewChange}>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="relative w-full sm:w-auto">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search by name or email..."
                                    className="pl-8 sm:w-[250px] lg:w-[300px]"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                Sort: {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                            </Button>
                        </div>
                        <TabsList className="mt-4 sm:mt-0">
                            <TabsTrigger value="active">Active</TabsTrigger>
                            <TabsTrigger value="deleted">Deleted</TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>
                <CardContent>
                    <TabsContent value="active" className="mt-0">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ))
                            ) : filteredAttendees.length > 0 ? (
                            filteredAttendees.map((attendee) => (
                                <TableRow key={attendee.id}>
                                <TableCell>{attendee.name}</TableCell>
                                <TableCell>{attendee.email}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="outline" size="sm" onClick={() => handleEdit(attendee as Attendee)}><Edit className="mr-2"/>Edit</Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm"><Trash2 className="mr-2"/>Delete</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete this attendee?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                The attendee will be moved to the deleted list and can be restored later. This action will not affect past attendance records.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleSoftDelete(attendee as Attendee)}>
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                                </TableRow>
                            ))
                            ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center h-24">
                                No active attendees found.
                                {searchTerm ? "" : " Why not add one?"}
                                </TableCell>
                            </TableRow>
                            )}
                        </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="deleted" className="mt-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Deleted At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                ))
                                ) : filteredAttendees.length > 0 ? (
                                filteredAttendees.map((attendee) => (
                                    <TableRow key={attendee.id}>
                                    <TableCell>{attendee.name}</TableCell>
                                    <TableCell>{attendee.email}</TableCell>
                                    <TableCell>{(attendee as ArchivedAttendee).deletedAt && ((attendee as ArchivedAttendee).deletedAt as unknown as Timestamp)?.seconds ? format(new Date(((attendee as ArchivedAttendee).deletedAt as unknown as Timestamp).seconds * 1000), 'PPP') : 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                <Button variant="secondary" size="sm" style={{backgroundColor: '#10B981'}}><RotateCcw className="mr-2"/>Restore</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Restore this attendee?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will move the attendee back to the active list.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRestore(attendee as ArchivedAttendee)}>
                                                    Restore
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                    </TableRow>
                                ))
                                ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                    No deleted attendees found.
                                    </TableCell>
                                </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </CardContent>
            </Card>
        </Tabs>
    </div>
  );
}
