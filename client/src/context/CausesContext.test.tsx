import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { CausesProvider, useCauses } from "./CausesContext";
import { readStorage } from "../lib/storage";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <CausesProvider>{children}</CausesProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("CausesContext", () => {
  it("adds causes (as the chatbot would) and persists them", () => {
    const { result } = renderHook(() => useCauses(), { wrapper });

    expect(result.current.hasCause("housing")).toBe(false);
    act(() => result.current.addCauses(["housing", "education"]));
    expect(result.current.hasCause("housing")).toBe(true);
    expect(result.current.activeIds).toEqual(
      expect.arrayContaining(["housing", "education"])
    );
    expect(readStorage("causes", {})).toHaveProperty("housing");
  });

  it("toggles refinements on a cause", () => {
    const { result } = renderHook(() => useCauses(), { wrapper });
    act(() => result.current.addCause("housing"));
    act(() => result.current.toggleRefinement("housing", "Affordable rentals"));
    expect(result.current.activeCauses.housing).toContain("Affordable rentals");
    act(() => result.current.toggleRefinement("housing", "Affordable rentals"));
    expect(result.current.activeCauses.housing).not.toContain(
      "Affordable rentals"
    );
  });

  it("removes a cause", () => {
    const { result } = renderHook(() => useCauses(), { wrapper });
    act(() => result.current.addCause("climate"));
    act(() => result.current.removeCause("climate"));
    expect(result.current.hasCause("climate")).toBe(false);
  });
});
