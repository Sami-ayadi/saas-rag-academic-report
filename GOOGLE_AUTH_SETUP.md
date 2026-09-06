# Configuration de l'authentification Google

L'application utilise Google OAuth via NextAuth. Les comptes sont créés automatiquement dans PostgreSQL lors de leur première connexion.

## 1. Créer le client Google

1. Ouvrir [Google Auth Platform](https://console.cloud.google.com/auth/overview) et sélectionner ou créer un projet.
2. Dans **Branding**, renseigner le nom de l'application, l'adresse de support et les coordonnées du développeur.
3. Dans **Audience**, choisir le type d'utilisateurs. En mode test, ajouter chaque adresse Google autorisée dans **Test users**.
4. Dans **Clients**, créer un client de type **Web application**.
5. Ajouter l'origine JavaScript autorisée avec le port réellement utilisé : `http://localhost:3000` (ou `http://localhost:3001` si le port 3000 est déjà occupé sur la machine).
6. Ajouter exactement cette URI de redirection, avec le même port : `http://localhost:3000/api/auth/callback/google` (ou `http://localhost:3001/api/auth/callback/google`).

Google exige une correspondance exacte du protocole, de l'hôte, du port et du chemin. Voir le [guide OAuth officiel](https://developers.google.com/identity/protocols/oauth2/web-server).

## 2. Configurer l'application locale

Copier `.env.example` vers `.env.local`, puis renseigner :

```dotenv
# Utiliser le port réellement écouté par l'application : 3000 par défaut,
# 3001 sur la machine où le port 3000 est occupé par Grafana.
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="un-secret-long-et-aleatoire"
GOOGLE_CLIENT_ID="votre-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="votre-client-secret"
PLATFORM_OWNER_EMAILS="votre-adresse@gmail.com"
AUTH_ALLOW_DEMO="false"
NEXT_PUBLIC_AUTH_ALLOW_DEMO="false"
```

Générer un secret robuste depuis PowerShell :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`PLATFORM_OWNER_EMAILS` accepte plusieurs adresses séparées par des virgules. Une adresse présente dans cette liste reçoit le rôle administrateur côté serveur lors de sa connexion (cette variable remplace l'ancien nom `ADMIN_EMAILS` cité dans d'anciennes versions de ce guide). Ne jamais exposer `GOOGLE_CLIENT_SECRET` ou `NEXTAUTH_SECRET` dans une variable préfixée par `NEXT_PUBLIC_`.

Redémarrer l'application après toute modification de `.env.local` (le fichier n'est relu qu'au démarrage) : `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-server.ps1 -Port 3001`, puis relancer `next dev -p 3001 --webpack`. Ouvrir l'application et cliquer sur **Commencer avec Google** ; Google renvoie ensuite vers `/dashboard`.

Sans identifiants Google, activer le mode démonstration local (`AUTH_ALLOW_DEMO="true"` et `NEXT_PUBLIC_AUTH_ALLOW_DEMO="true"`) pour se connecter avec les comptes de démonstration — strictement réservé au développement local, jamais en production.

## 3. Configuration de production

Pour `https://rapport.example.com`, enregistrer dans Google :

```text
Origine :      https://rapport.example.com
Redirection :  https://rapport.example.com/api/auth/callback/google
```

Définir aussi `NEXTAUTH_URL=https://rapport.example.com`, utiliser de nouveaux secrets de production, désactiver les deux drapeaux de démonstration et servir le site en HTTPS.

## Dépannage

- `Try signing in with a different account` juste après le clic sur Google (log serveur : `client_id is required`, `OAuthSignin`) : `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sont absents ou vides dans `.env.local`. L'interface n'affiche plus le bouton Google dans ce cas.
- `redirect_uri_mismatch` : l'URI Google ne correspond pas exactement à `/api/auth/callback/google`.
- `Access blocked` : ajouter l'adresse à **Test users**, ou publier l'application OAuth.
- Retour sur une mauvaise adresse : corriger `NEXTAUTH_URL`, puis redémarrer Next.js.
- Connexion réussie sans administration : ajouter l'adresse exacte dans `ADMIN_EMAILS`, se déconnecter, puis se reconnecter.
