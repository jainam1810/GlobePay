"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function SignOutButton() {
    const router = useRouter();
    async function signOut() {
        await getSupabaseBrowser().auth.signOut();
        router.replace("/login");
    }
    return (
        <button onClick={signOut} className="nav-item w-full text-left" title="Sign out">
            <LogOut size={18} strokeWidth={1.8} />
            <span>Sign out</span>
        </button>
    );
}
