
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db, serverTimestamp } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Student } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Link from "next/link";

const assignmentSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().optional(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)) && val, { message: "Due date is required." }),
  resourceUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function CreateAssignmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      resourceUrl: "",
    },
  });

  const onSubmit = async (data: AssignmentFormValues) => {
    try {
      // Fetch all active attendees to pre-seed the statusMap
      const attendeesQuery = query(collection(db, "attendees"));
      const attendeesSnapshot = await getDocs(attendeesQuery);
      const attendees = attendeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));

      const statusMap: { [key: string]: any } = {};
      attendees.forEach(attendee => {
        statusMap[attendee.id] = {
          studentId: attendee.id,
          studentName: attendee.name,
          email: attendee.email,
          status: "Assigned",
          grade: "",
          note: "",
          updatedAt: serverTimestamp(),
        };
      });

      await addDoc(collection(db, "assignments"), {
        ...data,
        createdAt: serverTimestamp(),
        statusMap,
      });

      toast({
        title: "Success",
        description: "Assignment created successfully.",
      });
      router.push("/assignments");
    } catch (error) {
      console.error("Error creating assignment: ", error);
      toast({
        title: "Error",
        description: "Failed to create assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Create New Assignment</h1>
            <p className="text-muted-foreground">Fill in the details for the new assignment.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Assignment Details</CardTitle>
                <CardDescription>All active attendees will be assigned this task upon creation.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Chapter 5 Reading Quiz" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe the assignment..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                           <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                    control={form.control}
                    name="resourceUrl"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Resource URL (Optional)</FormLabel>
                        <FormControl>
                            <Input type="url" placeholder="https://example.com/resource" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="flex gap-2">
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? "Creating..." : "Create Assignment"}
                        </Button>
                        <Link href="/assignments" passHref>
                             <Button variant="outline" type="button">Cancel</Button>
                        </Link>
                    </div>
                </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
