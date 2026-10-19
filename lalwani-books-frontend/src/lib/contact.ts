/** The shop's WhatsApp, as wa.me wants it (country code, no "+"), and as people read it. */
export const WHATSAPP_NUMBER = "919811232113";
export const WHATSAPP_DISPLAY = "+91 98112 32113";

/** A chat with the shop on WhatsApp, with `text` already typed. */
export const whatsappLink = (text: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
