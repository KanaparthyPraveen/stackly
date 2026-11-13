"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, type ProfileData } from "../lib/api";
import type { Profile } from "../components/stackly/profile-preview";
import { useAuth } from "./auth-context";

interface ProfileContextType {
  /** The signed-in user's profile exactly as stored, or null while loading. */
  data: ProfileData | null;
  /** The same profile in the shape the shell and preview components take. */
  profile: Profile | null;
  isLoading: boolean;
  /** Re-reads the profile from the backend. */
  reload: () => Promise<void>;
  /** Replaces the cached profile after a successful save. */
  setData: (next: ProfileData) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function toShellProfile(data: ProfileData): Profile {
  return {
    username: data.username,
    displayName: data.displayName || data.username,
    bio: data.bio,
    avatarUrl: data.avatarUrl,
    location: data.location,
    website: data.website,
    live: data.live === true && data.ghostMode !== true,
    usernameClaimed: data.usernameClaimed,
    social: {
      github: data.social?.github,
      x: data.social?.x,
      linkedin: data.social?.linkedin,
      discord: data.social?.discord,
      website: data.website,
    },
  };
}

/**
 * Wraps every dashboard route.
 *
 * - Sends visitors who are not signed in to the login page instead of
 *   showing them a dashboard.
 * - Loads the signed-in user's real profile once and shares it, so every
 *   dashboard page shows the same, real identity.
 */
export function DashboardProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await api.getMyProfile());
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    let mounted = true;
    api
      .getMyProfile()
      .then((profile) => {
        if (mounted) setData(profile);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authLoading, user, router]);

  const value = useMemo<ProfileContextType>(
    () => ({
      data,
      profile: data ? toShellProfile(data) : null,
      isLoading,
      reload,
      setData,
    }),
    [data, isLoading, reload],
  );

  // Nothing from the dashboard is rendered for a signed-out visitor.
  if (authLoading || !user) return null;

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useDashboardProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error(
      "useDashboardProfile must be used within a DashboardProfileProvider",
    );
  }
  return context;
}
