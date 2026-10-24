import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../../lib/api";
import { useSettings } from "../../context/SettingsContext";
import { useCauses } from "../../context/CausesContext";
import Icon from "../icons/Icon";
import styles from "./Chatbot.module.css";

/**
 * Ask Easy Elect — the persistent assistant anchored to the bottom of every
 * page.
 *
 * Sends messages to POST /api/chat with the current detail mode, shows the
 * reply, and adds any causes the backend detected to the user's Causes page
 * (Task 11). Works with or without a real LLM configured (Task 13): the server
 * returns a scripted reply when no key is set.
 */
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  addedCauses?: boolean;
}

interface ChatApiResponse {
  reply: string;
  detectedCauses: string[];
  source: "ai" | "scripted";
}

export default function Chatbot() {
  const { mode } = useSettings();
  const { addCauses } = useCauses();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setOpen(true);
    setBusy(true);

    try {
      const res = await apiPost<ChatApiResponse>("/api/chat", {
        message: text,
        mode,
      });
      if (res.detectedCauses.length > 0) {
        addCauses(res.detectedCauses);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.reply,
          addedCauses: res.detectedCauses.length > 0,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Sorry, I couldn't reach the server just now. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.bar} aria-label="Ask Easy Elect assistant">
      {open && (
        <div className={styles.panel} role="log" aria-live="polite">
          {messages.length === 0 ? (
            <p className={styles.empty}>
              Ask me anything about the Massachusetts primary — candidates,
              issues, or how to vote. Tell me what you care about and I'll build
              your Causes.
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? styles.userMsg : styles.botMsg}
              >
                {m.text}
                {m.addedCauses && (
                  <div className={styles.causeHint}>
                    <Link to="/causes">View your Causes →</Link>
                  </div>
                )}
              </div>
            ))
          )}
          {busy && <div className={styles.botMsg}>Thinking…</div>}
        </div>
      )}

      <form className={styles.inputRow} onSubmit={handleSubmit}>
        <button
          type="button"
          className={styles.expandBtn}
          aria-expanded={open}
          aria-label={open ? "Collapse chat" : "Expand chat"}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="chat" decorative />
        </button>
        <label htmlFor="chat-input" className="visually-hidden">
          Ask Easy Elect
        </label>
        <input
          id="chat-input"
          className={styles.input}
          placeholder="Ask Easy Elect…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        <button type="submit" className={styles.sendBtn} disabled={busy}>
          Send
        </button>
      </form>
    </section>
  );
}
