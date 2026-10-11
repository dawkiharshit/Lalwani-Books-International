<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Cleans HTML written in the admin panel before the shop shows it (blog
 * posts, the About page story). Ordinary formatting tags and safe attributes
 * survive; scripts, styles, frames, forms, event handlers (onclick=…), inline
 * styles and javascript:/data: links are removed.
 *
 * Built on PHP's own DOM parser rather than patterns, so unusual markup cannot
 * sneak a tag past it. Only an admin can write this HTML, but a snippet pasted
 * from elsewhere, or a hijacked admin account, must never be able to run code
 * in a shopper's browser.
 */
final class HtmlSanitizer
{
    private const TAGS = [
        'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'a', 'img', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
        'span', 'div',
    ];

    private const ATTRIBUTES = [
        '*' => ['class', 'title'],
        'a' => ['href', 'target', 'rel'],
        'img' => ['src', 'alt', 'width', 'height', 'loading'],
        'th' => ['colspan', 'rowspan', 'scope'],
        'td' => ['colspan', 'rowspan'],
        'ol' => ['start'],
    ];

    /** Removed together with everything inside them. */
    private const DROP_WITH_CONTENT = [
        'script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math',
        'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base', 'frame', 'frameset',
    ];

    public static function clean(?string $html): string
    {
        $html = (string) $html;
        if (trim($html) === '') {
            return '';
        }

        $doc = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        // Declared UTF-8 so non-English text survives, and wrapped so loose
        // text has a parent to sit in.
        $doc->loadHTML(
            '<?xml encoding="UTF-8"><div id="__lbi_root">'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $doc->getElementById('__lbi_root');
        if (! $root) {
            return '';
        }

        self::walk($root);

        $out = '';
        foreach (iterator_to_array($root->childNodes) as $child) {
            $out .= $doc->saveHTML($child);
        }

        return $out;
    }

    private static function walk(DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMElement) {
                $tag = strtolower($child->tagName);

                if (in_array($tag, self::DROP_WITH_CONTENT, true)) {
                    $node->removeChild($child);

                    continue;
                }

                if (! in_array($tag, self::TAGS, true)) {
                    // Unknown tag: keep what it contains, lose the tag itself.
                    self::walk($child);
                    while ($child->firstChild) {
                        $node->insertBefore($child->firstChild, $child);
                    }
                    $node->removeChild($child);

                    continue;
                }

                self::cleanAttributes($child, $tag);
                self::walk($child);
            } elseif (in_array($child->nodeType, [XML_COMMENT_NODE, XML_PI_NODE, XML_CDATA_SECTION_NODE], true)) {
                $node->removeChild($child);
            }
        }
    }

    private static function cleanAttributes(DOMElement $el, string $tag): void
    {
        $allowed = array_merge(self::ATTRIBUTES['*'], self::ATTRIBUTES[$tag] ?? []);

        foreach (iterator_to_array($el->attributes) as $attr) {
            $name = strtolower($attr->name);

            if (! in_array($name, $allowed, true)
                || (in_array($name, ['href', 'src'], true) && ! self::safeUrl($attr->value, $name === 'src'))) {
                $el->removeAttribute($attr->name);
            }
        }

        // A link opening a new tab must not hand that tab control of this one.
        if ($tag === 'a' && strtolower($el->getAttribute('target')) === '_blank') {
            $el->setAttribute('rel', 'noopener noreferrer');
        }
    }

    /** Web links, page-relative links, and for links also email and phone. Never javascript:, data: and the like. */
    private static function safeUrl(string $url, bool $image): bool
    {
        // Browsers ignore spaces and control characters inside a scheme ("java\nscript:").
        $url = preg_replace('/[\x00-\x20]+/', '', $url) ?? '';
        if ($url === '') {
            return false;
        }

        if (! preg_match('/^[a-z][a-z0-9+.\-]*:/i', $url)) {
            return true; // no scheme: a link within the site
        }

        return (bool) preg_match($image ? '/^https?:/i' : '/^(https?|mailto|tel):/i', $url);
    }
}
