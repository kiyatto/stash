"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { deleteAccountAction } from "@/app/settings/actions";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  getAvatarPublicUrl,
  removeAvatar,
  seedToColor,
  updateDisplayName,
  uploadAvatar,
} from "@/lib/supabase/profile";
import type { Profile } from "@/lib/supabase/database.types";
import { getStorageErrorMessage } from "@/lib/storage/errors";

type SettingsFormProps = {
  initialProfile: Profile;
  email: string;
};

export function SettingsForm({ initialProfile, email }: SettingsFormProps) {
  const client = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState(initialProfile);
  const [displayName, setDisplayName] = useState(
    initialProfile.display_name ?? ""
  );
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [profileBusy, setProfileBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const avatarUrl = getAvatarPublicUrl(client, profile.avatar_url);
  const fallbackColor = seedToColor(profile.avatar_seed);

  async function handleSaveProfile() {
    setProfileBusy(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const updated = await updateDisplayName(client, displayName);
      setProfile(updated);
      setProfileMessage("Display name saved.");
    } catch (err) {
      setProfileError(getStorageErrorMessage(err));
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProfileBusy(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const updated = await uploadAvatar(client, file);
      setProfile(updated);
      setProfileMessage("Photo updated.");
    } catch (err) {
      setProfileError(getStorageErrorMessage(err));
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleRemoveAvatar() {
    setProfileBusy(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const updated = await removeAvatar(client);
      setProfile(updated);
      setProfileMessage("Photo removed.");
    } catch (err) {
      setProfileError(getStorageErrorMessage(err));
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleChangeEmail() {
    const trimmed = newEmail.trim();
    if (!trimmed) {
      setEmailError("Enter a new email address.");
      return;
    }
    if (trimmed.toLowerCase() === email.trim().toLowerCase()) {
      setEmailError("That is already your current email.");
      return;
    }

    setEmailBusy(true);
    setEmailError(null);
    setEmailMessage(null);
    try {
      const redirectTo = new URL(
        "/auth/callback",
        window.location.origin
      ).toString();
      const { error } = await client.auth.updateUser(
        { email: trimmed },
        { emailRedirectTo: redirectTo }
      );
      if (error) throw error;
      setEmailMessage(
        "Check your inbox to confirm the new address. Depending on your project settings, you may also need to confirm from your current email."
      );
      setNewEmail("");
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : "Could not update email."
      );
    } finally {
      setEmailBusy(false);
    }
  }

  function handleDeleteAccount() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteAccountAction(confirmEmail);
      if (result && !result.ok) {
        setDeleteError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 border-t border-border/60 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Profile
        </h2>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 shadow-sm"
            style={avatarUrl ? undefined : { backgroundColor: fallbackColor }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-6 w-6 stroke-[1.25] text-foreground/40" />
            )}
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => void handleRemoveAvatar()}
                disabled={profileBusy}
                className="absolute right-1 top-1 rounded-full bg-background/85 p-1 shadow-sm"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-mono text-xs uppercase tracking-wide"
              onClick={() => fileRef.current?.click()}
              disabled={profileBusy}
            >
              {avatarUrl ? "Replace photo" : "Upload photo"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleUpload(e)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="settings-display-name"
            className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
          >
            Display name
          </Label>
          <Input
            id="settings-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="font-serif text-base italic"
            maxLength={80}
          />
        </div>

        {profileError ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {profileError}
          </p>
        ) : null}
        {profileMessage ? (
          <p className="font-mono text-xs text-muted-foreground">
            {profileMessage}
          </p>
        ) : null}

        <Button
          type="button"
          size="sm"
          className="w-fit font-mono text-xs uppercase tracking-wide"
          onClick={() => void handleSaveProfile()}
          disabled={profileBusy}
        >
          {profileBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save profile"
          )}
        </Button>
      </section>

      <section className="flex flex-col gap-4 border-t border-border/60 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Account
        </h2>
        <p className="font-mono text-sm text-foreground">{email}</p>

        <div className="flex flex-col gap-2">
          <Label
            htmlFor="settings-new-email"
            className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
          >
            Change email
          </Label>
          <Input
            id="settings-new-email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="new@email.com"
            className="font-mono text-sm"
          />
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            We will send a confirmation link to the new address.
          </p>
        </div>

        {emailError ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {emailError}
          </p>
        ) : null}
        {emailMessage ? (
          <p className="font-mono text-xs text-muted-foreground">{emailMessage}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="font-mono text-xs uppercase tracking-wide"
            onClick={() => void handleChangeEmail()}
            disabled={emailBusy}
          >
            {emailBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Update email"
            )}
          </Button>
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="font-mono text-xs uppercase tracking-wide"
            >
              Sign out
            </Button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border/60 pt-6">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-destructive">
          Danger zone
        </h2>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Permanently delete your account, stashes, and uploaded images. This
          cannot be undone.
        </p>
        <div className="flex flex-col gap-2">
          <Label
            htmlFor="settings-confirm-email"
            className="font-mono text-[11px] font-normal uppercase tracking-widest text-muted-foreground"
          >
            Type {email} to confirm
          </Label>
          <Input
            id="settings-confirm-email"
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        {deleteError ? (
          <p className="font-mono text-xs text-destructive" role="alert">
            {deleteError}
          </p>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-fit font-mono text-xs uppercase tracking-wide"
          onClick={handleDeleteAccount}
          disabled={deletePending || confirmEmail.trim().length === 0}
        >
          {deletePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Delete account"
          )}
        </Button>
      </section>
    </div>
  );
}
