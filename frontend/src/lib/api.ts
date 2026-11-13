export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: User;
}

export interface SocialLinks {
  github?: string;
  x?: string;
  linkedin?: string;
  discord?: string;
  youtube?: string;
  instagram?: string;
}

export interface AppearanceConfig {
  background: "solid" | "gradient" | "aurora";
  accent:
    "signal" | "ocean" | "ember" | "jade" | "rose" | "ice" | "gold" | "mono";
  typography: "default" | "compact" | "editorial";
  buttonStyle: "rounded" | "soft" | "square";
  layout: "centered" | "compact";
  colors: {
    primary?: string;
    secondary?: string;
    background?: string;
    text?: string;
  };
  surface: {
    style: "glass" | "solid" | "elevated" | "flat";
    color?: string;
    borderColor?: string;
    borderWidth: number;
    opacity: number;
    radius: number;
  };
  typographyScale: {
    heading: number;
    subheading: number;
    body: number;
    small: number;
  };
  button: {
    style: "rounded" | "soft" | "square";
    radius: number;
    height: "sm" | "md" | "lg";
  };
  canvas: {
    width: "narrow" | "standard" | "wide" | "full";
    padding: number;
    spacing: number;
    contentWidth: number;
    align: "left" | "center";
    background?: string;
  };
  layoutOrder: string[];
}

/** Fields of a section may be set, or cleared back to the default with `null`. */
type Clearable<T> = { [K in keyof T]?: T[K] | null };

/** A partial appearance update — nested sections are partial as well. */
export type AppearancePatch = Partial<
  Omit<
    AppearanceConfig,
    "colors" | "surface" | "typographyScale" | "button" | "canvas"
  >
> & {
  colors?: Clearable<AppearanceConfig["colors"]>;
  surface?: Clearable<AppearanceConfig["surface"]>;
  typographyScale?: Clearable<AppearanceConfig["typographyScale"]>;
  button?: Clearable<AppearanceConfig["button"]>;
  canvas?: Clearable<AppearanceConfig["canvas"]>;
};

export interface ProfileData {
  _id?: string;
  userId?: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  website?: string;
  live?: boolean;
  usernameClaimed?: boolean;
  ghostMode?: boolean;
  social?: SocialLinks;
  appearance?: Partial<AppearanceConfig>;
}

export interface MediaItem {
  _id: string;
  id?: string;
  userId?: string;
  key: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  type:
    | "avatar"
    | "cover"
    | "project"
    | "gallery"
    | "resume"
    | "document"
    | "video";
  /** Stable absolute URL of the file. */
  url: string;
  visibility?: "public" | "private";
  referenced?: boolean;
  downloadUrl?: string;
  createdAt?: string;
}

export interface LinkItem {
  id?: string;
  _id?: string;
  userId?: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  category?: string;
  enabled: boolean;
  visible?: boolean;
  order?: number;
  clicks?: number;
}

export interface ProjectItem {
  id?: string;
  _id?: string;
  userId?: string;
  name: string;
  description?: string;
  tech: string[];
  repoUrl?: string;
  liveUrl?: string;
  docsUrl?: string;
  images?: string[];
  status: "live" | "beta" | "wip" | "archived";
  featured: boolean;
  visible?: boolean;
  order?: number;
  stars?: number;
  forks?: number;
}

export interface ComponentItem {
  id?: string;
  _id?: string;
  userId?: string;
  type: string;
  title: string;
  enabled: boolean;
  visible: boolean;
  order: number;
  config: Record<string, unknown>;
}

export interface TemplateItem {
  _id?: string;
  id?: string;
  name: string;
  slug: string;
  description?: string;
  tags: string[];
  previewImageUrl?: string;
  appearance: AppearanceConfig;
  components: Array<{
    type: string;
    title: string;
    order: number;
    config: Record<string, unknown>;
  }>;
  clonesCount: number;
}

export interface IntegrationItem {
  _id?: string;
  integrationId: string;
  name: string;
  kind?: "oauth" | "api_key" | "manual";
  status: "connected" | "disconnected" | "reauth_required" | "coming-soon";
  handle?: string;
  profileUrl?: string;
  avatarUrl?: string;
  /** True when the provider itself confirmed the account. */
  verified?: boolean;
  /** Normalised provider data cached by the backend. */
  data?: Record<string, unknown>;
  syncStatus?: "idle" | "syncing" | "ok" | "error";
  lastSyncedAt?: string;
  lastSyncError?: string;
  connectedAt?: string;
  updatedAt?: string;
}

/** A provider the backend supports, and whether it can be used right now. */
export interface IntegrationProviderInfo {
  id: string;
  name: string;
  kind: "oauth" | "api_key" | "manual";
  description: string;
  configured: boolean;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  createdAt?: string;
  expiresAt?: string;
  browser: string;
  os: string;
}

export interface AccountInfo {
  id: string;
  email: string;
  emailIsPlaceholder: boolean;
  displayName?: string;
  avatarUrl?: string;
  hasPassword: boolean;
  identities: Array<{
    provider: string;
    username?: string;
    displayName?: string;
    email?: string;
    linkedAt?: string;
  }>;
}

export interface GitHubRepoItem {
  name: string;
  url: string;
  description?: string;
  stars: number;
  forks: number;
  language?: string;
  pushedAt?: string;
}

export interface GitHubContentResponse {
  connected: boolean;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  repos: GitHubRepoItem[];
  stats: {
    totalStars: number;
    followers: number;
    publicRepos: number;
    following?: number;
    topLanguages?: Array<{ name: string; repos: number }>;
  };
}

export interface ChangelogItem {
  _id: string;
  userId: string;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  entityId?: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  views: number;
  clicks: number;
  projectClicks: number;
  ctr: number;
}

export interface AnalyticsReport {
  range: "7d" | "30d" | "90d";
  summary: AnalyticsSummary;
  /** The same metrics for the equally long period before this one. */
  previous?: AnalyticsSummary;
  /** Relative change vs the previous period (0.12 = +12%); null when there is nothing to compare. */
  change?: {
    views: number | null;
    clicks: number | null;
    projectClicks: number | null;
  };
  viewsSeries: { date: string; value: number }[];
  clicksSeries: { date: string; value: number }[];
  topLinks: { id: string; label: string; count: number }[];
  topProjects: { id: string; label: string; count: number }[];
  referrers?: { label: string; count: number }[];
  devices?: { label: string; count: number }[];
  browsers?: { label: string; count: number }[];
}

export class ApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api/v1" : "http://localhost:3001/api/v1");

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    ...(options.body !== undefined && options.body !== null
      ? { "Content-Type": "application/json" }
      : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers,
    credentials: "include",
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const dataObj =
      typeof data === "object" && data !== null
        ? (data as Record<string, unknown>)
        : null;

    const messageField = dataObj?.message;
    const errorMsg =
      (Array.isArray(messageField)
        ? messageField.join(", ")
        : typeof messageField === "string"
          ? messageField
          : null) ||
      (typeof dataObj?.error === "string" ? dataObj.error : null) ||
      `Request failed with status ${response.status}`;

    throw new ApiException(errorMsg, response.status, data);
  }

  return data as T;
}

export interface GitHubTestProfileData {
  success: boolean;
  username: string;
  meta: {
    authenticated: boolean;
    rateLimitLimit: string | null;
    rateLimitRemaining: string | null;
    rateLimitReset: string | null;
    fetchedAt: string;
  };
  profile: {
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    location?: string;
    website?: string;
    social?: {
      github?: string;
      x?: string;
      website?: string;
    };
    live?: boolean;
  };
  projects: Array<{
    id: string;
    name: string;
    description: string;
    tech: string[];
    repoUrl: string;
    liveUrl?: string;
    status: "live" | "beta" | "wip" | "archived";
    featured: boolean;
    stars: number;
    forks: number;
    isFork: boolean;
  }>;
  stats: {
    publicRepos: number;
    publicGists: number;
    followers: number;
    following: number;
    company: string | null;
    location: string | null;
    hasPublicEmail: boolean;
    publicEmail: string | null;
    accountAgeYears: number;
  };
  raw: {
    user: Record<string, unknown>;
    repos: Array<Record<string, unknown>>;
  };
}

export const api = {
  // Auth
  register: async (credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  getMe: async (): Promise<AuthResponse> => {
    return request<AuthResponse>("/auth/me", {
      method: "GET",
    });
  },

  logout: async (): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>("/auth/logout", {
      method: "POST",
    });
  },

  // Links CRUD & Reorder
  getLinks: async (): Promise<LinkItem[]> => {
    const raw = await request<Array<LinkItem & { _id?: string }>>("/links", {
      method: "GET",
    });
    return raw.map((item) => ({
      ...item,
      id: item._id || item.id,
    }));
  },

  createLink: async (link: {
    title: string;
    url: string;
    description?: string;
    icon?: string;
    category?: string;
    visible?: boolean;
  }): Promise<LinkItem> => {
    const res = await request<LinkItem & { _id?: string }>("/links", {
      method: "POST",
      body: JSON.stringify(link),
    });
    return {
      ...res,
      id: res._id || res.id,
    };
  },

  updateLink: async (
    id: string,
    link: Partial<{
      title: string;
      url: string;
      description?: string;
      icon?: string;
      enabled: boolean;
      visible?: boolean;
      category?: string;
    }>,
  ): Promise<LinkItem> => {
    const res = await request<LinkItem & { _id?: string }>(`/links/${id}`, {
      method: "PATCH",
      body: JSON.stringify(link),
    });
    return {
      ...res,
      id: res._id || res.id,
    };
  },

  deleteLink: async (id: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/links/${id}`, {
      method: "DELETE",
    });
  },

  reorderLinks: async (ids: string[]): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>("/links/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  },

  getPublicLinks: async (
    username: string,
    cookie?: string,
  ): Promise<LinkItem[]> => {
    const raw = await request<Array<LinkItem & { _id?: string }>>(
      `/links/public/${encodeURIComponent(username)}`,
      { method: "GET", headers: cookie ? { Cookie: cookie } : undefined },
    );
    return raw.map((item) => ({ ...item, id: item._id || item.id }));
  },

  /**
   * Reports a visitor's click on a public link or project. Fire-and-forget:
   * `keepalive` lets the request finish while the browser navigates away, and
   * a failure never gets in the visitor's way.
   */
  recordClick: (kind: "links" | "projects", id: string): void => {
    void fetch(`${API_BASE_URL}/${kind}/${encodeURIComponent(id)}/click`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
    }).catch(() => undefined);
  },

  // Profile & Appearance
  getMyProfile: async (): Promise<ProfileData | null> => {
    return request<ProfileData | null>("/profile/me", {
      method: "GET",
    });
  },

  createMyProfile: async (data: { username: string }): Promise<ProfileData> => {
    return request<ProfileData>("/profile/me", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateProfile: async (data: Partial<ProfileData>): Promise<ProfileData> => {
    return request<ProfileData>("/profile/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /** Saves a partial appearance change and returns the full saved config. */
  updateAppearance: async (
    data: AppearancePatch,
  ): Promise<AppearanceConfig> => {
    return request<AppearanceConfig>("/profile/me/appearance", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  getMyAppearance: async (): Promise<AppearanceConfig> => {
    return request<AppearanceConfig>("/profile/me/appearance", {
      method: "GET",
    });
  },

  /** Appearance configuration for a specific profile (owner only). */
  getAppearance: async (profileId: string): Promise<AppearanceConfig> => {
    return request<AppearanceConfig>(
      `/profiles/${encodeURIComponent(profileId)}/appearance`,
      { method: "GET" },
    );
  },

  /** Update the appearance configuration of a specific profile (owner only). */
  updateAppearanceById: async (
    profileId: string,
    data: AppearancePatch,
  ): Promise<AppearanceConfig> => {
    return request<AppearanceConfig>(
      `/profiles/${encodeURIComponent(profileId)}/appearance`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
  },

  /**
   * Public profile lookup. When called from a server component, pass the
   * visitor's cookie header so a signed-in owner can preview their own
   * unpublished profile; visitors get `null` for anything not public.
   */
  getPublicProfile: async (
    username: string,
    cookie?: string,
  ): Promise<ProfileData | null> => {
    return request<ProfileData | null>(
      `/profile/${encodeURIComponent(username)}`,
      { method: "GET", headers: cookie ? { Cookie: cookie } : undefined },
    );
  },

  checkUsernameAvailability: async (
    username: string,
  ): Promise<{ available: boolean; reason?: string }> => {
    return request<{ available: boolean; reason?: string }>(
      `/profile/availability/${encodeURIComponent(username)}`,
      { method: "GET" },
    );
  },

  claimUsername: async (data: {
    username: string;
    displayName?: string;
  }): Promise<ProfileData> => {
    return request<ProfileData>("/profile/me/claim-username", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getPublicIntegrations: async (
    username: string,
    cookie?: string,
  ): Promise<IntegrationItem[]> => {
    return request<IntegrationItem[]>(
      `/integrations/public/${encodeURIComponent(username)}`,
      { method: "GET", headers: cookie ? { Cookie: cookie } : undefined },
    ).catch(() => []);
  },

  // Projects CRUD
  getProjects: async (): Promise<ProjectItem[]> => {
    const raw = await request<Array<ProjectItem & { _id?: string }>>(
      "/projects",
      {
        method: "GET",
      },
    );
    return raw.map((item) => ({
      ...item,
      id: item._id || item.id,
    }));
  },

  createProject: async (data: Partial<ProjectItem>): Promise<ProjectItem> => {
    const res = await request<ProjectItem & { _id?: string }>("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return { ...res, id: res._id || res.id };
  },

  updateProject: async (
    id: string,
    data: Partial<ProjectItem>,
  ): Promise<ProjectItem> => {
    const res = await request<ProjectItem & { _id?: string }>(
      `/projects/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    return { ...res, id: res._id || res.id };
  },

  deleteProject: async (id: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/projects/${id}`, {
      method: "DELETE",
    });
  },

  reorderProjects: async (ids: string[]): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>("/projects/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  },

  toggleProjectFeatured: async (
    id: string,
    featured: boolean,
  ): Promise<ProjectItem> => {
    const res = await request<ProjectItem & { _id?: string }>(
      `/projects/${id}/feature`,
      {
        method: "PATCH",
        body: JSON.stringify({ featured }),
      },
    );
    return { ...res, id: res._id || res.id };
  },

  getPublicProjects: async (
    username: string,
    cookie?: string,
  ): Promise<ProjectItem[]> => {
    const raw = await request<Array<ProjectItem & { _id?: string }>>(
      `/projects/public/${encodeURIComponent(username)}`,
      { method: "GET", headers: cookie ? { Cookie: cookie } : undefined },
    );
    return raw.map((item) => ({ ...item, id: item._id || item.id }));
  },

  // Analytics
  getAnalytics: async (
    range: "7d" | "30d" | "90d" = "30d",
  ): Promise<AnalyticsReport> => {
    return request<AnalyticsReport>(`/analytics?range=${range}`, {
      method: "GET",
    });
  },

  /**
   * Records a profile view. Must run in the visitor's browser — the backend
   * de-duplicates by the visitor's own address and user agent.
   */
  trackProfileView: async (
    profileUsername: string,
    referrer?: string,
  ): Promise<void> => {
    await request<void>("/analytics/track", {
      method: "POST",
      body: JSON.stringify({
        profileUsername,
        referrer: referrer || undefined,
      }),
      keepalive: true,
    });
  },

  // Authentication & Account
  updatePassword: async (passwords: {
    currentPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>("/auth/password", {
      method: "PATCH",
      body: JSON.stringify(passwords),
    });
  },

  exportData: async (): Promise<Record<string, unknown>> => {
    return request<Record<string, unknown>>("/auth/export", {
      method: "GET",
    });
  },

  deleteAccount: async (): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>("/auth/account", {
      method: "DELETE",
    });
  },

  // Templates
  getTemplates: async (tag?: string): Promise<TemplateItem[]> => {
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    return request<TemplateItem[]>(`/templates${query}`, { method: "GET" });
  },

  applyTemplate: async (
    templateId: string,
  ): Promise<{ success: boolean; appliedComponents: number }> => {
    return request<{ success: boolean; appliedComponents: number }>(
      `/templates/${templateId}/apply`,
      {
        method: "POST",
      },
    );
  },

  // Integrations
  getIntegrations: async (): Promise<IntegrationItem[]> => {
    return request<IntegrationItem[]>("/integrations", {
      method: "GET",
    });
  },

  getGitHubContent: async (
    username?: string,
  ): Promise<GitHubContentResponse> => {
    const query = username ? `?username=${encodeURIComponent(username)}` : "";
    return request<GitHubContentResponse>(
      `/integrations/github/content${query}`,
      {
        method: "GET",
      },
    );
  },

  /** Providers the backend supports and whether each is configured. */
  getIntegrationProviders: async (): Promise<IntegrationProviderInfo[]> => {
    const res = await request<{ providers: IntegrationProviderInfo[] }>(
      "/integrations/providers",
      { method: "GET" },
    );
    return res.providers ?? [];
  },

  /**
   * URL the browser navigates to in order to connect an OAuth provider.
   * The backend handles the whole authorization flow and redirects back to
   * the integrations page.
   */
  integrationOAuthUrl: (providerId: string): string =>
    `${API_BASE_URL}/integrations/oauth/${encodeURIComponent(providerId)}/start`,

  /**
   * Connects a provider that does not use OAuth: an API key (WakaTime) or a
   * self-declared public profile username (LeetCode, CodeChef, HackerRank).
   */
  connectIntegration: async (data: {
    integrationId: string;
    handle?: string;
    apiKey?: string;
  }): Promise<IntegrationItem> => {
    return request<IntegrationItem>("/integrations/connect", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  disconnectIntegration: async (
    integrationId: string,
  ): Promise<IntegrationItem> => {
    return request<IntegrationItem>(`/integrations/${integrationId}`, {
      method: "DELETE",
    });
  },

  syncIntegration: async (integrationId: string): Promise<IntegrationItem> => {
    return request<IntegrationItem>(`/integrations/${integrationId}/sync`, {
      method: "POST",
    });
  },

  // Changelog
  getChangelog: async (limit = 50, skip = 0): Promise<ChangelogItem[]> => {
    return request<ChangelogItem[]>(`/changelog?limit=${limit}&skip=${skip}`, {
      method: "GET",
    });
  },

  // GitHub test profile preview
  getGitHubTestProfile: async (
    username: string,
  ): Promise<GitHubTestProfileData> => {
    return request<GitHubTestProfileData>(
      `/github-test/profile/${encodeURIComponent(username.trim())}`,
      {
        method: "GET",
      },
    );
  },

  // Account & sessions
  getAccount: async (): Promise<AccountInfo> => {
    return request<AccountInfo>("/auth/account", { method: "GET" });
  },

  getSessions: async (): Promise<SessionInfo[]> => {
    return request<SessionInfo[]>("/auth/sessions", { method: "GET" });
  },

  revokeSession: async (id: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(
      `/auth/sessions/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  // OAuth
  getOAuthProviders: async (): Promise<{
    providers: Array<{ name: string; label: string; configured: boolean }>;
  }> => {
    return request("/auth/oauth/providers", { method: "GET" });
  },

  /** Full URL the browser should be sent to in order to start an OAuth flow. */
  oauthLoginUrl: (provider: string): string =>
    `${API_BASE_URL}/auth/${encodeURIComponent(provider)}`,

  // Media & object storage
  listMedia: async (): Promise<MediaItem[]> => {
    return request<MediaItem[]>("/media", { method: "GET" });
  },

  /** Direct multipart upload through the backend. */
  uploadMedia: async (
    file: File,
    type: MediaItem["type"] = "project",
    projectId?: string,
  ): Promise<MediaItem> => {
    const form = new FormData();
    form.append("file", file);

    const query = new URLSearchParams({ type });
    if (projectId) query.set("projectId", projectId);

    const response = await fetch(
      `${API_BASE_URL}/media/upload?${query.toString()}`,
      {
        method: "POST",
        body: form,
        credentials: "include",
      },
    );

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null
          ? String((data as Record<string, unknown>).message ?? "Upload failed")
          : "Upload failed";
      throw new ApiException(message, response.status, data);
    }

    return data as MediaItem;
  },

  /** Request a presigned URL and upload the file straight to R2. */
  uploadMediaDirect: async (
    file: File,
    type: MediaItem["type"] = "project",
    projectId?: string,
  ): Promise<MediaItem> => {
    const presigned = await request<{
      mediaId: string;
      key: string;
      uploadUrl: string;
      expiresInSeconds: number;
    }>("/media/signed-upload", {
      method: "POST",
      body: JSON.stringify({
        type,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        projectId,
      }),
    });

    const putResponse = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!putResponse.ok) {
      throw new ApiException(
        `Storage rejected the upload (${putResponse.status})`,
        putResponse.status,
      );
    }

    const completed = await request<MediaItem>(
      `/media/${encodeURIComponent(presigned.mediaId)}/complete`,
      { method: "POST" },
    );

    return completed;
  },

  getMedia: async (id: string): Promise<MediaItem> => {
    return request<MediaItem>(`/media/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  },

  deleteMedia: async (id: string): Promise<{ success: boolean }> => {
    return request<{ success: boolean }>(`/media/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** Public components rendered on a user's public profile. */
  getPublicComponents: async (
    username: string,
    cookie?: string,
  ): Promise<ComponentItem[]> => {
    return request<ComponentItem[]>(
      `/components/public/${encodeURIComponent(username)}`,
      { method: "GET", headers: cookie ? { Cookie: cookie } : undefined },
    );
  },
};
