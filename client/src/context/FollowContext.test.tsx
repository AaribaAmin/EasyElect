import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { FollowProvider, useFollow } from "./FollowContext";
import { readStorage } from "../lib/storage";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <FollowProvider>{children}</FollowProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("FollowContext", () => {
  it("follows and unfollows, persisting to localStorage", () => {
    const { result } = renderHook(() => useFollow(), { wrapper });

    expect(result.current.isFollowing("maura-healey")).toBe(false);

    act(() => result.current.toggleFollow("maura-healey"));
    expect(result.current.isFollowing("maura-healey")).toBe(true);
    expect(result.current.count).toBe(1);
    expect(readStorage<string[]>("follows", [])).toContain("maura-healey");

    act(() => result.current.toggleFollow("maura-healey"));
    expect(result.current.isFollowing("maura-healey")).toBe(false);
    expect(readStorage<string[]>("follows", [])).not.toContain("maura-healey");
  });
});
