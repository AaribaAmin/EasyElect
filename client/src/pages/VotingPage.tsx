import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import CandidatesList from "../features/voting/CandidatesList";
import CandidateDetail from "../features/voting/CandidateDetail";
import HowVotingWorks from "../features/voting/HowVotingWorks";
import IssuesExplorer from "../features/voting/IssuesExplorer";
import CompareCandidates from "../features/voting/CompareCandidates";
import MatchQuiz from "../features/voting/MatchQuiz";
import styles from "../features/voting/Voting.module.css";

const TABS = [
  { to: "/voting/candidates", label: "Candidates" },
  { to: "/voting/issues", label: "Issues" },
  { to: "/voting/compare", label: "Compare" },
  { to: "/voting/quiz", label: "Find your match" },
  { to: "/voting/how-voting-works", label: "How voting works" },
];

export default function VotingPage() {
  return (
    <div>
      <PageHeader
        icon="voting"
        title="Voting"
        subtitle="Get to know who's on your ballot, what they stand for, and how to cast your vote."
      />

      <nav className={styles.subnav} aria-label="Voting sections">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<Navigate to="candidates" replace />} />
        <Route path="candidates" element={<CandidatesList />} />
        <Route path="candidates/:id" element={<CandidateDetail />} />
        <Route path="issues" element={<IssuesExplorer />} />
        <Route path="compare" element={<CompareCandidates />} />
        <Route path="quiz" element={<MatchQuiz />} />
        <Route path="how-voting-works" element={<HowVotingWorks />} />
      </Routes>
    </div>
  );
}
