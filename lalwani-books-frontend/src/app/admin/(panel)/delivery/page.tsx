"use client";

import { IntegrationPanel, type IntegrationField } from "../integrations/panel";

const FIELDS: IntegrationField[] = [
  {
    key: "shiprocket_email",
    label: "API user email",
    placeholder: "api@example.com",
    hint: "Not your normal Shiprocket login: in Shiprocket, Settings → API → Configure → Create an API User, with an email different from your account email.",
  },
  {
    key: "shiprocket_password",
    label: "API user password",
    hint: "The password you set for that API user.",
  },
  {
    key: "shiprocket_pickup_location",
    label: "Pickup location",
    placeholder: "Primary",
    hint: "Settings → Pickup Addresses → the nickname exactly as it appears there.",
  },
  {
    key: "shiprocket_pickup_pin",
    label: "Pickup PIN code",
    placeholder: "110001",
    hint: "Used to check whether a customer's PIN is serviceable.",
  },
  {
    key: "shiprocket_channel_id",
    label: "Channel ID",
    hint: "Optional. Leave blank for the default channel.",
  },
];

export default function AdminDelivery() {
  return (
    <IntegrationPanel
      group="delivery"
      title="Delivery"
      blurb="Connects with a Shiprocket API user (your normal Shiprocket login is refused by their API), stored encrypted. With this connected you can push an order for pickup straight from the Orders screen."
      sectionTitle="Shiprocket — delivery partner"
      onLabel="Connected"
      offLabel="Off — dispatch manually"
      fields={FIELDS}
      testLabel="Test Shiprocket login"
    />
  );
}
