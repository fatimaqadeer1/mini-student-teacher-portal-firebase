

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from 'next/navigation';
import { db, serverTimestamp } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Submission, Assignment } from "@/lib/types";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ReviewAssignmentsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { toast } = useToast();

    const [assignment, setAssignment] = useState<Assignment | null>(null);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [reviews, setReviews] = useState<Record<string, { feedback: string, grade: string }>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchAssignmentDetails = async () => {
            const docRef = doc(db, "assignments", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setAssignment(docSnap.data() as Assignment);
            } else {
                toast({ title: "Error", description: "Assignment not found", variant: "destructive" });
                router.push('/assignments');
            }
        };

        fetchAssignmentDetails();

        const q = query(collection(db, "submissions"), where("assignmentId", "==", id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const subs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Submission));
            setSubmissions(subs);

            const initialReviews: Record<string, { feedback: string, grade: string }> = {};
            subs.forEach(sub => {
                initialReviews[sub.id] = {
                    feedback: sub.feedback || "",
                    grade: sub.grade || ""
                };
            });
            setReviews(initialReviews);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching submissions:", error);
            toast({ title: "Error", description: "Failed to load submissions.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, router, toast]);

    const handleReviewChange = (submissionId: string, field: 'feedback' | 'grade', value: string) => {
        setReviews(prev => ({
            ...prev,
            [submissionId]: {
                ...prev[submissionId],
                [field]: value,
            }
        }));
    };

    const handleSaveReview = async (submission: Submission) => {
        const { feedback, grade } = reviews[submission.id];
        try {
            // Update submission doc
            const submissionDocRef = doc(db, "submissions", submission.id);
            await updateDoc(submissionDocRef, {
                feedback,
                grade,
                status: "graded",
            });

            // Update assignment statusMap
            const assignmentRef = doc(db, 'assignments', id);
            await updateDoc(assignmentRef, {
                [`statusMap.${submission.studentId}.status`]: 'Graded',
                [`statusMap.${submission.studentId}.grade`]: grade,
                [`statusMap.${submission.studentId}.updatedAt`]: serverTimestamp()
            });

            toast({ title: "Success", description: `Review for ${submission.studentEmail} saved.` });
        } catch (error) {
            console.error("Error saving review:", error);
            toast({ title: "Error", description: "Failed to save review.", variant: "destructive" });
        }
    };
    
    if (loading) {
        return (
            <div className="flex flex-col gap-8">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                 <Button variant="ghost" onClick={() => router.push(`/assignments/track/${id}`)} className="mb-2">
                    <ArrowLeft className="mr-2" /> Back to Tracking
                 </Button>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Review Submissions</h1>
                <p className="text-muted-foreground">For assignment: {assignment?.title}</p>
            </div>

            {submissions.length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">No submissions yet for this assignment.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {submissions.map((sub) => (
                        <Card key={sub.id}>
                            <CardHeader>
                                <CardTitle>{sub.studentEmail}</CardTitle>
                                <CardDescription>Submitted on: {sub.submittedAt ? format(sub.submittedAt.toDate(), 'PPP p') : 'N/A'}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {sub.fileURL && (
                                    <Link href={sub.fileURL} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" className="w-full"><Download className="mr-2"/>{sub.fileName || 'Download File'}</Button>
                                    </Link>
                                )}
                                <div>
                                    <label className="text-sm font-medium">Notes from student:</label>
                                    <p className="text-sm text-muted-foreground p-2 border rounded-md min-h-[40px]">{sub.notes || 'No notes.'}</p>
                                </div>
                                <div className="space-y-2">
                                     <div>
                                        <label className="text-sm font-medium">Grade:</label>
                                        <Input
                                            placeholder="e.g., A+, 95/100"
                                            value={reviews[sub.id]?.grade || ""}
                                            onChange={(e) => handleReviewChange(sub.id, 'grade', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Feedback:</label>
                                        <Textarea
                                            placeholder="Provide feedback..."
                                            value={reviews[sub.id]?.feedback || ""}
                                            onChange={(e) => handleReviewChange(sub.id, 'feedback', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button onClick={() => handleSaveReview(sub)} className="w-full">Save Review</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

    
