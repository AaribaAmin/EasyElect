import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import VotingPage from "./pages/VotingPage";
import TweetsPage from "./pages/TweetsPage";
import CausesPage from "./pages/CausesPage";
import ConnectPage from "./pages/ConnectPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/voting/*" element={<VotingPage />} />
        <Route path="/tweets" element={<TweetsPage />} />
        <Route path="/causes" element={<CausesPage />} />
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
