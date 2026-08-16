# Configuration de l'authentification Google

L'application utilise Google OAuth via NextAuth. Les comptes sont créés automatiquement dans PostgreSQL lors de leur première connexion.

## 1. Créer le client Google

1. Ouvrir [Google Auth Platform](https://console.cloud.google.com/auth/overview) et sélectionner ou créer un projet.
2. Dans **Branding**, renseigner le nom de l'application, l'adresse de support et les coordonnées du développeur.
3. Dans **Audience**, choisir le type d'utilisateurs. En mode test, ajouter chaque adresse Google autorisée dans **Test users**.
4. Dans **Clients**, créer un client de type **Web application**.
5. Ajouter l'origine JavaScript autorisée : `http://localhost:3000`.
6. Ajouter exactement cette URI de redirection : `http://localhost:3000/api/auth/callback/google`.

Google exige une correspondance exacte du protocole, de l'hôte, du port et du chemin. Voir le [guide OAuth officiel](https://developers.google.com/identity/protocols/oauth2/web-server).

## 2. Configurer l'application locale

Copier `.env.example` vers `.env.local`, puis renseigner :

```dotenv
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="un-secret-long-et-aleatoire"
GOOGLE_CLIENT_ID="votre-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="votre-client-secret"
ADMIN_EMAILS="votre-adresse@gmail.com"
AUTH_ALLOW_DEMO="false"
NEXT_PUBLIC_AUTH_ALLOW_DEMO="false"
```

Générer un secret robuste depuis PowerShell :

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`ADMIN_EMAILS` accepte plusieurs adresses séparées par des virgules. Une adresse présente dans cette liste reçoit le rôle administrateur côté serveur lors de sa connexion. Ne jamais exposer `GOOGLE_CLIENT_SECRET` ou `NEXTAUTH_SECRET` dans une variable préfixée par `NEXT_PUBLIC_`.

Redémarrer l'application avec `npm stop`, puis `npm run dev`. Ouvrir `http://localhost:3000` et cliquer sur **Commencer avec Google**. Google renvoie ensuite vers `/dashboard`.

## 3. Configuration de production

Pour `https://rapport.example.com`, enregistrer dans Google :

```text
Origine :      https://rapport.example.com
Redirection :  https://rapport.example.com/api/auth/callback/google
```

Définir aussi `NEXTAUTH_URL=https://rapport.example.com`, utiliser de nouveaux secrets de production, désactiver les deux drapeaux de démonstration et servir le site en HTTPS.

## Dépannage

- `redirect_uri_mismatch` : l'URI Google ne correspond pas exactement à `/api/auth/callback/google`.
- `Access blocked` : ajouter l'adresse à **Test users**, ou publier l'application OAuth.
- Retour sur une mauvaise adresse : corriger `NEXTAUTH_URL`, puis redémarrer Next.js.
- Connexion réussie sans administration : ajouter l'adresse exacte dans `ADMIN_EMAILS`, se déconnecter, puis se reconnecter.
