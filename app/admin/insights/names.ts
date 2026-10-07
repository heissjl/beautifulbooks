/** The German names of the origin and channel classes on `/admin/insights`; shared by the page and the channel table. */
export const ORIGIN_NAMES: Record<string, string> = {
  engine: 'Suchmaschine', search: 'Suche auf der Seite', home: 'Startseite', collection: 'Sammlung', shelf: 'Shelf-Portrait',
  book: 'Andere Buchseite', page: 'Andere Seite hier', social: 'Sozial, sonstige', other: 'Andere Website', direct: 'Direkt / unbekannt',
  reddit: 'Reddit', pinterest: 'Pinterest', hn: 'Hacker News', instagram: 'Instagram', tiktok: 'TikTok', bluesky: 'Bluesky', x: 'X',
  blog: 'Blog (via-Link)', mail: 'Mail (via-Link)', site: 'Anderer Tab dieser Seite',
  linkedin: 'LinkedIn', facebook: 'Facebook', threads: 'Threads', youtube: 'YouTube', whatsapp: 'WhatsApp', telegram: 'Telegram',
  mastodon: 'Mastodon', tumblr: 'Tumblr', discord: 'Discord',
};

/** The one row the social networks are summed into. */
export const SOCIAL_NAME = 'Soziale Netzwerke';
