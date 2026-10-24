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

    expect(result.current.isFollowing("harper-vega")).toBe(false);

    act(() => result.current.toggleFollow("harper-vega"));
    expect(result.current.isFollowing("harper-vega")).toBe(true);
    expect(result.current.count).toBe(1);
    expect(readStorage<string[]>("follows", [])).toContain("harper-vega");

    act(() => result.current.toggleFollow("harper-vega"));
    expect(result.current.isFollowing("harper-vega")).toBe(false);
    expect(readStorage<string[]>("follows", [])).not.toContain("harper-vega");
  });
});
