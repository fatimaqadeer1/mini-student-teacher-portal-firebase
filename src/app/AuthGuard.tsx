"use client";

import { usePathname, useRouter } from "next/navigation";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import StudentSidebar from "@/components/layout/student-sidebar";

const publicPaths = ["/login"];
// Define teacher paths, ensuring '/' is handled correctly.
const teacherPaths = ["/", "/attendees", "/mark-attendance", "/assignments", "/summary"];
const studentPaths = ["/student", "/student/attendance", "/student/assignments"];


export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userRole, loading } = useAuth();
  
  const isPublicPath = publicPaths.includes(pathname);

  useEffect(() => {
    if (!loading) {
      // Logged in user on a public path -> redirect to their dashboard
      if (user && isPublicPath) {
        router.replace(userRole === 'teacher' ? "/" : "/student");
        return;
      }
      
      // Not logged in and trying to access a protected path -> redirect to login
      if (!user && !isPublicPath) {
        router.replace("/login");
        return;
      }

      // Role-based route protection for logged-in users
      if (user) {
        const isTeacherRoute = teacherPaths.some(p => p === '/' ? pathname === '/' : pathname.startsWith(p));
        const isStudentRoute = studentPaths.some(p => pathname.startsWith(p));
        
        if (userRole === 'student' && isTeacherRoute) {
            router.replace('/student');
        }
        if (userRole === 'teacher' && isStudentRoute) {
            router.replace('/');
        }
      }
    }
  }, [user, userRole, loading, isPublicPath, router, pathname]);


  if (loading) {
    return (
        <div className="flex min-h-screen w-full bg-background">
            <div className="w-64 hidden md:block p-4">
                <Skeleton className="h-10 w-full mb-8" />
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                    ))}
                </div>
            </div>
            <div className="flex-1 p-8">
                <Skeleton className="h-12 w-1/2 mb-8" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
  }
  
  if (isPublicPath || !user) {
    return <>{children}</>;
  }
  
  const isStudentPage = userRole === 'student';

  return (
    <SidebarProvider>
      <Sidebar>
        {isStudentPage ? <StudentSidebar /> : <AppSidebar />}
      </Sidebar>
      <SidebarInset>
        <main className="flex-1 p-4 md:p-8">
            {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
