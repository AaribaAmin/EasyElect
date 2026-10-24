import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";

export default function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Page not found" subtitle="That page doesn't exist." />
      <Link className="btn btn-primary" to="/">
        Back to home
      </Link>
    </div>
  );
}
