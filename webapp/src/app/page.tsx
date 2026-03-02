"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const data = await apiFetch<{ setup_required: boolean }>(
          "/setup/status",
        );
        if (data.setup_required) {
          router.replace("/setup");
          return;
        }

        const token = localStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }

        router.replace("/dashboard");
      } catch {
        setLoading(false);
      }
    }
    check();
  }, [router]);

  if (!loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/60">
          Unable to connect to the server. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-foreground/60">Loading...</p>
    </div>
  );
}
