# Configuration Stripe — Guide rapide

Ce guide te permet de configurer le vrai paiement Stripe en 5 minutes (mode TEST, pas de vrai argent).

## 1. Créer un compte Stripe (gratuit)

1. Va sur https://dashboard.stripe.com/register
2. Confirme ton email
3. Connecte-toi → tu es en mode **Test** par défaut

## 2. Récupérer les clés API

1. Va sur https://dashboard.stripe.com/test/apikeys
2. Copie la **Secret key** (commence par `sk_test_...`)
3. Copie la **Publishable key** (commence par `pk_test_...`)
4. Colle-les dans `.env.local` :
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

## 3. Créer les prix (Starter 19€ / Pro 49€)

1. Va sur https://dashboard.stripe.com/test/products
2. Clique **+ Add product**
3. Crée le produit **Starter** :
   - Name: `Plan Starter`
   - Pricing: Recurring / Monthly / 19.00 EUR
   - Note le **Price ID** (commence par `price_...`)
4. Crée le produit **Pro** :
   - Name: `Plan Pro`
   - Pricing: Recurring / Monthly / 49.00 EUR
   - Note le **Price ID**
5. Colle les Price IDs dans `.env.local` :
   ```
   STRIPE_PRICE_STARTER_ID=price_...
   STRIPE_PRICE_PRO_ID=price_...
   ```

## 4. Configurer le webhook local

### Installer Stripe CLI

```powershell
winget install Stripe.StripeCLI
```

### Authentifier

```powershell
stripe login
```

### Démarrer le webhook (dans un terminal séparé)

```powershell
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

Tu verras apparaître le signing secret :
```
Ready! Your webhook signing secret is whsec_...
```

6. Colle ce secret dans `.env.local` :
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 5. Redémarrer le serveur

```powershell
npm stop
npm run dev
```

Le bouton « Passer au plan Pro » redirige maintenant vers le vrai Stripe !

## Cartes de test (mode TEST)

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | Paiement réussi |
| `4000 0000 0000 3220` | Authentification 3DS requise |
| `4000 0000 0000 9995` | Paiement refusé |

N'importe quelle date future et n'importe quel CVC (ex. `123`) fonctionnent en mode test.

---

⚠️ **Ne jamais utiliser les clés LIVE (`sk_live_...`) en développement. Toujours rester en mode TEST (`sk_test_...`).**
