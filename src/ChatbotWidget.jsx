import React, { useEffect, useRef, useState } from "react";

const STARTERS = {
  student: [
    "My attendance summary",
    "How many times was I absent?",
    "What is my schedule today?",
    "When is my next class?",
  ],
  teacher: [
    "Who is absent today?",
    "Which students have the most absences?",
    "What is my schedule today?",
    "When is my next class?",
  ],
  admin: [
    "Who is absent today?",
    "Which students have the most absences?",
    "Who entered the gate today?",
    "How many students are there?",
  ],
};

function BotTable({ table }) {
  if (!table || !table.rows || table.rows.length === 0) return null;

  return (
    <div className="chatbot-table-wrap">
      <table>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChatbotWidget({ api, role, firstName }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState(() => [
    {
      from: "bot",
      text: `Hi${firstName ? ` ${firstName}` : ""}! I'm the attendance assistant. Ask me about attendance, absences, or schedules. Type "help" to see what I can do.`,
      suggestions: STARTERS[role] || STARTERS.student,
    },
  ]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus();
    }
  }, [messages, open, busy]);

  const send = async (text) => {
    const message = String(text ?? input).trim();
    if (!message || busy) return;

    setInput("");
    setMessages((current) => [
      // Old suggestion chips disappear once the next question is asked.
      ...current.map((item) => ({ ...item, suggestions: [] })),
      { from: "user", text: message },
    ]);
    setBusy(true);

    try {
      const data = await api("/api/chatbot/ask", {
        method: "POST",
        body: JSON.stringify({ message }),
      });

      setMessages((current) => [
        ...current,
        {
          from: "bot",
          text: data.reply?.text || "…",
          table: data.reply?.table || null,
          suggestions: data.reply?.suggestions || [],
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          from: "bot",
          error: true,
          text: err.message || "I could not answer that. Please try again.",
          suggestions: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chatbot">
      {open && (
        <section className="chatbot-panel" aria-label="Attendance assistant">
          <header className="chatbot-head">
            <div>
              <strong>Attendance Assistant</strong>
              <small>Ask about attendance &amp; schedules</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="chatbot-messages">
            {messages.map((item, index) => (
              <div key={index} className={`chatbot-row chatbot-row-${item.from}`}>
                <div className={`chatbot-bubble ${item.error ? "chatbot-bubble-error" : ""}`}>
                  <p>{item.text}</p>
                  <BotTable table={item.table} />
                </div>

                {item.suggestions?.length > 0 && (
                  <div className="chatbot-chips">
                    {item.suggestions.map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => send(suggestion)} disabled={busy}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="chatbot-row chatbot-row-bot">
                <div className="chatbot-bubble chatbot-typing" aria-label="Typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            className="chatbot-form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. send me a summary of Jamie's absences"
              maxLength={300}
              autoComplete="off"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="chatbot-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close assistant" : "Open attendance assistant"}
      >
        {open ? (
          "×"
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
            <circle cx="8.5" cy="11" r="1" />
            <circle cx="12" cy="11" r="1" />
            <circle cx="15.5" cy="11" r="1" />
          </svg>
        )}
      </button>
    </div>
  );
}
