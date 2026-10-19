"use client";

import { IntegrationPanel, type IntegrationField } from "../integrations/panel";

const FIELDS: IntegrationField[] = [
  {
    key: "google_client_id",
    label: "Client ID",
    placeholder: "1234567890-abc.apps.googleusercontent.com",
    hint: "Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application).",
  },
  {
    key: "google_client_secret",
    label: "Client Secret",
    hint: "Shown beside the client ID in the same panel. Stored encrypted.",
  },
];

export default function AdminGoogle() {
  return (
    <IntegrationPanel
      group="google"
      disconnect={{ name: "Google sign-in", note: "The “Continue with Google” button disappears from the sign-in pages until you connect again." }}
      title="Sign in with Google"
      blurb="Lets customers sign in with their Google account instead of a password. Google confirms the address, so those accounts skip the email code."
      sectionTitle="Google — customer sign-in"
      onLabel="Button is live"
      offLabel="Off — password only"
      fields={FIELDS}
      testLabel="Check the saved values"
      note={
        <p className="rounded-xl bg-blush-50 px-4 py-2.5 text-[11.5px] leading-relaxed text-cocoa">
          Paste the URL below into the Google console under{" "}
          <span className="text-ink">Authorized redirect URIs</span>. It has to match exactly —
          Google treats <span className="text-ink">localhost</span> and{" "}
          <span className="text-ink">127.0.0.1</span> as different addresses. Leave{" "}
          <span className="text-ink">Authorized JavaScript origins</span> empty; this flow never
          talks to Google from the browser.
        </p>
      }
    />
  );
}
