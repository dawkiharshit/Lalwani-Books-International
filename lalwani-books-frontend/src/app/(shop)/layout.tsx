import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { VoiceQueryButton } from "@/components/voice/VoiceQueryButton";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    // overflow-x-clip: PageBanner bleeds to the window edges from inside the
    // page-width wrapper, and 100vw includes the scrollbar.
    <div className="flex min-h-screen w-full flex-col overflow-x-clip">
      <AnnouncementBar />
      <SiteHeader />
      <main className="container-shop flex-1 pt-8 pb-20">{children}</main>
      <Footer />
      <WhatsAppButton />
      <VoiceQueryButton />
    </div>
  );
}
