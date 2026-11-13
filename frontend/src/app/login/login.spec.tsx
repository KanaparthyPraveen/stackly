import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoginForm } from "./login-form";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockGetOAuthProviders = vi.fn();
const mockGetMyProfile = vi.fn();

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: mockLogin,
    register: mockRegister,
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getOAuthProviders: () => mockGetOAuthProviders(),
    getMyProfile: () => mockGetMyProfile(),
    oauthLoginUrl: (provider: string) =>
      `http://localhost:3001/api/v1/auth/${provider}`,
  },
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("error");
    mockGetOAuthProviders.mockResolvedValue({
      providers: [
        { name: "github", label: "GitHub", configured: true },
        { name: "google", label: "Google", configured: true },
      ],
    });
    mockGetMyProfile.mockResolvedValue({
      username: "alice",
      displayName: "Alice",
      usernameClaimed: true,
    });
  });

  it("renders the welcome headline", async () => {
    render(<LoginForm />);
    expect(screen.getByRole("heading", { name: /welcome to/i })).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue with github/i }),
      ).toBeTruthy();
    });
  });

  it("shows a button for every configured OAuth provider", async () => {
    render(<LoginForm />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue with github/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /continue with google/i }),
      ).toBeTruthy();
    });
  });

  it("hides providers that are not configured on the server", async () => {
    mockGetOAuthProviders.mockResolvedValue({
      providers: [
        { name: "github", label: "GitHub", configured: true },
        { name: "google", label: "Google", configured: false },
      ],
    });
    render(<LoginForm />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /continue with github/i }),
      ).toBeTruthy();
    });
    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).toBeNull();
  });

  it("signs in with email and password and routes to the dashboard", async () => {
    mockLogin.mockResolvedValue({ id: "1", email: "a@b.com" });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("a@b.com", "supersecret");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to /claim-username if user has not claimed a custom username", async () => {
    mockLogin.mockResolvedValue({ id: "1", email: "a@b.com" });
    mockGetMyProfile.mockResolvedValue({
      username: "user_123456",
      usernameClaimed: false,
    });
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "supersecret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("a@b.com", "supersecret");
      expect(mockPush).toHaveBeenCalledWith("/claim-username");
    });
  });

  it("shows an error banner when sign-in fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid email or password"));
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Invalid email or password",
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not show the error banner in the idle state", () => {
    render(<LoginForm />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
