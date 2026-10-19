<?php

use App\Http\Controllers\Api\Admin\AdminCouponController;
use App\Http\Controllers\Api\Admin\AdminOrderController;
use App\Http\Controllers\Api\Admin\AdminProductController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\CouponController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\WishlistController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Auth
    Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1,register');
    // Sign-up step two (the emailed code) and a fresh code for it.
    Route::post('/auth/register/verify', [AuthController::class, 'verifyRegistration'])->middleware('throttle:12,10,register-verify');
    Route::post('/auth/register/resend', [AuthController::class, 'resendRegistration'])->middleware('throttle:6,10,register-resend');
    Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1,login');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1,forgot');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1,reset');

    // Sign in with Google — browser redirects, then a one-time token handoff.
    Route::get('/auth/google/status', [\App\Http\Controllers\Api\GoogleAuthController::class, 'status']);
    Route::get('/auth/google/redirect', [\App\Http\Controllers\Api\GoogleAuthController::class, 'redirect'])
        ->middleware('throttle:20,1,google');
    Route::get('/auth/google/callback', [\App\Http\Controllers\Api\GoogleAuthController::class, 'callback']);
    Route::post('/auth/google/exchange', [\App\Http\Controllers\Api\GoogleAuthController::class, 'exchange'])
        ->middleware('throttle:20,1,google-x');

    // Catalog
    Route::get('/products', [ProductController::class, 'index']);
    Route::get('/products/{slug}', [ProductController::class, 'show']);
    Route::get('/products/{slug}/related', [ProductController::class, 'related']);
    Route::get('/products/{slug}/reviews', [ReviewController::class, 'index']);
    Route::post('/products/{slug}/reviews', [ReviewController::class, 'store'])->middleware('throttle:6,1,review');
    Route::get('/categories', [CategoryController::class, 'index']);
    // Suggestions while typing in a search box: books, authors, categories, ISBNs.
    Route::get('/search/suggest', [\App\Http\Controllers\Api\SearchController::class, 'suggest'])
        ->middleware('throttle:120,1,search-suggest');
    // A finished search, for admin → Search insights.
    Route::post('/searches', [\App\Http\Controllers\Api\SearchController::class, 'record'])
        ->middleware(['throttle:30,1,search-note', 'throttle:400,1440,search-note-day']);
    Route::get('/authors', [\App\Http\Controllers\Api\AuthorController::class, 'index']);
    Route::get('/publishers', [\App\Http\Controllers\Api\PublisherController::class, 'index']);

    // Cart (guest-friendly via X-Cart-Token)
    Route::get('/cart', [CartController::class, 'show']);
    Route::post('/cart/items', [CartController::class, 'addItem']);
    Route::put('/cart/items/{itemId}', [CartController::class, 'updateItem']);
    Route::delete('/cart/items/{itemId}', [CartController::class, 'removeItem']);
    Route::delete('/cart', [CartController::class, 'clear']);

    // Checkout + tracking + misc
    Route::post('/orders/track', [OrderController::class, 'track'])->middleware('throttle:15,1,track');
    // Coupons the shop chose to advertise (admin → Coupons → "Show"). Read-only.
    Route::get('/coupons', [CouponController::class, 'publicList']);
    Route::post('/coupons/validate', [CouponController::class, 'validateCode'])->middleware('throttle:15,1,coupon');
    // Live courier rate for a PIN — quoted at checkout, charged at checkout.
    Route::post('/shipping/quote', [\App\Http\Controllers\Api\ShippingController::class, 'quote'])
        ->middleware('throttle:30,1,quote');
    Route::post('/newsletter/subscribe', [NewsletterController::class, 'subscribe'])->middleware('throttle:10,1,newsletter');
    Route::post('/contact', [ContactController::class, 'store'])->middleware('throttle:10,1,contact');
    // A question recorded with the website's mic button (signed in or not).
    Route::post('/voice-queries', [\App\Http\Controllers\Api\VoiceQueryController::class, 'store'])
        ->middleware(['throttle:6,10,voice-query', 'throttle:20,1440,voice-query-day']);
    // Books for Institutions → Request a quote. Stored as a message for admin.
    Route::post('/institution-enquiries', [\App\Http\Controllers\Api\InstitutionEnquiryController::class, 'store'])
        ->middleware('throttle:5,10,institution-enquiry');
    // Placing an order needs a signed-in customer; a guest is refused with a
    // message the storefront can show as it is.
    Route::post('/checkout', [CheckoutController::class, 'store'])->middleware(['throttle:10,1,checkout', \App\Http\Middleware\RequireSignIn::class]);
    // Saves a shopper's part-filled details so the shop can follow up if they
    // leave without ordering. Cleared automatically when they do check out.
    Route::post('/checkout/abandon', [CheckoutController::class, 'abandon'])->middleware('throttle:40,1,abandon');
    // Return / replacement request for a delivered order — a signed-in customer
    // or a guest proving the order email. Accepts photo uploads, so throttled.
    Route::post('/orders/{orderNumber}/return', [\App\Http\Controllers\Api\ReturnController::class, 'store'])->middleware('throttle:10,1,return');

    // Authenticated
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        // The customer's own profile picture, shown beside their reviews.
        Route::post('/auth/avatar', [AuthController::class, 'updateAvatar'])->middleware('throttle:10,1,avatar');
        Route::delete('/auth/avatar', [AuthController::class, 'destroyAvatar']);
        Route::put('/auth/password', [AuthController::class, 'updatePassword']);

        // Signup email confirmation
        Route::post('/auth/otp/send', [AuthController::class, 'sendOtp'])->middleware('throttle:6,10,otp-send');
        Route::post('/auth/otp/verify', [AuthController::class, 'verifyOtp'])->middleware('throttle:12,10,otp-verify');

        Route::post('/cart/merge', [CartController::class, 'merge']);

        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{orderNumber}', [OrderController::class, 'show']);
        Route::get('/orders/{orderNumber}/invoice', [\App\Http\Controllers\Api\InvoiceController::class, 'show']);
        Route::post('/orders/{orderNumber}/cancel', [OrderController::class, 'cancel']);

        Route::get('/addresses', [\App\Http\Controllers\Api\AddressController::class, 'index']);
        Route::post('/addresses', [\App\Http\Controllers\Api\AddressController::class, 'store'])->middleware('throttle:20,1,address');
        Route::put('/addresses/{address}', [\App\Http\Controllers\Api\AddressController::class, 'update']);
        Route::post('/addresses/{address}/default', [\App\Http\Controllers\Api\AddressController::class, 'makeDefault']);
        Route::delete('/addresses/{address}', [\App\Http\Controllers\Api\AddressController::class, 'destroy']);

        Route::get('/wishlist', [WishlistController::class, 'index']);
        Route::post('/wishlist/{productId}', [WishlistController::class, 'store']);
        Route::delete('/wishlist/{productId}', [WishlistController::class, 'destroy']);

        // Admin
        // Every admin write clears the storefront cache on its way out, so a
        // saved change is live on the next page load.
        // The owner everywhere; staff only in the areas the owner gave them, and
        // their saves held for approval where so set (App\Support\StaffAccess).
        Route::prefix('admin')->middleware([\App\Http\Middleware\AdminOrStaff::class, \App\Http\Middleware\RefreshStorefront::class])->group(function () {
            // Staff and their changes — the owner's alone.
            Route::middleware('admin')->group(function () {
                Route::get('/staff', [\App\Http\Controllers\Api\Admin\AdminStaffController::class, 'index']);
                Route::post('/staff', [\App\Http\Controllers\Api\Admin\AdminStaffController::class, 'store'])->middleware('throttle:20,1,staff-add');
                Route::put('/staff/{user}', [\App\Http\Controllers\Api\Admin\AdminStaffController::class, 'update']);
                Route::delete('/staff/{user}', [\App\Http\Controllers\Api\Admin\AdminStaffController::class, 'destroy']);
                Route::get('/approvals', [\App\Http\Controllers\Api\Admin\AdminApprovalController::class, 'index']);
                Route::get('/approvals/count', [\App\Http\Controllers\Api\Admin\AdminApprovalController::class, 'count']);
                Route::post('/approvals/{id}/approve', [\App\Http\Controllers\Api\Admin\AdminApprovalController::class, 'approve']);
                Route::post('/approvals/{id}/reject', [\App\Http\Controllers\Api\Admin\AdminApprovalController::class, 'reject']);
                Route::get('/approvals/{id}/files/{index}', [\App\Http\Controllers\Api\Admin\AdminApprovalController::class, 'file'])->whereNumber('index');
            });
            // A staff member's own changes and how they went.
            Route::get('/my-changes', [\App\Http\Controllers\Api\Admin\AdminApprovalController::class, 'mine']);

            Route::get('/stats', [DashboardController::class, 'stats']);
            Route::get('/search-insights', [\App\Http\Controllers\Api\Admin\AdminSearchInsightsController::class, 'index']);
            Route::get('/products', [AdminProductController::class, 'index']);
            Route::get('/products/{product}', [AdminProductController::class, 'show']);
            Route::post('/products', [AdminProductController::class, 'store']);
            Route::put('/products/{product}', [AdminProductController::class, 'update']);
            Route::delete('/products/{product}', [AdminProductController::class, 'destroy']);
            Route::get('/orders', [AdminOrderController::class, 'index']);
            Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
            Route::get('/orders/{order}/invoice', [\App\Http\Controllers\Api\InvoiceController::class, 'adminShow']);
            Route::get('/shipping/status', [\App\Http\Controllers\Api\Admin\AdminShippingController::class, 'status']);
            Route::post('/orders/{order}/shiprocket', [\App\Http\Controllers\Api\Admin\AdminShippingController::class, 'push']);
            Route::post('/orders/{order}/shiprocket/awb', [\App\Http\Controllers\Api\Admin\AdminShippingController::class, 'assign']);
            Route::get('/orders/{order}/shiprocket/track', [\App\Http\Controllers\Api\Admin\AdminShippingController::class, 'track']);
            // An AWB booked elsewhere (e.g. on Shiprocket's site), typed in; the customer is emailed it.
            Route::put('/orders/{order}/awb', [\App\Http\Controllers\Api\Admin\AdminShippingController::class, 'manualAwb']);
            Route::put('/orders/{order}/status', [AdminOrderController::class, 'updateStatus']);
            Route::get('/coupons', [AdminCouponController::class, 'index']);
            Route::post('/coupons', [AdminCouponController::class, 'store']);
            Route::put('/coupons/{coupon}', [AdminCouponController::class, 'update']);
            Route::delete('/coupons/{coupon}', [AdminCouponController::class, 'destroy']);
            // Abandoned checkouts — shoppers who entered details but never paid.
            Route::get('/abandoned-checkouts', [\App\Http\Controllers\Api\Admin\AdminAbandonedCheckoutController::class, 'index']);
            Route::delete('/abandoned-checkouts/{abandonedCheckout}', [\App\Http\Controllers\Api\Admin\AdminAbandonedCheckoutController::class, 'destroy']);
            // Returns / replacements — review, approve (reverse pickup), refund.
            Route::get('/returns', [\App\Http\Controllers\Api\Admin\AdminReturnController::class, 'index']);
            Route::post('/returns/{orderReturn}/approve', [\App\Http\Controllers\Api\Admin\AdminReturnController::class, 'approve']);
            Route::post('/returns/{orderReturn}/book-pickup', [\App\Http\Controllers\Api\Admin\AdminReturnController::class, 'bookPickup']);
            Route::post('/returns/{orderReturn}/reject', [\App\Http\Controllers\Api\Admin\AdminReturnController::class, 'reject']);
            Route::post('/returns/{orderReturn}/complete', [\App\Http\Controllers\Api\Admin\AdminReturnController::class, 'complete']);

            // Product media — real file uploads (ported from the arpita reference)
            Route::post('/products/{product}/image', [\App\Http\Controllers\Api\Admin\AdminMediaController::class, 'storeThumbnail']);
            Route::delete('/products/{product}/image', [\App\Http\Controllers\Api\Admin\AdminMediaController::class, 'destroyThumbnail']);
            Route::post('/products/{product}/gallery', [\App\Http\Controllers\Api\Admin\AdminMediaController::class, 'storeGallery']);
            Route::delete('/products/{product}/gallery/{image}', [\App\Http\Controllers\Api\Admin\AdminMediaController::class, 'destroyGalleryImage']);
            Route::post('/products/{product}/video', [\App\Http\Controllers\Api\Admin\AdminMediaController::class, 'storeVideo']);
            Route::delete('/products/{product}/video', [\App\Http\Controllers\Api\Admin\AdminMediaController::class, 'destroyVideo']);

            // Review moderation
            Route::get('/reviews', [\App\Http\Controllers\Api\Admin\AdminReviewController::class, 'index']);
            Route::put('/reviews/{review}', [\App\Http\Controllers\Api\Admin\AdminReviewController::class, 'update']);
            Route::delete('/reviews/{review}', [\App\Http\Controllers\Api\Admin\AdminReviewController::class, 'destroy']);

            // Collections (categories)
            // Authors (the other half of the Categories & Authors screen)
            Route::get('/authors', [\App\Http\Controllers\Api\Admin\AdminAuthorController::class, 'index']);
            Route::post('/authors', [\App\Http\Controllers\Api\Admin\AdminAuthorController::class, 'store']);
            Route::post('/authors/{author}', [\App\Http\Controllers\Api\Admin\AdminAuthorController::class, 'update']); // POST for multipart
            Route::delete('/authors/{author}/photo', [\App\Http\Controllers\Api\Admin\AdminAuthorController::class, 'destroyPhoto']);
            Route::delete('/authors/{author}', [\App\Http\Controllers\Api\Admin\AdminAuthorController::class, 'destroy']);
            // Publishers — the Publications page and each book's publisher
            Route::get('/publishers', [\App\Http\Controllers\Api\Admin\AdminPublisherController::class, 'index']);
            Route::post('/publishers', [\App\Http\Controllers\Api\Admin\AdminPublisherController::class, 'store']);
            Route::post('/publishers/{publisher}', [\App\Http\Controllers\Api\Admin\AdminPublisherController::class, 'update']); // POST for multipart
            Route::delete('/publishers/{publisher}/logo', [\App\Http\Controllers\Api\Admin\AdminPublisherController::class, 'destroyLogo']);
            Route::delete('/publishers/{publisher}', [\App\Http\Controllers\Api\Admin\AdminPublisherController::class, 'destroy']);

            Route::get('/categories', [\App\Http\Controllers\Api\Admin\AdminCategoryController::class, 'index']);
            Route::post('/categories', [\App\Http\Controllers\Api\Admin\AdminCategoryController::class, 'store']);
            Route::put('/categories/{category}', [\App\Http\Controllers\Api\Admin\AdminCategoryController::class, 'update']);
            Route::post('/categories/{category}', [\App\Http\Controllers\Api\Admin\AdminCategoryController::class, 'update']); // POST for multipart
            Route::delete('/categories/{category}/image', [\App\Http\Controllers\Api\Admin\AdminCategoryController::class, 'destroyImage']);
            Route::delete('/categories/{category}', [\App\Http\Controllers\Api\Admin\AdminCategoryController::class, 'destroy']);

            // Newsletter subscribers + contact messages
            Route::get('/subscribers', [\App\Http\Controllers\Api\Admin\AdminInboxController::class, 'subscribers']);
            Route::delete('/subscribers/{subscriber}', [\App\Http\Controllers\Api\Admin\AdminInboxController::class, 'destroySubscriber']);
            // Voice queries recorded on the website (see App\Support\VoiceQueries).
            Route::get('/voice-queries', [\App\Http\Controllers\Api\Admin\AdminVoiceQueryController::class, 'index']);
            Route::get('/voice-queries/count', [\App\Http\Controllers\Api\Admin\AdminVoiceQueryController::class, 'count']);
            Route::get('/voice-queries/{id}/audio', [\App\Http\Controllers\Api\Admin\AdminVoiceQueryController::class, 'audio'])
                ->where('id', '[0-9A-HJKMNP-TV-Z]{26}');
            Route::put('/voice-queries/{id}', [\App\Http\Controllers\Api\Admin\AdminVoiceQueryController::class, 'update'])
                ->where('id', '[0-9A-HJKMNP-TV-Z]{26}');
            Route::delete('/voice-queries/{id}', [\App\Http\Controllers\Api\Admin\AdminVoiceQueryController::class, 'destroy'])
                ->where('id', '[0-9A-HJKMNP-TV-Z]{26}');
            Route::get('/messages', [\App\Http\Controllers\Api\Admin\AdminInboxController::class, 'messages']);
            Route::put('/messages/{message}', [\App\Http\Controllers\Api\Admin\AdminInboxController::class, 'updateMessage']);
            Route::delete('/messages/{message}', [\App\Http\Controllers\Api\Admin\AdminInboxController::class, 'destroyMessage']);

            // Store settings (key-value, arpita port)
            Route::get('/settings', [\App\Http\Controllers\Api\Admin\AdminSettingController::class, 'index']);
            Route::put('/settings', [\App\Http\Controllers\Api\Admin\AdminSettingController::class, 'update']);

            // Integrations hold the shop's keys and passwords — the owner's alone.
            Route::middleware('admin')->group(function () {
            // Integration credentials (write-only secrets). One group per admin
            // screen — payment | delivery | mail — managed independently.
            Route::get('/integrations/{group}', [\App\Http\Controllers\Api\Admin\AdminGatewayController::class, 'index']);
            Route::put('/integrations/{group}', [\App\Http\Controllers\Api\Admin\AdminGatewayController::class, 'update']);
            Route::post('/integrations/{group}/test', [\App\Http\Controllers\Api\Admin\AdminGatewayController::class, 'test'])
                ->middleware('throttle:12,1,gateway-test');
            // Stop using an integration, keeping its details; and resume it.
            Route::post('/integrations/{group}/disconnect', [\App\Http\Controllers\Api\Admin\AdminGatewayController::class, 'disconnect']);
            Route::post('/integrations/{group}/connect', [\App\Http\Controllers\Api\Admin\AdminGatewayController::class, 'connect']);

            // WhatsApp → Order messages: which AiGrowBot template goes out at
            // each order step. Reading templates sends nothing; the test sends
            // one message to the number the admin types.
            Route::get('/whatsapp', [\App\Http\Controllers\Api\Admin\AdminWhatsAppController::class, 'show']);
            Route::put('/whatsapp', [\App\Http\Controllers\Api\Admin\AdminWhatsAppController::class, 'update']);
            Route::post('/whatsapp/templates', [\App\Http\Controllers\Api\Admin\AdminWhatsAppController::class, 'refresh'])
                ->middleware('throttle:10,1,whatsapp-templates');
            Route::post('/whatsapp/test', [\App\Http\Controllers\Api\Admin\AdminWhatsAppController::class, 'test'])
                ->middleware('throttle:6,1,whatsapp-test');
            });

            // Image-valued settings (About hero, founder portrait, ...)
            Route::post('/settings/image/{key}', [\App\Http\Controllers\Api\Admin\AdminSettingImageController::class, 'store']);
            Route::delete('/settings/image/{key}', [\App\Http\Controllers\Api\Admin\AdminSettingImageController::class, 'destroy']);

            // Branding — logo/favicon uploads (arpita AdminBrandingController port)
            Route::get('/branding', [\App\Http\Controllers\Api\Admin\AdminBrandingController::class, 'index']);
            Route::post('/branding/{field}', [\App\Http\Controllers\Api\Admin\AdminBrandingController::class, 'upload']);
            Route::delete('/branding/{field}', [\App\Http\Controllers\Api\Admin\AdminBrandingController::class, 'destroy']);

            // Hero banners (arpita port — CRUD + image upload)
            Route::get('/banners', [\App\Http\Controllers\Api\Admin\AdminBannerController::class, 'index']);
            Route::post('/banners', [\App\Http\Controllers\Api\Admin\AdminBannerController::class, 'store']);
            Route::get('/banners/{banner}', [\App\Http\Controllers\Api\Admin\AdminBannerController::class, 'show']);
            Route::post('/banners/{banner}', [\App\Http\Controllers\Api\Admin\AdminBannerController::class, 'update']); // POST for multipart
            Route::delete('/banners/{banner}', [\App\Http\Controllers\Api\Admin\AdminBannerController::class, 'destroy']);
            // Deals Of The Week — the offers sliding through the home page's deals panel
            Route::get('/deals', [\App\Http\Controllers\Api\Admin\AdminDealController::class, 'index']);
            Route::post('/deals', [\App\Http\Controllers\Api\Admin\AdminDealController::class, 'store']);
            Route::get('/deals/{deal}', [\App\Http\Controllers\Api\Admin\AdminDealController::class, 'show']);
            Route::put('/deals/{deal}', [\App\Http\Controllers\Api\Admin\AdminDealController::class, 'update']);
            Route::delete('/deals/{deal}', [\App\Http\Controllers\Api\Admin\AdminDealController::class, 'destroy']);

            // Testimonials (arpita port)
            Route::get('/testimonials', [\App\Http\Controllers\Api\Admin\AdminTestimonialController::class, 'index']);
            Route::post('/testimonials', [\App\Http\Controllers\Api\Admin\AdminTestimonialController::class, 'store']);
            Route::put('/testimonials/{testimonial}', [\App\Http\Controllers\Api\Admin\AdminTestimonialController::class, 'update']);
            Route::post('/testimonials/{testimonial}', [\App\Http\Controllers\Api\Admin\AdminTestimonialController::class, 'update']); // POST for multipart (a photo)
            Route::delete('/testimonials/{testimonial}/photo', [\App\Http\Controllers\Api\Admin\AdminTestimonialController::class, 'destroyPhoto']);
            Route::delete('/testimonials/{testimonial}', [\App\Http\Controllers\Api\Admin\AdminTestimonialController::class, 'destroy']);

            // Content blocks — gallery | circles | arrivals | instagram (arpita port)
            Route::get('/content/{type}', [\App\Http\Controllers\Api\Admin\AdminContentController::class, 'index']);
            Route::post('/content/{type}', [\App\Http\Controllers\Api\Admin\AdminContentController::class, 'store']);
            Route::post('/content/{type}/{id}', [\App\Http\Controllers\Api\Admin\AdminContentController::class, 'update']); // POST for multipart
            Route::delete('/content/{type}/{id}', [\App\Http\Controllers\Api\Admin\AdminContentController::class, 'destroy']);

            // Journal / blog posts (arpita port)
            Route::get('/blogs', [\App\Http\Controllers\Api\Admin\AdminBlogController::class, 'index']);
            Route::get('/blogs/{blog}', [\App\Http\Controllers\Api\Admin\AdminBlogController::class, 'show']);
            Route::post('/blogs', [\App\Http\Controllers\Api\Admin\AdminBlogController::class, 'store']);
            Route::post('/blogs/{blog}', [\App\Http\Controllers\Api\Admin\AdminBlogController::class, 'update']); // POST for multipart
            Route::put('/blogs/{blog}/seo', [\App\Http\Controllers\Api\Admin\AdminBlogController::class, 'updateSeo']);
            Route::delete('/blogs/{blog}', [\App\Http\Controllers\Api\Admin\AdminBlogController::class, 'destroy']);

        });
    });

    // Payments — Razorpay
    Route::get('/payments/config', [\App\Http\Controllers\Api\PaymentController::class, 'config']);

    // Starting a payment is open so a guest can pay online too. A customer's
    // order is still locked to that customer inside the controller; a guest
    // order (no owner) may be paid by whoever holds its number. Verify stays
    // open: it is guarded by the Razorpay signature.
    Route::post('/payments/razorpay/start', [\App\Http\Controllers\Api\PaymentController::class, 'start'])
        ->middleware('throttle:20,1,pay-start');
    Route::post('/payments/razorpay/verify', [\App\Http\Controllers\Api\PaymentController::class, 'verify'])->middleware('throttle:20,1,pay-verify');
    Route::post('/payments/razorpay/webhook', [\App\Http\Controllers\Api\PaymentController::class, 'webhook']);

    // Public store settings (display values for the storefront)
    Route::get('/settings', function () {
        $out = [];
        foreach (\App\Http\Controllers\Api\Admin\AdminSettingController::defaults() as $key => $default) {
            $out[$key] = \App\Models\Setting::get($key, $default);
        }

        // The About story is HTML from admin; the shop shows it as HTML, so it
        // leaves here cleaned (no scripts, event handlers or javascript: links).
        if (isset($out['about_founder_story'])) {
            $out['about_founder_story'] = \App\Support\HtmlSanitizer::clean((string) $out['about_founder_story']);
        }

        return response()->json(['data' => $out]);
    });

    /*
     * One rail per category for the home page: the products ticked as
     * "Show in its category rail" in admin, newest first where none are.
     *
     * A single route rather than one request per category. The storefront would
     * otherwise fire seven of them, and `php artisan serve` answers one request
     * at a time — the page would wait on them in series.
     *
     * Categories with no products at all are dropped here, so the home page
     * never has to render an empty rail.
     */
    Route::get('/category-rails', function () {
        $picked = \App\Models\Product::active()
            ->where('is_category_pick', true)
            ->orderByDesc('is_bestseller')
            ->orderByDesc('id')
            ->get()
            ->groupBy('category_id');

        $rails = [];

        foreach (\App\Models\Category::orderBy('sort_order')->orderBy('name')->get() as $category) {
            $products = $picked->get($category->id) ?? collect();

            // Nothing ticked for this category — fall back to its newest, the
            // same way the New Arrivals rail does, so a shop that has not
            // curated anything still shows a populated page.
            if ($products->isEmpty()) {
                $products = \App\Models\Product::active()
                    ->where('category_id', $category->id)
                    ->orderByDesc('id')
                    ->limit(12)
                    ->get();
            }

            if ($products->isEmpty()) {
                continue;
            }

            $rails[] = [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'products' => $products->take(12)->map->toCard()->values(),
            ];
        }

        return response()->json(['data' => $rails]);
    });

    // Public content managed from the admin panel
    Route::get('/banners', fn () => response()->json([
        'data' => \App\Models\Banner::active()->get()->map->toArray()->values(),
    ]));
    // Live deals only: switched on and not past their end date.
    Route::get('/deals', fn () => response()->json([
        'data' => \App\Models\Deal::live()->with('category')->get()->map->toArray()->values(),
    ]));
    Route::get('/testimonials', fn () => response()->json([
        'data' => \App\Models\Testimonial::active()->get()->map->toCard()->values(),
    ]));
    Route::get('/content/{type}', function (string $type) {
        $models = [
            'gallery' => \App\Models\GalleryItem::class,
            'circles' => \App\Models\CollectionCircle::class,
            'arrivals' => \App\Models\NewArrival::class,
            'instagram' => \App\Models\InstagramPost::class,
        ];
        abort_unless(isset($models[$type]), 404);

        return response()->json([
            'data' => $models[$type]::active()->get()->map->toArray()->values(),
        ]);
    });
    // Latest approved reviews across the whole catalogue (home social proof).
    Route::get('/reviews', function (\Illuminate\Http\Request $request) {
        $limit = min((int) $request->query('limit', 12), 30);

        return response()->json([
            'data' => \App\Models\Review::with('product:id,name,slug,image')
                ->where('is_approved', true)
                ->whereNotNull('body')
                ->latest('id')
                ->take($limit)
                ->get()
                ->map(fn (\App\Models\Review $r) => [
                    'id' => $r->id,
                    'name' => $r->name,
                    'rating' => $r->rating,
                    'title' => $r->title,
                    'body' => $r->body,
                    'created_at' => $r->created_at?->toIso8601String(),
                    'product' => $r->product ? [
                        'name' => $r->product->name,
                        'slug' => $r->product->slug,
                        'image' => \App\Models\Product::imageUrl($r->product->image),
                    ] : null,
                ])->values(),
        ]);
    });

    // Store-wide review aggregate for the social-proof block on the home page.
    Route::get('/reviews/summary', function () {
        $agg = \App\Models\Review::where('is_approved', true)
            ->selectRaw('COUNT(*) c, COALESCE(AVG(rating), 0) a')
            ->first();

        $breakdown = \App\Models\Review::where('is_approved', true)
            ->selectRaw('rating, COUNT(*) n')
            ->groupBy('rating')
            ->pluck('n', 'rating');

        return response()->json(['data' => [
            'count' => (int) $agg->c,
            'average' => round((float) $agg->a, 2),
            'breakdown' => collect(range(5, 1))
                ->mapWithKeys(fn ($r) => [$r => (int) ($breakdown[$r] ?? 0)])
                ->all(),
        ]]);
    });

    Route::get('/blogs', fn () => response()->json([
        'data' => \App\Models\Blog::published()->take(24)->get()->map->toCard()->values(),
    ]));
    Route::get('/blogs/{slug}', function (string $slug) {
        $blog = \App\Models\Blog::published()->where('slug', $slug)->firstOrFail();
        $blog->increment('views');

        // Shown as HTML on the shop, so cleaned of anything that could run.
        $detail = $blog->toDetail();
        $detail['content'] = \App\Support\HtmlSanitizer::clean((string) ($detail['content'] ?? ''));

        return response()->json(['data' => $detail]);
    });
});
