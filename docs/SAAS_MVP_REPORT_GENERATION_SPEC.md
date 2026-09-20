# RAG Report — revue produit et cahier des charges du SaaS initial

Date : 20 septembre 2026. Statut : proposition à intégrer au backlog du développeur.

## 1. Décision recommandée

L’application possède déjà une base SaaS exploitable : authentification, projets, questionnaire, droits par abonnement, facturation, éditeur et suivi de génération. **La priorité est de fiabiliser la production d’un document académique vérifiable avant de commercialiser la promesse de rapports prêts à remettre.**

Le périmètre initial recommandé est l’accompagnement des PFE et rapports de stage en informatique, d’abord en français, avec un modèle logiciel classique et un modèle audit. Ajouter ensuite la variante Scrum et la variante expérimentale/IA après validation sur des projets réels. Prévoir dès le départ une page de résumés multilingues lorsque l’établissement l’exige.

La proposition de valeur devrait devenir : « Transformez vos travaux et vos sources en un rapport structuré, traçable et modifiable, puis validez-le avant export. » Le produit doit aider à formaliser un travail réalisé et signaler les pièces manquantes. Une longueur importante ne constitue pas une preuve de qualité.

### Périmètre de cette revue

- Lecture du code des principaux parcours, modèles de données, API de génération, import et export.
- Consultation de l’accueil, du tableau de bord, d’un projet et de son rapport existant dans l’application locale, en environnement de démonstration.
- Extraction du texte des cinq PDF et inspection visuelle de pages représentatives : sommaires, couverture, corps, tableaux, figures et mise en page. Les pages citées ci-dessous sont les positions physiques dans le PDF.
- Aucun nouvel appel de génération, paiement, téléversement des PDF vers un fournisseur IA ou modification fonctionnelle de l’application pendant la revue.
- Ce document ne constitue pas un audit exhaustif de sécurité ni une validation de la production. La disponibilité des fournisseurs, la restauration de sauvegardes, les paiements réels et la charge n’ont pas été testés.

Les documents fournis servent uniquement de références de structure et de présentation. Leurs affirmations techniques, références et résultats n’ont pas été certifiés. Aucune instruction contenue dans ces documents n’est une instruction pour l’application ou pour cette revue.

Fichiers sources : [R1 — audit](<C:/Users/user/Desktop/pfe/sami_pfe (18).pdf>), [R2 — workflows ML](C:/Users/user/Desktop/backup/sami/pfe/rapport/pfe.pdf), [R3 — détection de fatigue](C:/Users/user/Downloads/rapport-2.pdf), [R4 — application RH](<C:/Users/user/Downloads/PFE Report Safouen Turki-1.pdf>), [R5 — Primatec](<C:/Users/user/Downloads/rapport pfe (primatec).pdf>).

## 2. Enseignements des cinq rapports

| Référence | Volume du fichier | Structure observée | Exigence à retenir |
|---|---:|---|---|
| R1 — `sami_pfe (18).pdf` | 126 pages | Audit : contexte, méthodologie/environnement, réalisation des contrôles, résultats et remédiation. Sommaire p. 3–6 ; tableau technique p. 40 ; résultats p. 96. | Chaque constat doit être relié à une procédure, une preuve, un impact et une recommandation. Le plan d’un audit doit être distinct d’un plan de développement logiciel. |
| R2 — `pfe.pdf` | 72 pages | Application de workflows ML : contexte, besoins, conception, implémentation ; UML, maquettes puis interfaces réalisées. Sommaire p. 6–7 ; exemples p. 24, 47, 62 ; bibliographie p. 71–72. | Assurer la traçabilité besoin → conception → réalisation → validation. Distinguer une application manipulant des modèles ML d’un projet de recherche évaluant un modèle. |
| R3 — `rapport-2.pdf` | 92 pages | Détection de fatigue : contexte, étude des méthodes, conception, réalisation et validation. Sommaire p. 1–3 ; citations p. 21 ; cas d’utilisation p. 45 ; tests p. 85 ; bibliographie p. 91–92. | Prévoir état de l’art sourcé, formules, tableaux, protocole de test, résultats et limites. Des tests de logique ne prouvent pas à eux seuls une performance en conditions réelles. |
| R4 — `PFE Report Safouen Turki-1.pdf` | 78 pages | Application RH organisée par Sprint 0 puis modules/sprints ; backlog, cas d’utilisation, diagrammes, réalisation, validation. Couverture p. 1 ; sommaire p. 4–6 ; validation p. 67–68 ; résumés p. 78. | Une variante Scrum doit décrire les sprints réellement réalisés, avec objectifs, travail livré, tests et bilan. Elle peut remplacer les chapitres classiques de réalisation. |
| R5 — `rapport pfe (primatec).pdf` | 63 pages | Application de gestion d’équipes : contexte, besoins, conception, réalisation ; couverture institutionnelle p. 1 ; résumés arabe/français/anglais p. 2 ; sommaire p. 6–7 ; interface p. 53. | Prévoir métadonnées académiques, plusieurs auteurs, encadrants/jury, résumés multilingues, légendes et références croisées. |

### Ce qui doit être commun

Une hiérarchie de chapitres et sous-chapitres, une problématique explicite, des objectifs, des choix justifiés, des preuves du travail réalisé, une analyse des résultats, une conclusion, des références et une mise en page cohérente. Les figures et tableaux font partie du raisonnement : ils doivent être introduits et commentés dans le texte.

### Ce qui doit rester configurable

Le nombre de chapitres, leur ordre exact, la place des résumés, le style bibliographique, la numérotation des pages préliminaires, les logos, les marges et le volume. Les fichiers fournis vont de 63 à 126 pages ; cela ne justifie ni un objectif universel de 50 pages ni une reproduction de leur longueur. Certains fichiers commencent directement par les dédicaces ou le sommaire : ne pas en déduire qu’une couverture est toujours facultative.

Les exigences écrites de l’établissement, confirmées par l’utilisateur, priment sur le modèle proposé. Les exemples ne doivent transmettre au nouveau projet ni les noms des auteurs, ni les entreprises, ni les résultats, ni les dédicaces. Les longues présentations génériques d’outils et les bibliographies hétérogènes observées ne sont pas des standards à reproduire.

## 3. Diagnostic du produit actuel

### Fondations à conserver

- Authentification Google/NextAuth, PostgreSQL/Prisma et contrôles de propriété des projets.
- Questionnaire structuré et briefs versionnés avec étape de validation.
- Quotas côté serveur, consommation atomique et remboursement dans les chemins d’échec prévus.
- Stripe Checkout, portail et webhook avec contrôle de signature et mécanisme de déduplication.
- Protections CSRF/CSP, rôles administratifs et journalisation.
- Édition de sections, proposition de régénération à accepter ou refuser, notifications et sauvegarde de progression entre sections.

La présence de ces mécanismes dans le code ne prouve pas que leurs configurations et tous leurs scénarios de production fonctionnent déjà.

### Écarts prioritaires

P0 = requis avant une bêta payante ; P1 = requis pour une ouverture plus large ; P2 = extension ultérieure. Les identifiants E1–E12 renvoient aux fichiers de la section 12.

| Priorité / ID | Constat vérifié | Modification demandée | Critère d’acceptation |
|---|---|---|---|
| P0 / SRC-01 | L’import extrait uniquement TXT/Markdown. PDF et DOCX sont enregistrés sans texte ; les embeddings valent `[]`. Un PDF du projet consulté affiche effectivement « 0 chunks », « stored ». E1 | Extraction PDF/DOCX, état de traitement explicite, provenance et OCR ou refus clair des scans. | Un passage situé en fin de PDF peut être retrouvé avec sa page ; un fichier non lu n’apparaît jamais comme une source exploitable. |
| P0 / SRC-02 | La génération prend les 30 premiers fragments par index et perd les identifiants de source/page. E2–E3 | Recherche pertinente par section avec filtre de propriétaire/projet et preuves identifiables. | Une question récupère les passages utiles, quel que soit leur emplacement ; aucun fragment d’un autre projet n’est accessible. |
| P0 / METH-01 | Plan plat de 10–25 sections, objectif central de mots/pages ; pas d’approbation distincte du plan. L’API ne vérifie pas que le dernier brief est approuvé. E2–E3 | Modèles hiérarchiques, contrôle du brief approuvé, méthode et plan approuvés avant rédaction. | Un appel direct à l’API est refusé si les versions approuvées requises manquent. |
| P0 / QUAL-01 | Le contrôle de longueur à 82 % du budget ne contrôle pas la justesse. Les consignes demandent simultanément de signaler les inconnues et de n’avoir aucun placeholder. E3 | Registre de faits, contrôles de preuves, états « à compléter » et validation finale. | Une section sans résultats fournis ne peut affirmer des résultats comme établis. |
| P0 / JOB-01 | Long traitement lancé dans une tâche détachée du gestionnaire HTTP ; checkpoints présents, mais dépendance au processus web. E2 | File persistante et worker, reprise contrôlée, réservation de crédit par opération logique. | Redémarrer le web ou le worker ne perd ni les sections validées ni la réservation ; un double clic ne lance pas deux rapports. |
| P0 / EXP-01 | DOCX et PDF très simples ; PDF supprime les accents et remplace les caractères non ASCII. Aucun modèle académique complet. E4 | Document structuré, moteur de rendu Unicode, couverture, sommaire réel, figures, tableaux et bibliographie. | « Évaluation », noms propres, références, tableaux et résumé arabe si activé restent corrects dans les fichiers exportés. |
| P0 / TRUST-01 | « Sauvegarder le profil » et « Supprimer le compte » ne produisent que des messages de démonstration ; champ université alimenté depuis l’image du profil. E6 | Vrais traitements persistants et suppression contrôlée, ou retirer les commandes non fonctionnelles. | Aucun message de succès avant confirmation serveur ; suppression vérifiable des données et fichiers concernés. |
| P0 / OPS-01 | Fichiers locaux ; suppression d’un projet efface les enregistrements sans nettoyage des fichiers dans cette route. Le proxy bloque vers 10,5 Mo alors que certains plans annoncent 25/100 Mo. E1, E7–E8 | Stockage durable privé, politique de suppression, limites cohérentes sur toute la chaîne. | Un fichier dans la limite du plan est accepté ; suppression du projet nettoyée même après panne, avec suivi d’erreur. |
| P0 / OFFER-01 | Accueil : exports « prêts à remettre », domaines très larges ; gratuit sans édition/sommaire ; aperçu « 4 pages » calculé en mots. E5, E11 | Promesse limitée aux capacités validées, aperçu honnête, accès gratuit au cadrage/plan et à la correction personnelle. | Tarifs, droits serveur et interface décrivent la même prestation ; une page annoncée correspond au rendu ou est explicitement une estimation. |
| P1 / EDIT-01 | Sections stockées en JSON texte ; PATCH remplace le contenu sans historique immuable de chaque modification. E9–E10 | Versions, restauration et contrôle de concurrence. | Deux onglets ne s’écrasent pas silencieusement ; une révision est restaurable. |
| P1 / UX-01 | Navigation interne par état, URL inchangée ; sommaire horizontal §1… ; dernière section appelée « Conclusion » même quand elle contient les annexes. Éditeur à deux colonnes étroit dans le panneau consulté. E9, E12 | URLs par projet/rapport, arbre de chapitres, libellés issus du type réel, inspecteur repliable sur petit écran. | Rechargement/lien direct/restauration de navigation fonctionnels ; édition utilisable à 390 px et au clavier. |
| P1 / OPS-02 | Limitation de requêtes en mémoire du processus. E7 | Limiteur partagé, configuration des proxies de confiance, observabilité et tests de charge ciblés. | Plusieurs instances appliquent ensemble la limite ; adresses déclarées par le client ne suffisent pas à la contourner. |

### Écarts observés dans un rapport existant

Le rapport consulté affiche 14 198 mots et 17 sections, avec le statut « Rapport prêt ». Il présente pourtant :

- des champs comme « Nom de la plateforme à préciser par l’étudiant » ;
- des vulnérabilités spécifiques affirmées dans une section, alors que la conclusion indique qu’aucun inventaire final n’est fourni ;
- des affirmations d’exécution et d’archivage de preuves sans pièces reliées dans l’interface ;
- une bibliographie composée de prose explicative, sans véritables notices structurées ;
- une chaîne parasite « User Safety: safe » dans une section ;
- de nombreuses répétitions des outils, du contexte et de la méthodologie.

Ces observations suffisent à imposer une validation avant le statut final. Elles ne permettent pas de déterminer automatiquement lesquels de ces travaux ont réellement été effectués par l’étudiant. Le produit doit précisément recueillir cette preuve ou cette confirmation.

## 4. Parcours utilisateur cible

1. **Créer le projet** : type de rapport, domaine pris en charge, langue, établissement et échéance.
2. **Décrire le travail** : questionnaire adaptatif avec sauvegarde ; distinguer ce qui est prévu, réalisé et vérifié.
3. **Ajouter les documents** : classer chaque fichier comme source du projet, exemple de structure ou consigne universitaire. Afficher traitement, pages lues et erreurs.
4. **Vérifier le dossier** : présenter les faits extraits, contradictions et pièces manquantes. L’utilisateur corrige puis approuve le brief.
5. **Choisir la méthode et valider le plan** : modèle proposé, chapitres modifiables, exigences par section, volume estimé, sources disponibles.
6. **Rédiger progressivement** : génération par section avec progression réelle ; lecture des parties terminées pendant le traitement ; pause/reprise explicites.
7. **Relire et compléter** : texte, sources et points à résoudre côte à côte ; correction personnelle, figures/tableaux, proposition IA comparée à la version précédente.
8. **Valider et exporter** : contrôle des données, références, figures et mise en page, aperçu paginé, approbation utilisateur, PDF/DOCX.

Remplacer « Documents → Résumé RAG → Rapport → Export » par des intitulés compréhensibles : « Dossier → Plan → Rédaction → Vérification → Export ». La synthèse peut rester un outil interne et un brief visible ; elle ne doit pas être une étape technique ambiguë pour l’étudiant.

### États à séparer

- Projet : `DRAFT → SOURCES_READY → BRIEF_APPROVED → OUTLINE_APPROVED → DRAFTING → REVIEW_REQUIRED → APPROVED`.
- Travail technique : `QUEUED / RUNNING / RETRY_WAIT / NEEDS_INPUT / FAILED / COMPLETED / CANCELLED`.
- Section : `EMPTY / DRAFT / NEEDS_EVIDENCE / REVIEWED / APPROVED / STALE`.
- Export : `QUEUED / RENDERING / READY / FAILED`, rattaché à une version approuvée.

« Génération terminée » signifie qu’un brouillon est disponible. « Validé » exige l’approbation. « Exporté » est un événement et un artefact, sans remplacer l’état de validation du rapport. Les règles de transition doivent être imposées par le serveur.

## 5. Structure normalisée des rapports

### 5.1 Préliminaires et éléments finaux

| Partie | Contenu attendu | Règle |
|---|---|---|
| Couverture | Établissement, diplôme/spécialité, titre, auteur(s), entreprise, année, encadrants ; jury/date/logos si requis | Informations fournies ou confirmées ; jamais inventées. |
| Dédicaces / remerciements | Texte personnel | Facultatifs et explicitement demandés ; noms et relations validés par l’auteur. |
| Résumés et mots-clés | Problème, démarche, réalisation, résultat justifié, limite principale | Langues et emplacement selon le modèle ; rédaction après stabilisation du corps. |
| Sommaire | Chapitres/sous-chapitres et pages | Généré par le moteur de rendu à partir de la hiérarchie. |
| Listes des figures/tableaux, abréviations | Objets réellement présents et termes réellement employés | Calculées, jamais produites comme une liste imaginaire par le LLM. |
| Introduction générale | Contexte, problématique, objectifs, périmètre, démarche et annonce du plan | Cohérente avec le plan final et les résultats effectivement disponibles. |
| Conclusion générale | Réponse à la problématique, bilan des objectifs, contribution, limites, perspectives | Aucune découverte nouvelle ; distinguer livré, testé et envisagé. |
| Bibliographie / webographie | Notices structurées et citations du texte | Un style unique par rapport ; vérifier existence ET soutien de l’affirmation. |
| Annexes | Pièces utiles, documents, détails des tests, extraits de code, guide | Annexes nommées et référencées ; confidentialité contrôlée. |

### 5.2 Modèle logiciel classique

Un socle de quatre à six chapitres, fusionnables selon les consignes universitaires :

| Chapitre | Question à traiter | Éléments exigibles |
|---|---|---|
| 1. Contexte et cadrage | Pour qui, pourquoi et dans quel périmètre ? | Organisme pertinent, rôle de l’étudiant, problème, objectifs, contraintes, planning. |
| 2. Existant et choix méthodologiques | Quelles alternatives et pourquoi ce choix ? | Comparaison sourcée, critères de choix, limites de l’existant, démarche de travail réellement utilisée. |
| 3. Analyse et spécification | Que doit faire la solution et comment juger sa qualité ? | Acteurs, exigences identifiées, cas d’utilisation et critères d’acceptation mesurables. |
| 4. Conception | Comment la solution répond-elle aux besoins ? | Architecture, flux, données, diagrammes utiles, décisions et compromis. |
| 5. Réalisation | Qu’a réellement construit l’étudiant ? | Environnement/version, modules, contribution personnelle, difficultés, interfaces réelles et légendées. |
| 6. Tests, résultats et discussion | Qu’est-ce qui fonctionne et dans quelles limites ? | Protocole, cas de test, attendu/observé, preuves, comparaison aux objectifs, limites et déploiement si effectué. |

Chaque chapitre a une brève introduction, un développement organisé et une conclusion/transmission vers le suivant. Les sous-sections suivent une hiérarchie stable, typiquement au plus trois niveaux visibles. On ne force ni paragraphes de 150–250 mots ni budgets identiques pour une bibliographie et une étude technique.

### 5.3 Variantes méthodologiques

**Audit cybersécurité — priorité bêta :** contexte/périmètre → référentiels et protocole → réalisation des contrôles → résultats/risques/remédiation. Une fiche de constat comprend identifiant, cible autorisée, procédure, attendu, observé, preuve, statut, impact, cotation justifiée et recommandation. Un test négatif ou non effectué reste visible. Une méthode de gestion comme Kanban ne remplace pas le protocole d’audit. Le générateur documente les tests fournis ; il n’exécute pas de tests sur les cibles citées.

**Logiciel Scrum — P1 :** étude préalable → Sprint 0/besoins/architecture → chapitres ou sous-chapitres par incrément → validation transversale. Chaque sprint contient objectif, backlog réellement retenu, conception utile, résultat livré, tests et rétrospective. Ne pas créer rétrospectivement des sprints fictifs pour habiller un projet.

**IA/expérimentation — P1 :** problème → état de l’art → données et protocole → conception/implémentation → expériences → discussion. Ajouter provenance des données, séparation entraînement/validation/test si applicable, baseline, métriques, reproductibilité, limites et conditions d’évaluation. Un tableau de métriques ne peut être rempli sans résultats fournis. Pour un système à seuils ou règles, utiliser le protocole correspondant sans inventer un apprentissage.

**Choix de méthode :** distinguer trois champs dans l’application : organisation du travail (Scrum/Kanban/autre), démarche technique (conception UML/audit/protocole expérimental) et structure du rapport. Proposer une combinaison expliquée puis demander sa validation. Ne jamais imposer automatiquement Scrum à tous les projets informatiques.

### 5.4 Présentation : profil par établissement

Paramètres obligatoires du modèle : format papier, marges, police Unicode, taille et interligne, styles de titres, numérotation, emplacement des légendes, sommaire, en-têtes/pieds de page, bibliographie, couverture et langue/direction des résumés.

Valeurs de départ possibles, à présenter comme choix éditoriaux : A4, corps 11–12 pt, marges autour de 2,5 cm, interligne 1,3–1,5, chapitres sur nouvelle page. Elles ne constituent pas une norme ISIMS ou une règle universelle. Les consignes validées de l’établissement déterminent le profil final.

Les figures doivent rester lisibles à l’impression, posséder légende et source (« réalisation personnelle » comprise), et être citées depuis le corps. Les tableaux longs répètent leur en-tête et évitent les coupures de lignes illisibles. Les sauts, titres orphelins, caractères manquants et débordements font partie de la recette.

## 6. Données à recueillir avant rédaction

Étendre le questionnaire existant par des blocs progressifs, sans obliger l’étudiant à répondre à tout en une seule session.

| Bloc | Champs / pièces |
|---|---|
| Identité académique | Auteurs, diplôme, spécialité, établissement, année, titre validé, encadrants, date/jury si connus. |
| Mission | Entreprise, rôle exact, dates, travail individuel/collectif, contribution personnelle, contexte existant. |
| Cadrage | Problématique, objectifs identifiés, périmètre, exclusions, livrables et contraintes. |
| Méthode | Méthode réellement appliquée, raison du choix, étapes, chronologie et adaptations. |
| Réalisation | Modules, décisions, architecture, outils/versions pertinents, captures, diagrammes, extraits justifiés. |
| Résultats | Tests réalisés, date/environnement, résultats bruts, métriques calculées, limites, pièces de preuve. |
| Exigences académiques | Modèle universitaire, sections imposées, style de référence, volume indicatif, langues et règles d’usage de l’IA fournies par l’établissement. |
| Confidentialité | Contenu exclu des appels IA/export, anonymisation souhaitée, autorisations d’usage des documents. |

Classer chaque information : `DECLARED` (déclarée par l’auteur), `SUPPORTED` (reliée à une source), `DERIVED` (calcul explicite), `UNKNOWN` ou `CONFLICTING`. Une déclaration d’auteur peut établir son rôle ou ses dates ; une performance chiffrée ou une vulnérabilité confirmée nécessite une preuve adaptée. L’IA ne transforme pas elle-même une information inconnue en fait vérifié.

Un dossier incomplet peut produire un plan et un brouillon partiel. Les champs manquants deviennent des tâches d’édition. Ils ne doivent pas être masqués par du texte générique. Le statut final est bloqué tant que les lacunes critiques subsistent ; un export de travail explicitement marqué « Brouillon » peut rester possible.

## 7. Architecture de génération à intégrer

### 7.1 Import et recherche documentaire

1. Conserver les contrôles de propriétaire, type et quota existants. Ajouter validation réelle du conteneur DOCX, contrôle du nombre de pages, limites de décompression et délais d’extraction.
2. Placer les documents dans un stockage privé durable et traiter l’extraction dans le worker. Isoler les parsers ; vérifier les fichiers avant de les exploiter. Les recommandations OWASP couvrent notamment validation, stockage, limites et permissions : [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
3. Extraire texte par page/bloc, tableaux et métadonnées. Détecter les PDF scannés : proposer OCR ou annoncer clairement le blocage. Ne pas considérer l’OCR comme une preuve suffisante lorsqu’un nombre ou un tableau est mal reconnu.
4. Conserver `documentId`, version/hash, page physique, numéro imprimé éventuel, bloc/offset, langue et qualité d’extraction. Un DOCX n’a pas de pagination stable : utiliser des repères de paragraphes, ou une page issue d’un rendu canonique identifié.
5. Découper par structure et budget de tokens, avec chevauchement limité. Éviter les coupures de tableau et la troncature silencieuse aux premières pages.
6. Pour le premier MVP, une recherche textuelle bien testée avec sélection utilisateur peut suffire. Ajouter des embeddings et une recherche hybride si l’évaluation montre une amélioration. L’exigence est la pertinence mesurée et la provenance, pas la présence d’un composant nommé « RAG ».
7. Rechercher séparément pour chaque section, diversifier les sources utiles et conserver les identifiants retenus. Si aucun passage ne répond, signaler l’insuffisance.

Séparer trois rôles : `PROJECT_EVIDENCE`, `STYLE_EXAMPLE`, `INSTITUTION_GUIDE`. Les exemples n’alimentent pas le registre des faits du projet. Les guides universitaires fournissent des règles candidates à faire confirmer. Aucun texte importé ne peut déclencher un appel d’outil, modifier les instructions système ou autoriser une action.

### 7.2 Plan et rédaction

1. Construire une version figée du dossier : brief approuvé, documents autorisés, faits, inconnues et consignes validées.
2. Sélectionner un modèle versionné et créer un plan hiérarchique. Chaque section a un objectif, des questions, des preuves nécessaires et des dépendances.
3. Afficher le plan, les manques et une estimation de volume/coût. Enregistrer l’approbation avec version et horodatage.
4. Avant chaque section, sélectionner les sources pertinentes et les faits autorisés. Fournir un glossaire partagé et un résumé validé des sections déjà écrites.
5. Générer un contenu structuré conforme au schéma. Séparer texte, citations, tableaux, figures et points à résoudre.
6. Valider syntaxe, identifiants, références, unités, nombres, cohérence avec les faits et couverture des questions. Une seconde lecture IA peut signaler les contradictions ; elle ne remplace pas les contrôles déterministes et la revue humaine.
7. Corriger uniquement la section en échec avec un budget de tentatives. Enregistrer résultat, preuves, modèle/prompt et coût ; ne pas rallonger automatiquement pour atteindre un quota de mots.
8. Vérifier globalement répétitions, dates, termes, objectifs/résultats et transitions. Produire introduction/résumés/conclusion à partir du corps stabilisé.
9. Passer à `REVIEW_REQUIRED`. L’approbation utilisateur porte sur une version précise. Toute modification importante rend les sections dépendantes à revoir.

### 7.3 Contrats de données

Schéma conceptuel à valider côté serveur, indépendamment de la sortie du modèle :

```text
ReportVersion
  id, projectId, version, schemaVersion
  templateId, templateVersion, briefVersionId, approvedOutlineVersionId
  sourceSnapshotHash, language, factLedger, glossary
  nodes[], qualityIssues[], status, approvedBy?, approvedAt?

Section
  id, parentId?, kind, title, order
  objective, questions[], requiredEvidenceTypes[], dependencies[]
  wordBudget { min?, max? }, status, contentNodes[]

ContentNode
  paragraph | heading | list | table | figure | equation
  code | citation | crossReference | unresolvedItem

Evidence
  id, projectId, sourceVersionId?, pageOrBlockLocator?
  claimType, excerptOrValue, origin, validationStatus

Citation
  id, evidenceId, bibliographyEntryId?, locator

Asset
  id, projectId, storageKey, kind, caption, provenance, approved
```

Utiliser des identifiants stables ; calculer numérotation et pages au rendu. Le LLM ne choisit pas une page de sommaire et ne peut citer un identifiant absent de la sélection autorisée. Les citations dans les sources ne prouvent pas que l’application a consulté les références originales : distinguer citation secondaire, notice suggérée et référence effectivement vérifiée.

Les figures importées restent distinctes des diagrammes proposés par l’IA. Ces derniers doivent être marqués comme propositions jusqu’à confirmation de l’architecture par l’auteur. Ne pas fabriquer des captures d’application ou courbes de résultats. Exécuter les éventuels rendus de diagrammes sans accès réseau ni code arbitraire.

## 8. Fiabilité, fournisseurs IA et coûts

### File persistante

Pour une première version, garder Next.js et PostgreSQL, et ajouter un worker séparé avec une file persistante adaptée à l’hébergement. Éviter une multiplication de services tant que la charge ne le justifie pas. Choisir le produit de file après vérification des contraintes d’exploitation.

Le worker revendique un travail avec verrou/lease, heartbeat, numéro de tentative et identifiant d’exécution. Une reprise ne doit pas permettre à l’ancien worker d’écrire après expiration de son bail. Enregistrer chaque étape terminée dans une transaction. Dédupliquer la publication d’un rapport et l’enregistrement d’une section.

Remplacer seulement la tâche détachée par `after()` ne garantit pas la durabilité : cette fonction reste soumise à la durée maximale de la plateforme. Le choix d’un worker est ici une recommandation d’architecture fondée sur la durée du pipeline actuel. [Documentation Next.js](https://nextjs.org/docs/app/api-reference/functions/after).

### Reprises et quotas

- Identifiant d’opération stable pour un même lancement/reprise ; double clic et répétition HTTP retournent le travail existant.
- Réserver le crédit à l’admission, finaliser une seule fois selon la règle commerciale, libérer une seule fois en cas d’échec définitif. Une reprise technique ne consomme pas un deuxième crédit.
- Sauvegarder brief, plan, sources et versions de génération dans le checkpoint. Un changement de contexte ne doit pas mélanger silencieusement deux versions ; invalider les sections concernées.
- Limiter la concurrence par utilisateur et par fournisseur. Prévoir annulation et échéance maximale avec conservation du brouillon.
- Afficher étape, sections terminées, dernière activité et action possible. Un pourcentage approximatif doit être présenté comme tel.

### Plusieurs API

Conserver les modèles hébergés par API comme demandé dans l’historique du projet. L’alternance entre fournisseurs doit suivre des critères de qualité, de confidentialité, de compatibilité et de disponibilité. Deux clés d’un même compte ne doivent pas être considérées comme deux quotas indépendants.

Pour un `429`, enregistrer le type de limitation, respecter `Retry-After` lorsqu’il existe et utiliser une attente progressive bornée. Si le quota est épuisé et que sa date de renouvellement n’est pas fournie, ne pas inventer une heure de reprise. Passer à un fournisseur autorisé et compatible ou à `RETRY_WAIT`/intervention requise. Les erreurs d’authentification/configuration nécessitent une correction de configuration ; éviter les tentatives répétées inutiles.

Enregistrer fournisseur, modèle, version de prompt, tokens, latence, tentatives et coût par section. Ne pas journaliser les clés ni les documents complets. Un changement de fournisseur en cours de rapport impose la même charte rédactionnelle et les mêmes validations. Prévoir dans l’information utilisateur quels prestataires peuvent traiter ses extraits.

Une offre commerciale ne peut garantir une disponibilité permanente à partir de quotas gratuits non garantis. Tester la qualité sur le même corpus avant de sélectionner un modèle ; ne pas choisir uniquement sur le prix ou la longueur produite.

### Économie du MVP

Mesurer le coût complet par rapport : lecture/OCR + recherche/embeddings éventuels + générations + reprises + exports + stockage. Calculer coût médian et coût des cas longs, puis fixer les droits commerciaux. Les offres actuelles de 20 et 100 générations mensuelles demandent cette vérification avant commercialisation.

Recommandation initiale : une offre découverte limitée en volume et une seule offre payante claire. Définir précisément ce qu’est une génération, ce qu’inclut la reprise et la durée d’accès. Tester l’intérêt d’un forfait par projet avec les premiers utilisateurs, sans modifier les tarifs sur une simple supposition. La correction manuelle du travail personnel et la validation du plan doivent rester accessibles.

## 9. Éditeur et export

### Éditeur

- Arbre de navigation des chapitres avec états et intitulés réels.
- Zone de texte structurée et panneau « Sources / À compléter / Historique » ; panneau en tiroir sur petit écran.
- Sauvegarde persistante avec indicateur et avertissement si modifications non enregistrées.
- Contrôle de version à chaque sauvegarde, retour explicite en cas de conflit, restauration.
- Régénération ciblée qui propose un changement, respecte les passages verrouillés et conserve les corrections humaines.
- Actions pour associer une preuve, insérer une figure/table, définir une abréviation et corriger une référence.
- Alertes localisées : « Résultat sans preuve », « Date contradictoire », « Figure manquante », avec action corrective.
- Distinguer alertes bloquantes et améliorations de style. Aucun score global ne doit masquer une preuve critique manquante.

### Export

Conserver un modèle de document commun pour HTML d’aperçu, DOCX, PDF et Markdown. Éviter trois assemblages indépendants. Pour le MVP, choisir un rendu canonique — par exemple DOCX structuré, champs mis à jour puis conversion PDF dans un worker isolé — et vérifier les champs/pages sur le moteur effectivement déployé. Une autre chaîne de composition est acceptable si elle satisfait les mêmes tests ; valider un prototype avant le choix final.

Le DOCX contient de vrais styles, titres, tableaux, images, légendes et champs de sommaire. Le PDF contient les polices nécessaires, des liens internes et une pagination issue du rendu. Les numéros du sommaire doivent être calculés après composition ; `index + 1` et `mots / 280` restent impropres à cet usage.

Prévoir les textes français/anglais et, si offert, la composition arabe droite à gauche avec polices compatibles. Le nombre de pages peut changer selon le logiciel ouvrant le DOCX ; identifier le PDF canonique et signaler la mise à jour des champs après modification dans Word. Tester Word/LibreOffice selon les outils réellement pris en charge.

Chaque export stocke version de rapport, version de modèle, moteur, hash et date. Le PDF et le DOCX téléchargés doivent correspondre à la même version approuvée. Contrôler les ressources embarquées ; ne pas charger des URL arbitraires depuis le moteur de rendu.

## 10. Compléments SaaS indispensables

### Expérience et confiance

- Accueil : exemple réel anonymisé avec sources/légendes, formats acceptés exacts, limites, étapes de relecture, tarif et prestation explicites. Retirer la promesse multi-domaines tant que ces modèles ne sont pas évalués.
- Tableau de bord : prochaine action, état du dossier, dernier export, travaux en attente et consommation restante. Ne pas placer « Générer » en premier lorsque le dossier n’est pas prêt.
- Pages d’aide, contact/support, confidentialité, conditions de service et politique d’usage académique. Leur contenu juridique doit être adapté au marché et validé avec la personne compétente ; aucune conformité n’est certifiée par ce cahier des charges.
- Expliquer les données envoyées aux API, la conservation, l’export des données personnelles et les modalités de suppression.
- Accessibilité : navigation clavier, focus, libellés, contrastes, erreurs de formulaires, annonces de progression et tests d’écran étroit. La revue locale a constaté l’étroitesse de l’éditeur, sans couvrir tous les appareils.

### Exploitation

- Séparer démonstration, test et production. Vérifier par des tests que seed, comptes de démo et paiement simulé restent indisponibles en production ; des garde-fous existent déjà dans le code.
- Secrets côté serveur, rotation des clés exposées, droits minimaux et aucune clé dans le navigateur/logs.
- Sauvegarder base et fichiers ; réaliser une restauration testée avant lancement. Définir durée de conservation et délai d’effacement, y compris le traitement des sauvegardes.
- Suppression en plusieurs étapes traçables : interdire nouveaux jobs, arrêter ceux du projet, supprimer les objets/chunks/exports, traiter les références DB, relancer les suppressions échouées. Un worker ne doit pas recréer des données après suppression.
- Mesurer temps en file, durée par étape, erreurs d’import, 429/5xx, reprises, échecs d’export, coût et saturation. Une alerte doit mener à une action support.
- Déploiements avec migrations versionnées, vérification préalable, rollback documenté et healthchecks adaptés au web, worker et stockage.

### Paiements

Achever la recette de l’intégration existante : achat, renouvellement, échec, annulation, changement de plan et rapprochement de l’état de l’abonnement. Tester deux webhooks simultanés, doublons et arrivée dans un ordre différent ; l’idempotence déjà présente doit être vérifiée sous concurrence. Stripe documente explicitement les doublons et l’absence de garantie d’ordre. [Documentation Stripe](https://docs.stripe.com/webhooks).

Les droits sont toujours calculés côté serveur. Afficher date de renouvellement, limites, politique de crédits et accès au portail. Une redirection réussie après Checkout ne doit pas être l’unique preuve du paiement.

## 11. Plan de réalisation pour le développeur

Les lots ci-dessous donnent l’ordre de dépendance. Ils ne sont pas une estimation contractuelle de délai ; les parsers, l’export et l’exploitation doivent être prototypés avant chiffrage.

| Lot | Travail | Dépendances | Démonstration attendue |
|---|---|---|---|
| A — Contrat produit | Fixer périmètre/langues, modèle classique + audit, grille qualité, règles de crédits ; corriger les succès de démonstration et promesses fausses. | Aucune | Parcours cible et modèles approuvés ; chaque bouton visible a une action réelle. |
| B — Sources et preuves | Extraction, statuts, stockage, provenance, classement des fichiers, recherche évaluée, registre de faits. | A pour les exigences | Un PDF long alimente une section avec preuve située au-delà des premières pages. |
| C — Exécution durable | Worker/file, admission idempotente, leases, checkpoints, coûts, gestion des fournisseurs, suppression sûre. | Peut avancer avec B après les contrats A | Interruption/reprise au milieu du rapport sans perte ni double crédit. |
| D — Méthode et rédaction | Brief/plan approuvés, modèles hiérarchiques, rédaction par contrat, contrôles de preuves, états à revoir. | B + C | Deux projets logiciel/audit produisent des plans adaptés et aucun résultat n’est complété sans données. |
| E — Révision et documents | Versions/éditeur, figures/tableaux/citations, aperçu, DOCX/PDF complets et contrôle de mise en page. | D ; prototype de rendu possible dès A | Rapport cohérent exporté, relu et corrigé sans perdre citations ou pagination. |
| F — Bêta SaaS | Paiements de test, limites cohérentes, données personnelles, support, monitoring, restauration et tests d’isolation. | B–E | Parcours complet réalisable par un nouvel utilisateur, avec reprise et suppression contrôlées. |
| G — Après retours | Scrum/expérimental, amélioration recherche, collaboration encadrant et modèles supplémentaires. | Bêta évaluée | Une extension répond à un besoin observé et passe la même grille qualité. |

### Modifications de données et interfaces

Conserver `Project`, `ProjectIntake`, `ProjectBrief`, `Report`, `GenerationJob`, les utilisateurs et la facturation. Introduire progressivement :

- `ReportTemplate` et version : structure, profil de rendu, exigences de contenu.
- `SourceVersion` / `SourceChunk` : extraction et repères ; migration des fragments existants avec provenance explicitement limitée.
- `ProjectFact` / `Evidence` / `BibliographyEntry` / `Asset` : données réutilisables avec propriétaire et statut.
- `OutlineVersion` / `ReportVersion` : snapshots JSON structurés possibles au MVP ; normaliser les sections en tables si les besoins de concurrence/requête le justifient.
- `QualityIssue` / `ExportArtifact` : contrôles et fichiers liés à une version.
- Extension de `GenerationJob` : état, étape, clé d’idempotence, heartbeat, lease, tentative, prochaine tentative, versions, compteurs de coût. Ajouter un registre de réservation de quota avec unicité par opération.

Toutes les références vérifient le propriétaire via le projet. Les versions approuvées sont immuables ; corriger produit une nouvelle version. Conserver les anciens rapports comme `legacy` lisibles, sans leur attribuer une validation qu’ils n’ont pas passée.

API cibles, à adapter aux routes existantes :

| Opération | Comportement serveur |
|---|---|
| Import / statut d’extraction | Retourner un identifiant de travail, pages traitées, erreurs et qualité ; afficher seulement des détails publics. |
| Création/approbation de brief et plan | Valider schéma, version attendue, propriétaire et dossier ; enregistrer l’approbation explicite. |
| Lancement génération | Exiger les versions approuvées ; accepter une clé d’idempotence ; retourner `202` et le même job en cas de répétition. |
| Reprise / annulation | Authentifier, vérifier l’état, conserver le checkpoint, appliquer la règle de crédit une seule fois. |
| Modification d’une section | Exiger la version de base ; `409` si conflit ; créer une nouvelle version et invalider les validations concernées. |
| Contrôle qualité / approbation finale | Retourner les problèmes localisés ; bloquer l’approbation si problème critique ; ne pas confondre approbation et génération. |
| Export d’une version | Vérifier droits et état, lancer le rendu, fournir un téléchargement privé temporaire. |
| Suppression projet/compte | Créer un traitement de suppression suivi ; annoncer précisément l’état et les éventuelles obligations de conservation. |

### Recette et seuils de lancement proposés

Ces critères sont des objectifs futurs, pas des résultats mesurés pendant cette revue.

1. **Corpus** : dossiers autorisés couvrant logiciel, audit, documents incomplets, contradictions, PDF scanné, tableaux et sources malveillantes. Les cinq rapports servent à tester structure et rendu ; ils ne prouvent pas les faits d’un nouveau projet et ne sont pas publiés comme démos sans autorisation.
2. **Extraction/recherche** : sur une liste préparée d’au moins 20 passages attendus répartis dans les documents, viser au moins 90 % retrouvés dans les cinq premiers résultats ; localisateurs corrects pour tous les passages utilisés. Consigner les cas non traités/OCR.
3. **Exactitude** : zéro référence inventée ou résultat chiffré non justifié dans l’échantillon de lancement relu ; chaque claim critique dispose d’une preuve ou reste explicitement non validé. Le simple fait qu’une URL existe n’est pas suffisant.
4. **Méthode** : chaque objectif possède une méthode d’évaluation ou une limite explicitée ; un projet audit ne reçoit pas automatiquement des chapitres de développement ; un dossier sans résultats produit des tâches à compléter.
5. **Cohérence** : dates, organisme, versions, termes et chiffres concordent ; bibliographie réellement structurée ; pas de chaînes parasites, doublons de titres ou références à des figures inexistantes.
6. **Reprise** : provoquer arrêt du worker, timeout, `429`, `5xx`, réponse mal formée, changement de source et deux lancements concurrents. Attendu : progression conservée, pas de publication double, pas de double consommation ni double remboursement.
7. **Export** : vérifier couverture, sommaire et références après ajout/suppression d’un chapitre ; inspecter toutes les pages d’un petit jeu de rapports longs ; aucun débordement, texte illisible, caractère perdu ou tableau coupé incorrectement.
8. **SaaS** : tests croisés avec deux utilisateurs pour projets, chunks, jobs, assets, exports et URLs privées ; suppression complète ; limites de fichiers cohérentes ; webhook dupliqué/désordonné ; restauration de sauvegarde.
9. **Utilisabilité** : petit pilote conseillé de 5–10 étudiants et 1–2 encadrants, avec autorisation d’usage des dossiers. Mesurer temps jusqu’au plan validé, taux de sections acceptées après relecture, corrections factuelles et réussite de l’export. Une section inchangée n’est pas automatiquement exacte.

**Condition d’ouverture payante :** toutes les exigences P0 sont démontrées sur l’environnement cible ; les problèmes critiques de qualité sont bloquants ; support, coûts et restauration ont été vérifiés. Ajouter ensuite les variantes et optimisations à partir des retours.

## 12. Carte des fichiers examinés

Racine du dépôt : `C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1`.

| ID | Fichier / point de départ |
|---|---|
| E1 | [Import des documents](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/app/api/projects/[id]/documents/route.ts:45) — extraction, stockage, fragments et suppression unitaire. |
| E2 | [Lancement du rapport](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/app/api/projects/[id]/generate-report/route.ts:29) — préconditions, sélection des sources, quota et exécution. |
| E3 | [Génération IA](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/lib/report-generation.ts:471) — contrats de plan, style, longueur et checkpoints. |
| E4 | [Exports](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/lib/report-export.ts:72) — composition et traitement des caractères. |
| E5 | [Droits et aperçu](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/lib/entitlements.ts:180) — sommaire, pages estimées et plans. |
| E6 | [Paramètres utilisateur](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/components/views/settings-view.tsx:86) — université et actions de démonstration. |
| E7 | [Proxy](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/proxy.ts:7) — limite d’import et limitation en mémoire. |
| E8 | [Projet](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/app/api/projects/[id]/route.ts) — lecture, modification et suppression. |
| E9 | [API du rapport](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/app/api/reports/[id]/route.ts:136) et [éditeur](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/components/views/report-editor-view.tsx) — sauvegarde, révision et navigation. |
| E10 | [Schéma Prisma](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/prisma/schema.prisma:242) — documents, rapports, jobs et embeddings. |
| E11 | [Accueil](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/app/page.tsx) — positionnement, promesses et tarification. |
| E12 | [Navigation interne](C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/src/lib/store.ts) — état des vues et identifiants sélectionnés. |

Avant toute implémentation Next.js, respecter le fichier AGENTS.md du dépôt et lire les guides pertinents de la version installée dans `C:/Users/user/Downloads/saas-rag-academic-report.worktrees/attachment-pasted-text-1/node_modules/next/dist/docs/`.

## 13. Ordre de démarrage concret

Commencer par un parcours vertical : **un projet audit ou logiciel → un PDF réellement lu → des faits confirmés → un plan approuvé → un chapitre avec preuves → un DOCX/PDF correctement composé → interruption et reprise réussies**. Ce parcours démontre la valeur principale et expose les risques d’extraction, de génération et de rendu avant de multiplier les fonctionnalités.

Le premier livrable développeur doit être cette tranche fonctionnelle, accompagnée d’un rapport de recette et d’un coût mesuré. Une refonte graphique ou un changement de modèle IA seul ne résoudra pas les écarts constatés.
