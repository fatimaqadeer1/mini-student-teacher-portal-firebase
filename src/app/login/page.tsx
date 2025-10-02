
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  getCountFromServer,
  getDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";


const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type FormValues = z.infer<typeof formSchema>;

type Role = "student" | "teacher";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [selectedRole, setSelectedRole] = useState<Role>("student");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });
  
  const handleAuthAction = (data: FormValues) => {
    if (activeTab === 'login') {
      handleLogin(data);
    } else {
      handleSignup(data);
    }
  }

  const handleLogin = async (data: FormValues) => {
    setIsSubmitting(true);
    const { email, password } = data;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (selectedRole === 'student') {
            if (userDoc.exists() && userDoc.data().role === 'teacher') {
                throw new Error("NOT_STUDENT");
            }
            
            // Self-healing for student: if user exists in Auth but not fully in Firestore
            if (!userDoc.exists() || (userDoc.exists() && !userDoc.data().studentId)) {
                const studentQuery = query(collection(db, "attendees"), where("email", "==", email));
                const studentSnap = await getDocs(studentQuery);
                let studentId: string;

                if (!studentSnap.empty) {
                    studentId = studentSnap.docs[0].id;
                } else {
                    const defaultName = email.split('@')[0] || email;
                    const newAttendeeRef = await addDoc(collection(db, "attendees"), {
                        email: user.email,
                        name: defaultName,
                        createdAt: serverTimestamp()
                    });
                    studentId = newAttendeeRef.id;
                }
                // Ensure user doc is created/updated
                await setDoc(userDocRef, {
                    email: user.email,
                    role: "student",
                    studentId: studentId,
                    createdAt: serverTimestamp()
                }, { merge: true });
            }
            router.push("/student");

        } else { // Teacher login
             if (!userDoc.exists() || userDoc.data().role !== 'teacher') {
                throw new Error("NOT_TEACHER");
            }
            router.push("/");
        }
        toast({ title: "Success", description: "Logged in successfully." });

    } catch (error: any) {
        console.error("Login error:", error);
        let description = "An unexpected error occurred.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            description = "Invalid email or password.";
        } else if (error.message === 'NOT_TEACHER') {
            description = "This account does not have teacher permissions."
        } else if (error.message === 'NOT_STUDENT') {
            description = "This account does not have student permissions."
        }
        toast({ title: "Login Failed", description, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleSignup = async (data: FormValues) => {
    setIsSubmitting(true);
    const { email, password } = data;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (selectedRole === 'student') {
            const name = email.split('@')[0];
            
            // Check if an attendee record already exists for this email
            const attendeesQuery = query(collection(db, "attendees"), where("email", "==", email));
            const attendeesSnapshot = await getDocs(attendeesQuery);

            let studentId: string;
            if (!attendeesSnapshot.empty) {
                // If exists, link to that attendee
                studentId = attendeesSnapshot.docs[0].id;
            } else {
                // Otherwise, create a new attendee record
                const newAttendeeRef = await addDoc(collection(db, "attendees"), {
                    email: user.email,
                    name: name,
                    createdAt: serverTimestamp()
                });
                studentId = newAttendeeRef.id;
            }
            
            // Create the user profile doc and link it to the attendee ID
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: "student",
                studentId: studentId, 
                createdAt: serverTimestamp()
            }, { merge: true });
            
            toast({ title: "Account Created!", description: "Welcome! You can now access the student portal." });
            router.push('/student');

        } else { // Teacher signup
            await setDoc(doc(db, "users", user.uid), {
                email, role: "teacher", createdAt: serverTimestamp()
            }, { merge: true });

            toast({ title: "Account Created!", description: "You can now log in." });
            router.push('/');
        }
        
    } catch (error: any) {
        console.error("Signup error:", error);
        let description = "An unexpected error occurred.";
         if (error.code === 'auth/email-already-in-use') {
            description = 'An account with this email already exists. Please log in.';
        }
      toast({ title: "Signup Failed", description, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center items-center gap-2 mb-6">
          <GraduationCap className="h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold font-headline">Gen AI Attendance</h1>
        </div>
        <Card className="rounded-xl shadow-md">
            <CardHeader>
                <CardTitle>Welcome</CardTitle>
                <CardDescription>
                    Select your role and log in or create an account.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <RadioGroup value={selectedRole} onValueChange={(value) => setSelectedRole(value as Role)} className="flex justify-center space-x-4 mb-6">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="student" id="role-student" />
                        <Label htmlFor="role-student">I'm a Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="teacher" id="role-teacher" />
                        <Label htmlFor="role-teacher">I'm a Teacher</Label>
                    </div>
                </RadioGroup>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">Log In</TabsTrigger>
                        <TabsTrigger value="signup">Create Account</TabsTrigger>
                    </TabsList>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleAuthAction)} className="space-y-6 pt-4">
                            <TabsContent value="login" className="space-y-6 m-0">
                                 <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </TabsContent>
                            <TabsContent value="signup" className="space-y-6 m-0">
                                 <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                                     <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )} />
                            </TabsContent>
                             <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? "Processing..." : (activeTab === 'login' ? "Log In" : "Create Account")}
                            </Button>
                        </form>
                    </Form>
                </Tabs>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

    