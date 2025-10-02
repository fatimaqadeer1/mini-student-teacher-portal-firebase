"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import {
  GraduationCap,
  LayoutDashboard,
  BookMarked,
  Sun,
  Moon,
  LogOut,
  History,
} from "lucide-react";

import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const studentNavLinks = [
  { href: "/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/attendance", label: "My Attendance", icon: History },
  { href: "/student/assignments", label: "Assignments", icon: BookMarked },
];

export default function StudentSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const isActive = (href: string) => {
    if (href === "/student") return pathname === "/student";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Error", description: "Failed to log out.", variant: "destructive" });
    }
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <Link href="/student" className="flex items-center gap-2 group">
            <GraduationCap className="h-8 w-8 text-primary group-hover:animate-pulse" />
            <span className="font-bold text-lg font-headline text-sidebar-foreground">
              Student Portal
            </span>
          </Link>
          <Badge variant="secondary">Student</Badge>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {studentNavLinks.map((link) => (
            <SidebarMenuItem key={link.href}>
              <Link href={link.href}>
                <SidebarMenuButton
                  isActive={isActive(link.href)}
                  tooltip={link.label}
                >
                  <link.icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="flex flex-col gap-4 p-2">
          <div className="text-sm p-2 truncate">
            <p className="font-medium text-sidebar-foreground">Logged in as</p>
            <p className="text-sidebar-foreground/70">{user?.email}</p>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dark-mode-toggle" className="text-sm text-sidebar-foreground/70 flex items-center gap-2">
              <Sun className="h-4 w-4 inline-block dark:hidden" />
              <Moon className="h-4 w-4 hidden dark:inline-block" />
              Dark Mode
            </Label>
            <Switch
              id="dark-mode-toggle"
              checked={theme === "dark"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Toggle dark mode"
            />
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start">
            <LogOut className="mr-2" /> Logout
          </Button>
        </div>
         <p className="text-xs text-sidebar-foreground/50 text-center p-2">
            © 2025
         </p>
      </SidebarFooter>
    </>
  );
}
