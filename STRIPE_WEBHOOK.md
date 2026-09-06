# Configuration du webhook Stripe (LOCAL)

Le webhook permet à Stripe de notifier ton serveur après un paiement réussi. Sans ça, le plan ne change pas côté serveur après un paiement.

## Étape 1 : Installer Stripe CLI

```powershell
winget install Stripe.StripeCLI
```

## Étape 2 : Authentifier

```powershell
stripe login
```

Cela ouvre ton navigateur pour connecter ton compte Stripe.

## Étape 3 : Démarrer le webhook (terminal séparé)

```powershell
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

Tu verras apparaître :
```
Ready! Your webhook signing secret is whsec_1234...
```

## Étape 4 : Configurer le secret

Copie le `whsec_...` dans `.env.local` :

```
STRIPE_WEBHOOK_SECRET=whsec_1234...
```

## Étape 5 : Redémarrer le serveur

```powershell
powershell -File scripts/stop-server.ps1 -Port 3001
$env:NEXTAUTH_URL='http://localhost:3001'
node node_modules/next/dist/bin/next dev -p 3001 --webpack
```

## Tester le flux complet

1. Ouvre http://localhost:3001
2. Va dans Tarifs → "Passer au plan Pro"
3. Paiement avec carte test `4242 4242 4242 4242` (date future, CVC `123`)
4. Après paiement → retour sur /dashboard?billing=success
5. Ton plan est maintenant PRO côté serveur !

## Cartes de test

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | Succès |
| `4000 0000 0000 3220` | 3DS requis |
| `4000 0000 0000 9995` | Déclin |

---

⚠️ Le webhook ne fonctionne qu'avec le CLI qui tourne. Pour la production, configure le webhook sur https://dashboard.stripe.com/test/webhooks avec l'URL `https://ton-domaine.com/api/webhooks/stripe`.
