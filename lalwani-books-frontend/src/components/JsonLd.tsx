/**
 * Structured data for search engines (schema.org JSON-LD).
 *
 * The JSON is written into a <script>, so "<" is escaped: a book title or
 * description containing "</script>" could otherwise close the tag early and
 * turn the rest into live markup.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
