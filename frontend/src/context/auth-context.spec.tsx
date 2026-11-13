import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./auth-context";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

describe("AuthContext & AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks session on mount and sets user when valid", async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce({
      user: { id: "user_1", email: "alex@stackly.dev" },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual({
        id: "user_1",
        email: "alex@stackly.dev",
      });
    });
  });

  it("sets user to null when getMe fails on mount", async () => {
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error("Unauthorized"));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  it("login updates user state upon success", async () => {
    vi.mocked(api.getMe).mockRejectedValueOnce(new Error("Unauthorized"));
    vi.mocked(api.login).mockResolvedValueOnce({
      user: { id: "user_2", email: "logged_in@stackly.dev" },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("logged_in@stackly.dev", "password123");
    });

    expect(result.current.user).toEqual({
      id: "user_2",
      email: "logged_in@stackly.dev",
    });
  });

  it("logout destroys user state", async () => {
    vi.mocked(api.getMe).mockResolvedValueOnce({
      user: { id: "user_1", email: "alex@stackly.dev" },
    });
    vi.mocked(api.logout).mockResolvedValueOnce({ success: true });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).not.toBeNull());

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
  });
});
