export default {
  eslint: {
    // Le lint est vérifié par le hook pre-push (pnpm check), pas pendant le build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Le typecheck est vérifié par le hook pre-push (pnpm check), pas pendant le build
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/reservation', // L'URL de votre ancien WordPress
        destination: '/reserver',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
      {
        source: '/en/book', // L'URL de votre ancien WordPress
        destination: '/reserver',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
      {
        source: '/es/reservar', // L'URL de votre ancien WordPress
        destination: '/reserver',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
      {
        source: '/mention-legale', // L'URL de votre ancien WordPress
        destination: '/legal',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
      {
        source: '/en/accueil-english', // L'URL de votre ancien WordPress
        destination: '/',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
      {
        source: '/2022/06/27/bonjour-tout-le-monde', // L'URL de votre ancien WordPress
        destination: '/blog',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
      {
        source: '/comments/feed', // L'URL de votre ancien WordPress
        destination: '/blog',           // Votre nouvelle page NextJS
        permanent: true,                  // true = Redirection 301 (Permanent)
      },
    ]
  },
  images: {
    // WebP uniquement : l'encodage AVIF par sharp est très gourmand en CPU/threads
    // et fait grimper le nombre de process sur l'hébergement partagé.
    formats: ["image/webp"],
    // Une image optimisée est mise en cache sur disque pendant 1 an : sharp ne
    // s'exécute qu'UNE fois par image/variante, pas à chaque visite (ni pour chaque bot).
    minimumCacheTTL: 31536000,
    // NB : on garde les deviceSizes/imageSizes par défaut de Next. Les restreindre
    // fait renvoyer un 400 dès qu'une largeur non listée est demandée (vieux HTML
    // en cache, CDN, etc.) — trop fragile pour un gain marginal.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        port: "",
        pathname: "/images/**",
      },
    ],
  },
};
