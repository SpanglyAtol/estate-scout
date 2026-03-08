"use client";

import { useRouter } from "next/navigation";

export function AdminLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="inline-flex items-center gap-1.5 text-sm border border-antique-border text-antique-text-sec px-4 py-2 rounded-lg hover:border-red-400 hover:text-red-500 transition-colors"
    >
      Sign out
    </button>
  );
}
