# Optimisation Hostinger — Réduction du nombre de process (NPROC / erreur 503)

## Contexte

Hostinger (hébergement partagé) tourne sur **CloudLinux**. Chaque compte est
enfermé dans une "boîte" isolée (LVE) avec une limite **NPROC = nombre max de
processus ET threads simultanés** (Node, ses threads, `sharp`, le serveur web,
le cron, SSH…). Quand on dépasse cette limite, le serveur **renvoie une erreur
503** car il ne peut plus créer de process.

- Limite affichée « Processes maximum » : ~400 Num pendant 24 h (boost d'essai),
  puis retombe à ~120 Num.
- Mesuré au repos : **~96 Num** → socle déjà proche de la future limite.

## Cause racine identifiée

1. **Images sources gigantesques recompressées à la volée.** `public/`
   contenait 230 Mo d'images, dont des **PNG de photos jusqu'à 5568×3712 (37 Mo)**.
   Servies via `<Image>` / `/_next/image`, chaque visite déclenchait `sharp`
   (libvips) pour les décoder/redimensionner → pics de CPU et de threads.
2. **Pool de threads `sharp`/libvips dimensionné sur le nombre de cœurs du
   serveur physique** (souvent 16–32 sur une machine partagée) → socle de
   threads élevé en permanence, même au repos. C'est la piste principale du
   « 96 au repos ».
3. Vidéo témoignage de 32 Mo et API blog sans cache (impacts secondaires).

## Ce qui a été fait dans le code (déjà appliqué)

- **Images `public/` : 230 Mo → 63 Mo.** Toutes les photos redimensionnées à
  max 2560 px ; gros PNG photo convertis en WebP (37 Mo → 0,7 Mo) et références
  mises à jour ([bi-places/page.tsx](<app/(public)/bi-places/page.tsx>),
  [TestimonySection.tsx](components/sections/TestimonySection.tsx)).
- **[next.config.mjs](next.config.mjs)** :
  - `formats: ["image/webp"]` → **pas d'AVIF** (encodage AVIF très gourmand en CPU).
  - `minimumCacheTTL: 31536000` → une image optimisée est mise en cache sur
    disque 1 an : `sharp` ne s'exécute **qu'une fois** par image, pas à chaque
    visite ni pour chaque bot.
  - `deviceSizes` / `imageSizes` réduits → moins de variantes générées.
- **[app/api/blog/route.ts](app/api/blog/route.ts)** : `revalidate = 3600`.

## ⚠️ À FAIRE dans hPanel Hostinger (le plus important pour le 96 au repos)

Dans **hPanel → Node.js → ton application front → Variables d'environnement**,
ajoute (elles doivent être posées AVANT le démarrage de Node, donc ici et pas
dans un `.env`) :

| Variable | Valeur | Effet |
|----------|--------|-------|
| `VIPS_CONCURRENCY` | `1` | Limite le pool de threads de `sharp` à 1 (au lieu du nb de cœurs du serveur). **Levier principal.** |
| `UV_THREADPOOL_SIZE` | `2` | Limite le pool de threads I/O de Node.js. |

Puis **redémarre l'application** Node. Compare le « Processes maximum » avant/après :
le socle au repos devrait nettement baisser.

Vérifs utiles côté serveur (SSH si dispo) :
- `ps -eLf | wc -l` → nombre de threads du compte.
- S'assurer qu'**une seule instance** de l'app tourne (pas de cluster/PM2 en
  plusieurs workers, pas de process fantôme d'un ancien déploiement).

## Pour la V2 (refonte du front) — recommandations

- **CDN / stockage objet pour tous les assets** (images + vidéos) :
  Cloudflare R2, Bunny.net, etc. Node ne sert plus que le HTML → l'essentiel de
  la charge process disparaît. C'est le bon choix que tu envisageais.
- **Servir des images déjà optimisées** (pas d'optimisation à la volée sur
  hébergement partagé), ou déléguer l'optimisation au CDN.
- **Vidéo** `paul.webm` (32 Mo) : héberger sur le CDN et/ou ré-encoder plus léger
  (~5–8 Mo). Elle est déjà en `preload="metadata"` donc pas téléchargée tant
  qu'on ne clique pas play — impact limité aujourd'hui.
- Envisager un hébergement mieux adapté à Next.js (Vercel, VPS) : sur CloudLinux
  partagé, Node + optimisation d'images se battront toujours contre le NPROC.

## Détail : fichiers non référencés restants (nettoyage possible)

Ces gros fichiers ne sont plus utilisés dans le code et peuvent être supprimés
pour alléger le déploiement (sans impact NPROC) :
- `public/baptemes/option-video-parapente.png` (~4,9 Mo)
- `public/baptemes/bapteme-placeholder2.png` (~3,5 Mo)

Références cassées préexistantes (pointent vers des fichiers absents, à corriger
lors de la refonte) : `public/placeholder/serreche-parapente-wallpaper{1,2,3}.jpg`.
