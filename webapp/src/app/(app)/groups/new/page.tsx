"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const group = await apiFetch<Group>("/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      router.push(`/groups/${group.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Failed to create group",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Add Group</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Living Room Shelf"
            className="mt-1"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Group"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
