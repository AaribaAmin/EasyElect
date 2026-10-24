/**
 * Tracks which candidates the user follows. No login, so follows live in
 * localStorage. The Tweets section (Task 9) reads this to tune the feed.
 */
import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useLocalStorage } from "../lib/storage";

export interface FollowContextValue {
  following: string[];
  isFollowing: (candidateId: string) => boolean;
  toggleFollow: (candidateId: string) => void;
  count: number;
}

const FollowContext = createContext<FollowContextValue | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const [following, setFollowing] = useLocalStorage<string[]>("follows", []);

  const toggleFollow = useCallback(
    (candidateId: string) => {
      setFollowing((prev) =>
        prev.includes(candidateId)
          ? prev.filter((id) => id !== candidateId)
          : [...prev, candidateId]
      );
    },
    [setFollowing]
  );

  const value = useMemo<FollowContextValue>(
    () => ({
      following,
      isFollowing: (id: string) => following.includes(id),
      toggleFollow,
      count: following.length,
    }),
    [following, toggleFollow]
  );

  return (
    <FollowContext.Provider value={value}>{children}</FollowContext.Provider>
  );
}

export function useFollow(): FollowContextValue {
  const ctx = useContext(FollowContext);
  if (!ctx) {
    throw new Error("useFollow must be used within a FollowProvider");
  }
  return ctx;
}
