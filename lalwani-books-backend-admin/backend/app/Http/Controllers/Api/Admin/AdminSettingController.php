<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\CheckoutController;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Http\Request;

/**
 * Store settings — key-value Setting model ported from arpita. Commerce math
 * (checkout) and storefront copy read these; class constants are the defaults.
 */
class AdminSettingController extends Controller
{
    /**
     * Starting text for the two legal pages, both linked from every footer.
     *
     * A storefront that ships with these blank has a real gap: Razorpay and
     * most gateways expect them to exist before they will approve an account.
     * This is a working draft, not legal advice — the bracketed placeholders
     * must be filled in and the whole thing reviewed before launch. Edit in
     * admin → Pages; anything saved there replaces this entirely.
     */
    private const PRIVACY_POLICY = <<<'TEXT'
        Last updated: [date]

        This policy explains what Lalwani Books International collects when you shop with us, why we
        collect it, and what we do with it.

        WHAT WE COLLECT
        - Contact details you give us: name, email address, phone number.
        - Delivery details: the shipping and billing address on your order.
        - Order history: what you bought, when, and what you paid.
        - Account details: your password, stored only as a one-way hash we cannot read.
        - Technical data: IP address, browser and device type, and the pages you visit.

        We never see or store your full card number. Payments are handled entirely by
        our payment gateway on their own systems.

        WHY WE COLLECT IT
        - To take payment, pack your order and deliver it.
        - To email you order confirmations and delivery updates.
        - To answer questions you send us.
        - To detect and prevent fraud.
        - To send marketing email, but only if you asked for it. Every such email has
          an unsubscribe link, and unsubscribing does not affect your orders.

        WHO WE SHARE IT WITH
        We share only what a partner needs to do its job:
        - The payment gateway, to process your payment.
        - Our courier and logistics partners, to deliver your parcel.
        - Our email provider, to send order and account email.
        We do not sell your personal data.

        HOW LONG WE KEEP IT
        Order and invoice records are kept as long as tax law requires. Account data is
        kept until you ask us to delete it. Marketing consent is kept until you withdraw it.

        YOUR CHOICES
        You can ask us to show you the data we hold, correct it, delete it, or stop
        sending marketing. Write to [support email] and we will respond within 30 days.
        Deleting your account does not remove invoices we must keep by law.

        COOKIES
        We use cookies to keep you signed in and to remember your cart. Blocking them
        will stop the cart and sign-in from working.

        CONTACT
        [Company legal name]
        [Registered address]
        [Support email] · [Support phone]
        TEXT;

    private const TERMS = <<<'TEXT'
        Last updated: [date]

        These terms apply whenever you order from Lalwani Books International. Placing an order means
        you accept them.

        ORDERS
        Your order is an offer to buy. It is accepted once we email you a confirmation.
        We may decline an order if an item is out of stock, a price was listed in error,
        or we cannot verify the payment or delivery address.

        PRICES AND PAYMENT
        All prices are in Indian Rupees and include applicable taxes unless stated
        otherwise. Delivery charges, where they apply, are shown before you pay.
        Payment is taken at checkout through our payment gateway.

        DISCOUNT CODES
        One code per order unless we say otherwise. Codes have no cash value, may be
        limited to certain products, and may be withdrawn at any time. A code entered
        after an order is placed cannot be applied retrospectively.

        DELIVERY
        Delivery timelines shown at checkout are estimates, not guarantees, and depend
        on our courier partners. Risk passes to you on delivery. If a parcel arrives
        damaged, tell us within 48 hours with photographs.

        RETURNS AND REFUNDS
        Unopened items in their original packaging may be returned within [return window] days
        of delivery. Books that have been read, marked or damaged after delivery cannot
        be accepted unless they arrived damaged, misprinted or faulty. Approved refunds go back to
        the original payment method within [refund days] business days.

        PRODUCT INFORMATION
        We describe our products as accurately as we can, but colours vary between
        screens and editions or print runs can differ slightly. Nothing we sell is a
        medicine, and nothing on this site is medical advice. Patch test before first
        use and read the ingredient list if you have allergies.

        ACCOUNTS
        Keep your password to yourself. You are responsible for what happens under your
        account. Tell us straight away if you think someone else has access to it.

        INTELLECTUAL PROPERTY
        The Lalwani Books International name, logo, product photography and site copy belong to us and
        may not be reused without written permission.

        LIABILITY
        Nothing here limits liability that cannot be limited by law. Otherwise our
        liability for any order is limited to what you paid for that order.

        GOVERNING LAW
        These terms are governed by the laws of India, and the courts of
        [city, state] have exclusive jurisdiction.

        CONTACT
        [Company legal name]
        [Registered address]
        [Support email] · [Support phone]
        TEXT;

    /** The editable keys and their defaults. */
    public static function defaults(): array
    {
        return [
            'free_shipping_threshold' => (string) CheckoutController::FREE_SHIPPING_THRESHOLD,
            'flat_shipping' => (string) CheckoutController::FLAT_SHIPPING,
            // Added to the live courier rate so the customer covers Shiprocket's
            // "Secure Shipment" insurance — a flat ~₹54 per shipment the rate API
            // doesn't report. Flat (not %) because the fee is flat. ₹60 leaves a
            // small margin; set both to 0 if you turn Secure Shipment off.
            'shipping_buffer_flat' => '60',
            'shipping_buffer_percent' => '0',
            'tax_rate' => (string) CheckoutController::TAX_RATE,
            // Cash on delivery — offered unless the admin switches it off.
            'cod_enabled' => CheckoutController::COD_ENABLED_DEFAULT,
            // Maintenance mode — '1' shows an "under maintenance" page across the
            // storefront (the admin panel and login stay reachable to switch it off).
            'maintenance_mode' => '0',
            'support_email' => 'hello@lalwanibooks.com',
            'support_phone' => '+91 98765 43210',
            // Studio details for the contact page. Address starts empty so the
            // page hides the block rather than showing an invented address.
            'contact_studio' => 'Lalwani Books International',
            'contact_address' => '',
            'contact_hours' => 'Mon–Sat, 10am–7pm IST',
            'contact_map_url' => '',
            // The questions on the contact page. {free_shipping} and
            // {flat_shipping} become the live amounts from Shipping & Tax, so
            // the answer never goes stale when the rates change.
            'contact_faq_1_question' => 'How much does delivery cost?',
            'contact_faq_1_answer' => 'Delivery is free on orders over {free_shipping} — below that it is a flat {flat_shipping}. We ship across India.',
            'contact_faq_2_question' => 'Can I return a book?',
            'contact_faq_2_answer' => 'Yes — if a book arrives damaged, misprinted or is not what you ordered. Request a return from your order page and see our returns policy for the details.',
            'contact_faq_3_question' => 'Do you take bulk or institutional orders?',
            'contact_faq_3_answer' => 'Yes. Schools, colleges, libraries and businesses can send us their list using this form (choose “Bulk / institutional order”) and we will reply with availability and pricing.',
            'contact_faq_4_question' => 'Can you find a book that is not listed?',
            'contact_faq_4_answer' => 'Often, yes. Send us the title, author and ISBN if you have it, and we will check with our publishers and distributors.',
            // Invoice / GST details printed on every invoice
            'invoice_prefix' => 'INV',
            'invoice_seller_name' => '',
            'invoice_gstin' => '',
            'invoice_address' => '',
            'invoice_state' => '',
            'invoice_email' => '',
            'invoice_phone' => '',
            'invoice_terms' => 'Goods once sold are only returned per our returns policy. This is a computer-generated invoice.',
            // Where returns come back to — Shiprocket books the reverse pickup
            // against this. Blank fields fall back to the invoice details.
            'return_name' => '',
            'return_address' => '',
            'return_city' => '',
            'return_state' => '',
            'return_pincode' => '',
            'return_phone' => '',
            'announcement' => '',
            // Read-only for the storefront: how to render money everywhere.
            'currency' => config('shop.currency'),
            'currency_code' => config('shop.currency_code'),
            'locale' => config('shop.locale'),
            'tax_label' => config('shop.tax_label'),
            'currency_decimals' => (string) config('shop.decimals'),
            // Social links (footer) — arpita AdminSocialController port
            // Footer social links — blank means the icon is hidden.
            'social_instagram' => '',
            'social_facebook' => '',
            'social_youtube' => '',
            'social_x' => '',
            'social_telegram' => '',

            // Branding (arpita AdminBrandingController port)
            'site_name' => 'Lalwani Books International',
            'site_logo' => '/images/brand/logo.svg',
            'site_favicon' => '',
            'site_tagline' => 'Books for every reader — publishing and distribution since day one.',

            // Home / site-wide SEO. Blank = fall back to the built-in defaults
            // in the storefront's generateMetadata. Managed from admin or seo.php.
            'seo_home_title' => '',
            'seo_home_description' => '',
            'seo_home_keywords' => '',
            'seo_og_title' => '',
            'seo_og_description' => '',
            'seo_og_image' => '',
            'seo_canonical' => '',

            // Stats counter strip (arpita AdminStatsController port)
            'stats_1_value' => '5000', 'stats_1_suffix' => '+', 'stats_1_label' => 'Titles in Stock',
            'stats_2_value' => '200', 'stats_2_suffix' => '+', 'stats_2_label' => 'Publishers',
            'stats_3_value' => '48', 'stats_3_suffix' => 'h', 'stats_3_label' => 'Average Dispatch',
            'stats_4_value' => '100', 'stats_4_suffix' => '%', 'stats_4_label' => 'Genuine Editions',
            'stats_enabled' => '0',

            // CTA banner (arpita AdminCTABannerController port)
            // Home page spotlight — one product shown full width above the
            // reviews, with its own price, size and add-to-bag.
            'spotlight_enabled' => '0',
            'spotlight_product_slug' => '',
            'spotlight_eyebrow' => 'This month',
            'spotlight_heading' => '',
            'spotlight_note' => '',

            'cta_banner_enabled' => '0',
            'cta_banner_eyebrow' => '',
            'cta_banner_heading' => '',
            'cta_banner_description' => '',
            'cta_banner_button_text' => '',
            'cta_banner_button_url' => '',

            // Home page — admin → Home Page. One switch per section, plus the
            // headings and the texts that used to be fixed in the storefront.
            'home_bestsellers_enabled' => '1',
            'home_bestsellers_title' => 'Bestselling Books',
            'home_deals_enabled' => '1',
            'home_deals_title' => 'Deals Of The Week',
            'home_trend_enabled' => '1',
            'home_trend_title' => 'What\'s In Trend',
            'home_new_enabled' => '1',
            'home_new_title' => 'New Arrivals',
            'home_genres_enabled' => '1',
            'home_genres_title' => 'Browse By Genre',
            'home_rails_enabled' => '1',
            'home_authors_enabled' => '1',
            'home_authors_title' => 'Popular Authors',
            'home_reading_enabled' => '1',
            'home_reading_title' => 'Keep Reading',
            // The stat cards live on the About page.
            'about_stats_enabled' => '1',
            'about_testimonials_enabled' => '1',
            'home_testimonials_enabled' => '1',
            'home_testimonials_title' => 'What readers say',
            'home_blog_enabled' => '1',
            'home_blog_title' => 'From The Blog',
            'home_instagram_title' => 'Follow Us On Instagram',
            // Authors with a photo join the round shortcut links under the hero.
            'home_author_circles_enabled' => '1',
            'home_deals_eyebrow' => 'This week only',
            'home_deals_heading' => 'Save up to {discount}% on books',
            'home_deals_text' => 'Hand-picked titles at reduced prices. Hurry — the deals run out soon.',
            'home_deals_ends' => 'Ends Sunday midnight',
            'newsletter_enabled' => '1',
            'newsletter_title' => 'Subscribe to our newsletter',
            'newsletter_text' => 'New arrivals, reading lists and offers — straight to your inbox.',

            // Gifting band on the home page
            'gift_enabled' => '1',
            'gift_eyebrow' => 'Made to be given',
            'gift_heading' => 'Give the Gift of Reading',
            'gift_body' => 'Every gift order ships carefully packed with a note card, ready to hand over.',
            'gift_button_text' => 'Browse Gift Ideas',
            'gift_button_url' => '/collection',

            // Email-capture popup (arpita AdminPopupController port)
            'popup_enabled' => '0',
            'popup_delay_seconds' => '6',
            'popup_show_once' => '1',
            'popup_title' => 'Join our reading list',
            'popup_subtitle' => 'Be first to hear about new arrivals and offers.',
            'popup_discount' => '10% OFF',
            'popup_button' => 'Subscribe',
            'popup_disclaimer' => 'No spam. Unsubscribe anytime.',
            // Set through admin/settings/image/popup_image, never typed in.
            'popup_image' => '',

            // About — home section. Defaults carry the copy that used to be
            // hardcoded in the component, so the admin sees and edits the real text.
            'about_home_eyebrow' => 'Who we are',
            'about_home_title' => 'About Lalwani Books International',
            'about_home_body1' => 'Lalwani Books International brings readers, students and institutions the books they need — from academic texts to general reading — sourced from publishers in India and abroad.',
            'about_home_body2' => 'Every title we stock is a genuine edition, packed with care and dispatched quickly, so the right book reaches the right reader.',
            'about_pillar_1_value' => '7', 'about_pillar_1_label' => 'Subjects covered',
            'about_pillar_2_value' => '100%', 'about_pillar_2_label' => 'Genuine editions',
            'about_pillar_3_value' => 'Pan-India', 'about_pillar_3_label' => 'Delivery',

            // About page — hero (arpita AdminAboutController port)
            'about_hero_image' => '',
            'about_hero_highlight' => 'Every Reader',
            'about_hero_eyebrow' => 'Our Story',
            'about_hero_title' => 'Books for Every Reader',
            'about_hero_subtitle' => 'Lalwani Books International connects readers, students, schools and libraries with books from publishers across India and around the world.',
            'about_hero_note' => 'Today, every Lalwani Books International order is packed by people who love books as much as you do.',

            // About page — the four value cards (icons stay in code)
            'about_values_eyebrow' => 'Why choose us',
            'about_values_title' => 'What every order gets',
            'about_value_1_title' => 'Genuine Editions',
            'about_value_1_body' => 'Every book is sourced directly from publishers and authorised distributors — never pirated copies.',
            'about_value_2_title' => 'Wide Catalogue',
            'about_value_2_body' => 'Academic, professional, children\'s and general titles, in Indian and international editions.',
            'about_value_3_title' => 'Careful Packing',
            'about_value_3_body' => 'Books are wrapped and boxed so they arrive in the condition they left our shelves.',
            'about_value_4_title' => 'Bulk & Institutional Orders',
            'about_value_4_body' => 'Schools, colleges and libraries get dedicated support for bulk and recurring orders.',

            // About page — craft band

            // About page — founder block
            'about_founder_image' => '',
            'about_home_image_1' => '',
            'about_home_image_2' => '',
            'about_home_image_3' => '',
            'about_founder_eyebrow' => 'The Founder',
            'about_founder_heading' => 'Meet the Founder',
            'about_founder_highlight' => 'Founder',
            'about_founder_name' => '',
            'about_founder_role' => 'Founder',
            'about_founder_story' => '',

            'about_quote_text' => '',
            'about_quote_author' => '',
            'about_quote_role' => '',

            // Static pages (arpita AdminPageController port)
            'page_faq' => '',
            'page_privacy' => self::fillKnown(self::PRIVACY_POLICY),
            'page_terms' => self::fillKnown(self::TERMS),
        ];
    }

    /**
     * Fills the placeholders the app already knows the answer to.
     *
     * The return window matters most: it is stated in the Terms, enforced by
     * Order::RETURN_WINDOW_DAYS, and shown on the order confirmation. Wiring it
     * to the constant stops the legal page promising a window the code refuses.
     * The support address comes from settings for the same reason.
     *
     * What is left bracketed is deliberate — company legal name, registered
     * address, support phone, jurisdiction and the revision date are facts about
     * the business that only its owner can supply, and a Terms page that invents
     * them is worse than one that visibly asks for them.
     */
    private static function fillKnown(string $text): string
    {
        $support = Setting::get('support_email', '');

        return strtr($text, [
            '[return window]' => (string) Order::RETURN_WINDOW_DAYS,
            '[refund days]' => (string) Order::REFUND_DAYS,
            '[support email]' => $support !== '' ? $support : '[support email]',
            '[Support email]' => $support !== '' ? $support : '[Support email]',
        ]);
    }

    public function index()
    {
        $out = [];
        foreach (self::defaults() as $key => $default) {
            $out[$key] = Setting::get($key, $default);
        }

        return response()->json(['data' => $out]);
    }

    public function update(Request $request)
    {
        $rules = [
            'free_shipping_threshold' => ['nullable', 'numeric', 'min:0'],
            'flat_shipping' => ['nullable', 'numeric', 'min:0'],
            'shipping_buffer_percent' => ['nullable', 'numeric', 'min:0', 'max:20'],
            'shipping_buffer_flat' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'cod_enabled' => ['nullable', 'in:0,1'],
            'maintenance_mode' => ['nullable', 'in:0,1'],
            'support_email' => ['nullable', 'email', 'max:190'],
            'support_phone' => ['nullable', 'string', 'max:30'],
            'contact_studio' => ['nullable', 'string', 'max:120'],
            'contact_address' => ['nullable', 'string', 'max:300'],
            'contact_hours' => ['nullable', 'string', 'max:120'],
            'contact_map_url' => ['nullable', 'string', 'max:500'],
            'contact_faq_1_question' => ['nullable', 'string', 'max:200'],
            'contact_faq_1_answer' => ['nullable', 'string', 'max:800'],
            'contact_faq_2_question' => ['nullable', 'string', 'max:200'],
            'contact_faq_2_answer' => ['nullable', 'string', 'max:800'],
            'contact_faq_3_question' => ['nullable', 'string', 'max:200'],
            'contact_faq_3_answer' => ['nullable', 'string', 'max:800'],
            'contact_faq_4_question' => ['nullable', 'string', 'max:200'],
            'contact_faq_4_answer' => ['nullable', 'string', 'max:800'],
            'invoice_prefix' => ['nullable', 'string', 'max:12'],
            'invoice_seller_name' => ['nullable', 'string', 'max:190'],
            'invoice_gstin' => ['nullable', 'string', 'max:20'],
            'invoice_address' => ['nullable', 'string', 'max:400'],
            'invoice_state' => ['nullable', 'string', 'max:60'],
            'invoice_email' => ['nullable', 'email', 'max:190'],
            'invoice_phone' => ['nullable', 'string', 'max:30'],
            'invoice_terms' => ['nullable', 'string', 'max:1000'],
            'return_name' => ['nullable', 'string', 'max:190'],
            'return_address' => ['nullable', 'string', 'max:400'],
            'return_city' => ['nullable', 'string', 'max:120'],
            'return_state' => ['nullable', 'string', 'max:60'],
            'return_pincode' => ['nullable', 'string', 'max:12'],
            'return_phone' => ['nullable', 'string', 'max:30'],
            'announcement' => ['nullable', 'string', 'max:190'],
            'social_instagram' => ['nullable', 'string', 'max:500'],
            'social_facebook' => ['nullable', 'string', 'max:500'],
            'social_youtube' => ['nullable', 'string', 'max:500'],
            'social_x' => ['nullable', 'string', 'max:500'],
            'social_telegram' => ['nullable', 'string', 'max:500'],
            'site_name' => ['nullable', 'string', 'max:60'],
            'site_logo' => ['nullable', 'string', 'max:255'],
            'site_favicon' => ['nullable', 'string', 'max:255'],
            'site_tagline' => ['nullable', 'string', 'max:190'],
            'seo_home_title' => ['nullable', 'string', 'max:180'],
            'seo_home_description' => ['nullable', 'string', 'max:320'],
            'seo_home_keywords' => ['nullable', 'string', 'max:300'],
            'seo_og_title' => ['nullable', 'string', 'max:180'],
            'seo_og_description' => ['nullable', 'string', 'max:320'],
            'seo_og_image' => ['nullable', 'string', 'max:500'],
            'seo_canonical' => ['nullable', 'string', 'max:300'],
            'stats_enabled' => ['nullable', 'in:0,1'],
            'stats_1_value' => ['nullable', 'string', 'max:12'], 'stats_1_suffix' => ['nullable', 'string', 'max:6'], 'stats_1_label' => ['nullable', 'string', 'max:60'],
            'stats_2_value' => ['nullable', 'string', 'max:12'], 'stats_2_suffix' => ['nullable', 'string', 'max:6'], 'stats_2_label' => ['nullable', 'string', 'max:60'],
            'stats_3_value' => ['nullable', 'string', 'max:12'], 'stats_3_suffix' => ['nullable', 'string', 'max:6'], 'stats_3_label' => ['nullable', 'string', 'max:60'],
            'stats_4_value' => ['nullable', 'string', 'max:12'], 'stats_4_suffix' => ['nullable', 'string', 'max:6'], 'stats_4_label' => ['nullable', 'string', 'max:60'],
            'spotlight_enabled' => ['nullable', 'in:0,1'],
            'spotlight_product_slug' => ['nullable', 'string', 'max:190'],
            'spotlight_eyebrow' => ['nullable', 'string', 'max:60'],
            'spotlight_heading' => ['nullable', 'string', 'max:120'],
            'spotlight_note' => ['nullable', 'string', 'max:190'],

            'cta_banner_enabled' => ['nullable', 'in:0,1'],
            'cta_banner_eyebrow' => ['nullable', 'string', 'max:60'],
            'cta_banner_heading' => ['nullable', 'string', 'max:120'],
            'cta_banner_description' => ['nullable', 'string', 'max:400'],
            'cta_banner_button_text' => ['nullable', 'string', 'max:40'],
            'cta_banner_button_url' => ['nullable', 'string', 'max:300'],

            // Home page sections (admin → Home Page).
            'home_bestsellers_enabled' => ['nullable', 'in:0,1'],
            'home_bestsellers_title' => ['nullable', 'string', 'max:80'],
            'home_deals_enabled' => ['nullable', 'in:0,1'],
            'home_deals_title' => ['nullable', 'string', 'max:80'],
            'home_trend_enabled' => ['nullable', 'in:0,1'],
            'home_trend_title' => ['nullable', 'string', 'max:80'],
            'home_new_enabled' => ['nullable', 'in:0,1'],
            'home_new_title' => ['nullable', 'string', 'max:80'],
            'home_genres_enabled' => ['nullable', 'in:0,1'],
            'home_genres_title' => ['nullable', 'string', 'max:80'],
            'home_rails_enabled' => ['nullable', 'in:0,1'],
            'home_authors_enabled' => ['nullable', 'in:0,1'],
            'home_authors_title' => ['nullable', 'string', 'max:80'],
            'home_reading_enabled' => ['nullable', 'in:0,1'],
            'home_reading_title' => ['nullable', 'string', 'max:80'],
            'about_stats_enabled' => ['nullable', 'in:0,1'],
            'about_testimonials_enabled' => ['nullable', 'in:0,1'],
            'home_testimonials_enabled' => ['nullable', 'in:0,1'],
            'home_testimonials_title' => ['nullable', 'string', 'max:80'],
            'home_blog_enabled' => ['nullable', 'in:0,1'],
            'home_blog_title' => ['nullable', 'string', 'max:80'],
            'home_instagram_title' => ['nullable', 'string', 'max:80'],
            'home_author_circles_enabled' => ['nullable', 'in:0,1'],
            'home_deals_eyebrow' => ['nullable', 'string', 'max:60'],
            'home_deals_heading' => ['nullable', 'string', 'max:120'],
            'home_deals_text' => ['nullable', 'string', 'max:300'],
            'home_deals_ends' => ['nullable', 'string', 'max:60'],
            'newsletter_enabled' => ['nullable', 'in:0,1'],
            'newsletter_title' => ['nullable', 'string', 'max:120'],
            'newsletter_text' => ['nullable', 'string', 'max:300'],
            'gift_enabled' => ['nullable', 'in:0,1'],
            'gift_eyebrow' => ['nullable', 'string', 'max:60'],
            'gift_heading' => ['nullable', 'string', 'max:120'],
            'gift_body' => ['nullable', 'string', 'max:500'],
            'gift_button_text' => ['nullable', 'string', 'max:40'],
            'gift_button_url' => ['nullable', 'string', 'max:300'],
            'popup_enabled' => ['nullable', 'in:0,1'],
            'popup_delay_seconds' => ['nullable', 'integer', 'min:0', 'max:120'],
            'popup_show_once' => ['nullable', 'in:0,1'],
            'popup_title' => ['nullable', 'string', 'max:120'],
            'popup_subtitle' => ['nullable', 'string', 'max:240'],
            'popup_discount' => ['nullable', 'string', 'max:40'],
            'popup_button' => ['nullable', 'string', 'max:40'],
            'popup_disclaimer' => ['nullable', 'string', 'max:190'],
            'about_home_eyebrow' => ['nullable', 'string', 'max:60'],
            'about_home_title' => ['nullable', 'string', 'max:120'],
            'about_home_body1' => ['nullable', 'string', 'max:800'],
            'about_home_body2' => ['nullable', 'string', 'max:800'],
            'about_pillar_1_value' => ['nullable', 'string', 'max:12'], 'about_pillar_1_label' => ['nullable', 'string', 'max:60'],
            'about_pillar_2_value' => ['nullable', 'string', 'max:12'], 'about_pillar_2_label' => ['nullable', 'string', 'max:60'],
            'about_pillar_3_value' => ['nullable', 'string', 'max:12'], 'about_pillar_3_label' => ['nullable', 'string', 'max:60'],
            'about_hero_image' => ['nullable', 'string', 'max:255'],
            'about_hero_highlight' => ['nullable', 'string', 'max:60'],
            'about_founder_image' => ['nullable', 'string', 'max:255'],
            'about_home_image_1' => ['nullable', 'string', 'max:255'],
            'about_home_image_2' => ['nullable', 'string', 'max:255'],
            'about_home_image_3' => ['nullable', 'string', 'max:255'],
            'about_founder_eyebrow' => ['nullable', 'string', 'max:60'],
            'about_founder_heading' => ['nullable', 'string', 'max:120'],
            'about_founder_highlight' => ['nullable', 'string', 'max:60'],
            'about_founder_name' => ['nullable', 'string', 'max:120'],
            'about_founder_role' => ['nullable', 'string', 'max:190'],
            'about_founder_story' => ['nullable', 'string', 'max:8000'],
            'about_quote_role' => ['nullable', 'string', 'max:190'],
            'about_hero_eyebrow' => ['nullable', 'string', 'max:60'],
            'about_hero_title' => ['nullable', 'string', 'max:120'],
            'about_hero_subtitle' => ['nullable', 'string', 'max:500'],
            'about_hero_note' => ['nullable', 'string', 'max:500'],
            'about_values_eyebrow' => ['nullable', 'string', 'max:60'], 'about_values_title' => ['nullable', 'string', 'max:120'],
            'about_value_1_title' => ['nullable', 'string', 'max:60'], 'about_value_1_body' => ['nullable', 'string', 'max:400'],
            'about_value_2_title' => ['nullable', 'string', 'max:60'], 'about_value_2_body' => ['nullable', 'string', 'max:400'],
            'about_value_3_title' => ['nullable', 'string', 'max:60'], 'about_value_3_body' => ['nullable', 'string', 'max:400'],
            'about_value_4_title' => ['nullable', 'string', 'max:60'], 'about_value_4_body' => ['nullable', 'string', 'max:400'],
            'about_quote_text' => ['nullable', 'string', 'max:500'],
            'about_quote_author' => ['nullable', 'string', 'max:120'],
            'page_faq' => ['nullable', 'string', 'max:20000'],
            'page_privacy' => ['nullable', 'string', 'max:20000'],
            'page_terms' => ['nullable', 'string', 'max:20000'],
        ];
        $data = $request->validate($rules);

        // An emptied box reaches us as null (Laravel converts "" to null). These
        // used to be filtered out right here, so clearing a field never saved:
        // the announcement bar — and every "leave blank to hide" field — kept
        // its old text on the website. Now a cleared field is honoured:
        //  - text is stored empty, so the website hides it;
        //  - numbers and on/off switches go back to their default (an empty
        //    shipping charge must not quietly become free shipping);
        //  - the policy pages go back to the built-in text ("Blank = built-in").
        $reset = [];
        foreach ($data as $key => $value) {
            if ($value !== null) {
                continue;
            }
            $kind = implode('|', array_filter((array) $rules[$key], 'is_string'));
            if (str_starts_with($key, 'page_') || preg_match('/\b(numeric|integer|in:)/', $kind)) {
                $reset[] = $key;
                unset($data[$key]);
            } else {
                $data[$key] = '';
            }
        }

        Setting::setMany($data);
        if ($reset) {
            Setting::whereIn('key', $reset)->delete();
            Setting::flush();
        }

        return $this->index();
    }
}
