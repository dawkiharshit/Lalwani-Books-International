import { getSettings } from "@/lib/settings";
import { ContactView } from "./contact-view";

/**
 * The contact page: the shop's address, phone, hours and questions come with
 * the page (the cached settings read), and only the form runs in the browser.
 * It used to fetch the settings after opening, so it first showed the default
 * details, then jumped as the real ones arrived.
 */
export default async function ContactPage() {
  return <ContactView settings={await getSettings()} />;
}
