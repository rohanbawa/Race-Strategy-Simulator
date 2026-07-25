/**
 * Map a country name (as it arrives from the race data) to an ISO 3166-1 alpha-2 code,
 * used to show the circuit's national flag. Emoji flags render as bare letters on
 * Windows, so the UI uses a flag image keyed by this code instead.
 */
const ISO2: Record<string, string> = {
  bahrain: 'BH',
  'saudi arabia': 'SA',
  australia: 'AU',
  japan: 'JP',
  china: 'CN',
  usa: 'US',
  'united states': 'US',
  'united states of america': 'US',
  america: 'US',
  italy: 'IT',
  monaco: 'MC',
  canada: 'CA',
  spain: 'ES',
  austria: 'AT',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  britain: 'GB',
  england: 'GB',
  hungary: 'HU',
  belgium: 'BE',
  netherlands: 'NL',
  azerbaijan: 'AZ',
  singapore: 'SG',
  mexico: 'MX',
  brazil: 'BR',
  'united arab emirates': 'AE',
  uae: 'AE',
  'abu dhabi': 'AE',
  qatar: 'QA',
  portugal: 'PT',
  germany: 'DE',
  france: 'FR',
  russia: 'RU',
  turkey: 'TR',
  'türkiye': 'TR',
  malaysia: 'MY',
  'south africa': 'ZA',
  argentina: 'AR',
};

/** ISO alpha-2 (lowercase) for a country name, or null if unrecognised. */
export function countryIso2(country?: string): string | null {
  if (!country) return null;
  const iso = ISO2[country.trim().toLowerCase()];
  return iso ? iso.toLowerCase() : null;
}
