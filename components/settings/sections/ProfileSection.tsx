"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/settings/actions";
import type { ProfileData, SubscriptionData } from "@/lib/settings/types";

export function ProfileSection({ profile, subscription }: { profile: ProfileData; subscription: SubscriptionData }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [college, setCollege] = useState(profile.college ?? "");
  const [branch, setBranch] = useState(profile.branch ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setSaving(true);
      await updateProfile({
        fullName,
        username: username.trim() || null,
        bio: bio.trim() || null,
        college: college.trim() || null,
        branch: branch.trim() || null,
        semester: profile.semester,
      });
      setSaving(false);
      setSavedAt(Date.now());
    }, 700);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, username, bio, college, branch]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-signal/15 text-xl font-medium text-signal">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.fullName} className="h-full w-full object-cover" />
            ) : (
              profile.fullName.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-medium text-ink">{profile.fullName}</h2>
            <p className="text-sm text-mist">{profile.email}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-mist">
            {saving ? (
              <span className="flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Saving…
              </span>
            ) : (
              savedAt && <span>Saved</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Username">
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="not set" />
          </Field>
          <Field label="College">
            <Input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="not set" />
          </Field>
          <Field label="Branch">
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="not set" />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface/40 px-3 py-2 text-sm text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="font-display text-sm font-medium text-ink">Account</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Stat label="Subscription" value={<Badge tone="signal">{subscription.planTier}</Badge>} />
          <Stat label="Profile completion" value={`${profile.completionPercent}%`} />
          <Stat label="Joined" value={new Date(profile.joinedAt).toLocaleDateString()} />
          <Stat
            label="Last active"
            value={profile.lastActiveAt ? new Date(profile.lastActiveAt).toLocaleString() : "Unknown"}
          />
          <Stat label="Workspace status" value={<Badge tone="success">Active</Badge>} />
          <Stat
            label="Online status"
            value={
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Online
              </span>
            }
          />
        </dl>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mist">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
