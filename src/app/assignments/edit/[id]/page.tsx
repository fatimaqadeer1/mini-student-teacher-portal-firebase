"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Assignment } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";


const assignmentSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters." }),
  description: z.string().optional(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)) && val, { message: "Due date is required." }),
  resourceUrl: z.string().url({ message: "Please enter a valid URL." }).optional().or(z.literal('')),
});

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

export default function EditAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;

  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
        title: "",
        description: "",
        dueDate: "",
        resourceUrl: "",
    },
  });

  useEffect(() => {
    if (!id) return;
    const fetchAssignment = async () => {
        try {
            const docRef = doc(db, "assignments", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Assignment;
                form.reset({
                    title: data.title,
                    description: data.description || "",
                    dueDate: data.dueDate,
                    resourceUrl: data.resourceUrl || ""
                });
            } else {
                toast({ title: "Error", description: "Assignment not found.", variant: "destructive" });
                router.push("/assignments");
            }
        } catch (error) {
            console.error("Error fetching assignment:", error);
            toast({ title: "Error", description: "Failed to fetch assignment details.", variant: "destructive" });
        }
    };
    fetchAssignment();
  }, [id, router, toast, form]);

  const onSubmit = async (data: AssignmentFormValues) => {
    try {
      const docRef = doc(db, "assignments", id);
      await updateDoc(docRef, {
        ...data
      });

      toast({
        title: "Success",
        description: "Assignment updated successfully.",
      });
      router.push("/assignments");
    } catch (error) {
      console.error("Error updating assignment: ", error);
      toast({
        title: "Error",
        description: "Failed to update assignment. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Edit Assignment</h1>
            <p className="text-muted-foreground">Update the details for this assignment.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Assignment Details</CardTitle>
                <CardDescription>Changes here will not affect student submission statuses.</CardDescription>
            </CardHeader>
            <CardContent>
                {form.formState.isSubmitting || !form.formState.isDirty && form.formState.isLoading ? (
                    <div className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
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
                                {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                            <Link href="/assignments" passHref>
                                <Button variant="outline" type="button">Cancel</Button>
                            </Link>
                        </div>
                    </form>
                    </Form>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
