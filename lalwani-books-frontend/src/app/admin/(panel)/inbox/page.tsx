"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi, ApiError } from "@/admin/lib/api";
import { formatDate } from "@/admin/lib/format";
import { Spinner } from "@/admin/components/ui";
import { Attachments, type Attachment } from "./attachments";
import { MESSAGES_CHANGED } from "./events";

interface Message {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  /** A reading list sent with a quote request; empty for other messages. */
  attachments?: Attachment[];
}

interface Subscriber {
  id: number;
  email: string;
  created_at: string;
}

export default function AdminInbox() {
  const [tab, setTab] = useState<"messages" | "subscribers">("messages");
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [unread, setUnread] = useState(0);
  // Two independent loads, so two errors — one tab failing says nothing about
  // the other.
  const [messagesError, setMessagesError] = useState("");
  const [subscribersError, setSubscribersError] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: Message[]; meta: { unread: number } }>("/admin/messages")
      .then((res) => {
        setMessages(res.data);
        setUnread(res.meta.unread);
        setMessagesError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no messages.
         */
        setMessages([]);
        setMessagesError(
          err instanceof ApiError
            ? `Could not load messages: ${err.message}`
            : "Could not load messages. Check that the API is running."
        );
      });
    clientApi<{ data: Subscriber[] }>("/admin/subscribers")
      .then((res) => {
        setSubscribers(res.data);
        setSubscribersError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no subscribers.
         */
        setSubscribers([]);
        setSubscribersError(
          err instanceof ApiError
            ? `Could not load subscribers: ${err.message}`
            : "Could not load subscribers. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(m: Message, read: boolean) {
    await clientApi(`/admin/messages/${m.id}`, { method: "PUT", body: { is_read: read } });
    load();
    // Keeps the count in the sidebar in step with this list.
    window.dispatchEvent(new Event(MESSAGES_CHANGED));
  }

  async function removeMessage(m: Message) {
    if (!confirm("Delete this message?")) return;
    await clientApi(`/admin/messages/${m.id}`, { method: "DELETE" });
    load();
    window.dispatchEvent(new Event(MESSAGES_CHANGED));
  }

  async function removeSubscriber(s: Subscriber) {
    if (!confirm(`Remove ${s.email} from the newsletter?`)) return;
    await clientApi(`/admin/subscribers/${s.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[1.6rem] text-ink">Inbox</h1>
        <div className="flex gap-1.5">
          <button
            onClick={() => setTab("messages")}
            className={`rounded-full px-4 py-1.5 text-[12px] ${
              tab === "messages" ? "bg-rose-600 text-white" : "bg-white text-cocoa hover:bg-blush-100"
            }`}
          >
            Contact messages{unread > 0 && ` (${unread} new)`}
          </button>
          <button
            onClick={() => setTab("subscribers")}
            className={`rounded-full px-4 py-1.5 text-[12px] ${
              tab === "subscribers" ? "bg-rose-600 text-white" : "bg-white text-cocoa hover:bg-blush-100"
            }`}
          >
            Newsletter{subscribers ? ` (${subscribers.length})` : ""}
          </button>
        </div>
      </div>

      {(tab === "messages" ? messagesError : subscribersError) && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {tab === "messages" ? messagesError : subscribersError}
        </p>
      )}

      {tab === "messages" ? (
        !messages ? (
          <div className="card flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading...
          </div>
        ) : messages.length === 0 ? (
          <p className="card px-6 py-10 text-center text-[13px] text-fog">No contact messages yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <article key={m.id} className={`card px-6 py-5 ${m.is_read ? "" : "ring-1 ring-rose-300"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[13px] font-semibold text-ink">{m.name}</p>
                  {/* A quote request can arrive with a phone number instead of
                      an email; the number is in the message itself. */}
                  {m.email ? (
                    <a href={`mailto:${m.email}`} className="text-[12px] text-rose-600 hover:underline">
                      {m.email}
                    </a>
                  ) : (
                    <span className="text-[12px] text-fog">No email — see the phone number below</span>
                  )}
                  <span className="text-[11px] text-fog">{formatDate(m.created_at)}</span>
                  {!m.is_read && (
                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                      New
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => markRead(m, !m.is_read)}
                      className="rounded-full border border-blush-200 px-4 py-1 text-[12px] text-cocoa hover:bg-blush-100"
                    >
                      Mark {m.is_read ? "unread" : "read"}
                    </button>
                    <button
                      onClick={() => removeMessage(m)}
                      className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {m.subject && <p className="mt-2 text-[13px] font-medium text-cocoa">{m.subject}</p>}
                <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-cocoa">{m.message}</p>
                {m.attachments && m.attachments.length > 0 && <Attachments messageId={m.id} files={m.attachments} />}
              </article>
            ))}
          </div>
        )
      ) : !subscribers ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : subscribers.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[13px] text-fog">No subscribers yet.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wider text-fog">
                <th className="px-6 py-3">Email</th>
                <th className="px-4 py-3">Subscribed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-blush-100 last:border-0">
                  <td className="px-6 py-3 text-ink">{s.email}</td>
                  <td className="px-4 py-3 text-cocoa">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => removeSubscriber(s)} className="text-[12px] text-red-500 hover:underline">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
