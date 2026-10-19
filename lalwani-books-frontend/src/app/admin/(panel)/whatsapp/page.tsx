"use client";

import { useState } from "react";
import { IntegrationPanel, type IntegrationField } from "../integrations/panel";
import { OrderMessages } from "./order-messages";

const API_FIELDS: IntegrationField[] = [
  {
    key: "aigrowbot_tenant",
    label: "Tenant Subdomain",
    placeholder: "e.g. lalwanibooks",
    hint: "In AiGrowBot → Settings → API Management → API Endpoint Information, press Copy next to “Tenant Subdomain” and paste it here. It is one word — not your business name or email. The “Example Endpoint” address works too.",
  },
  {
    key: "aigrowbot_api_token",
    label: "API Token",
    hint: "In the same place, press Copy next to “API Token” (press Generate New Token first if it is empty). Stored encrypted and never shown again; leave blank to keep the saved one.",
  },
];

const WEBHOOK_FIELDS: IntegrationField[] = [
  {
    key: "aigrowbot_webhook_url",
    label: "Webhook URL",
    placeholder: "https://…",
    hint: "From AiGrowBot: the webhook address of the bot flow that should send the WhatsApp messages. Must start with https://.",
    wide: true,
  },
  {
    key: "aigrowbot_api_username",
    label: "API username",
    hint: "Your AiGrowBot API username.",
  },
  {
    key: "aigrowbot_secret_key",
    label: "Secret key",
    hint: "Your AiGrowBot secret key. Stored encrypted and never shown again; leave blank to keep the saved one.",
  },
];

/** Where the Tenant Subdomain and API Token are found in AiGrowBot. */
function ConnectNote() {
  return (
    <div className="rounded-xl border border-blush-200 bg-blush-50 px-4 py-3.5 text-[12.5px] leading-relaxed text-cocoa">
      <p className="font-semibold text-ink">Where to find these in AiGrowBot</p>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
        <li>
          Open <b>Settings → API Management</b>, switch <b>Enable API Access</b> on and press <b>Save Changes</b>.
        </li>
        <li>
          Under <b>API Token</b>, press <b>Copy</b> (or <b>Generate New Token</b> first, if it is empty) and paste it into
          API Token above.
        </li>
        <li>
          Under <b>API Endpoint Information</b>, press <b>Copy</b> next to <b>Tenant Subdomain</b> and paste it into
          Tenant Subdomain above.
        </li>
        <li>Press Save &amp; load templates.</li>
      </ol>
      <p className="mt-2">
        The token already has the permissions it needs (Template Read and Template Message Send). Loading templates
        only reads them — no message is sent to anyone.
      </p>
    </div>
  );
}

/** What the shop posts to the webhook, so a bot flow can be built in AiGrowBot. */
function WebhookNote() {
  return (
    <div className="rounded-xl border border-blush-200 bg-blush-50 px-4 py-3.5 text-[12.5px] leading-relaxed text-cocoa">
      <p className="font-semibold text-ink">What the shop sends to AiGrowBot</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        <li>
          <b>order.placed</b> when an order is confirmed (cash on delivery at once, online orders once paid), and{" "}
          <b>order.shipped</b>, <b>order.delivered</b>, <b>order.cancelled</b> when its status changes.
        </li>
        <li>
          Each one carries the order number, customer name, WhatsApp number (91 followed by 10 digits), total, items,
          courier and tracking link, so the bot can write the message.
        </li>
        <li>
          It is signed in with the API username and secret key, and signed with an <code>X-Signature</code> header
          (HMAC-SHA256 of the message with the secret key) so AiGrowBot can check it came from this shop.
        </li>
        <li>Only steps without a template above are sent here, so no customer gets the same news twice.</li>
      </ul>
      <p className="mt-2">
        &ldquo;Send test event&rdquo; posts a sample order (LBI-TEST-0001) so you can see it arrive in AiGrowBot.
      </p>
    </div>
  );
}

export default function AdminWhatsApp() {
  // Bumped when the templates are loaded above, so Order messages shows them.
  const [loaded, setLoaded] = useState(0);

  return (
    <div className="flex flex-col gap-8">
      <IntegrationPanel
        group="whatsapp_api"
        disconnect={{ name: "AiGrowBot", note: "No WhatsApp order messages are sent until you connect again." }}
        title="WhatsApp (AiGrowBot)"
        blurb="Sends your customers WhatsApp updates about their orders, using your own approved templates from AiGrowBot."
        sectionTitle="Step 1 · Connect AiGrowBot"
        onLabel="Connected"
        offLabel="Not connected"
        fields={API_FIELDS}
        testLabel="Load templates"
        note={<ConnectNote />}
        onTested={(ok) => ok && setLoaded((n) => n + 1)}
        onChanged={() => setLoaded((n) => n + 1)}
      />

      <OrderMessages reloadKey={loaded} />

      <details className="group rounded-2xl border border-blush-200 bg-white/60 px-6 py-4">
        <summary className="cursor-pointer select-none text-[12.5px] font-semibold text-cocoa">
          Advanced · Webhook to an AiGrowBot bot flow
        </summary>
        <p className="mt-2 text-[12px] leading-relaxed text-fog">
          Only needed if you build your own bot flow in AiGrowBot instead of choosing templates above.
        </p>
        <div className="mt-4">
          <IntegrationPanel
            group="whatsapp"
            disconnect={{ name: "the AiGrowBot webhook", note: "Order updates are not posted to the webhook until you connect again." }}
            title="Webhook"
            blurb=""
            hideHeading
            sectionTitle="AiGrowBot webhook"
            onLabel="Connected"
            offLabel="Off"
            fields={WEBHOOK_FIELDS}
            testLabel="Send test event"
            note={<WebhookNote />}
          />
        </div>
      </details>
    </div>
  );
}
