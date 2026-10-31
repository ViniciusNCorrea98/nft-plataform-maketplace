import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ZodError } from "zod";
import { isAuthenticated, useSession } from "@/app/session";
import { apiErrorSchema, type Profile } from "@/domain/contracts";
import { usePasswordMutation, useProfile, useProfileMutation } from "./api";

function errorMessage(error: unknown) {
  if (error instanceof ZodError)
    return error.issues[0]?.message ?? "Invalid profile data.";
  if (typeof error === "object" && error !== null && "response" in error) {
    const parsed = apiErrorSchema.safeParse(
      (error as { response?: { data?: unknown } }).response?.data
    );
    if (parsed.success) return parsed.data.message;
  }
  return "Unable to save your changes.";
}

function ProfileForm({ userId }: { userId: string }) {
  const profile = useProfile(userId);
  if (profile.isPending)
    return <div className="cart-skeleton" aria-label="Loading profile" />;
  if (profile.isError || !profile.data)
    return (
      <div className="state-panel error-state">
        <h1>Profile unavailable.</h1>
        <p>{errorMessage(profile.error)}</p>
        <button
          className="button button-outline"
          type="button"
          onClick={() => void profile.refetch()}
        >
          Try again
        </button>
      </div>
    );
  return (
    <ProfileEditor
      key={profile.data.id}
      userId={userId}
      initialProfile={profile.data}
    />
  );
}

function ProfileEditor({
  userId,
  initialProfile,
}: {
  userId: string;
  initialProfile: Profile;
}) {
  const update = useProfileMutation(userId);
  const password = usePasswordMutation(userId);
  const [name, setName] = useState(initialProfile.name);
  const [bio, setBio] = useState(initialProfile.bio);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ name, bio, avatarUrl: avatarUrl || null });
  };
  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    password.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
        },
      }
    );
  };
  return (
    <>
      <form className="account-card account-form" onSubmit={saveProfile}>
        <div className="account-card-heading">
          <div>
            <p className="eyebrow accent">ACCOUNT</p>
            <h2>Profile</h2>
          </div>
          <Link to="/account/wallets" className="text-link">
            Manage wallets
          </Link>
        </div>
        <label htmlFor="profile-name">
          Name
          <input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label htmlFor="profile-email">
          Email
          <input id="profile-email" value={initialProfile.email} readOnly />
        </label>
        <label htmlFor="profile-bio">
          Bio
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={280}
            rows={4}
          />
        </label>
        <label htmlFor="profile-avatar">
          Avatar URL
          <input
            id="profile-avatar"
            type="url"
            value={avatarUrl}
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://example.test/avatar.png"
          />
        </label>
        {initialProfile.avatarUrl && (
          <img
            className="profile-avatar-preview"
            src={initialProfile.avatarUrl}
            alt={`${initialProfile.name}'s avatar`}
          />
        )}
        {update.isError && (
          <p className="form-error" role="alert">
            {errorMessage(update.error)}
          </p>
        )}
        {update.isSuccess && (
          <p className="form-success" role="status">
            Profile updated.
          </p>
        )}
        <button
          className="button button-primary"
          type="submit"
          disabled={update.isPending}
        >
          {update.isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
      <form className="account-card account-form" onSubmit={savePassword}>
        <div>
          <p className="eyebrow accent">SECURITY</p>
          <h2>Change password</h2>
        </div>
        <label htmlFor="current-password">
          Current password
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </label>
        <label htmlFor="new-password">
          New password
          <input
            id="new-password"
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </label>
        {password.isError && (
          <p className="form-error" role="alert">
            {errorMessage(password.error)}
          </p>
        )}
        {password.isSuccess && (
          <p className="form-success" role="status">
            Password changed.
          </p>
        )}
        <button
          className="button button-outline"
          type="submit"
          disabled={password.isPending}
        >
          {password.isPending ? "Updating…" : "Change password"}
        </button>
      </form>
    </>
  );
}

export function ProfilePage() {
  const session = useSession();
  if (!isAuthenticated(session.data) || !session.data.user)
    return (
      <main className="account-page">
        <div className="state-panel">Sign in to view your profile.</div>
      </main>
    );
  return (
    <main className="account-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow accent">COLLECTOR ACCOUNT</p>
          <h1>Profile</h1>
        </div>
      </div>
      <div className="account-layout">
        <ProfileForm userId={session.data.user.id} />
      </div>
    </main>
  );
}
