# Poupoules v3

Le carnet du poulailler : récolte du jour dans une boîte à œufs, stock et fraîcheur, poules, soins et routines, bilan mensuel. PWA en vanilla JS, synchronisée avec Firebase.

## Lancer en local

```bash
python3 -m http.server 4173
```

Ouvrir <http://localhost:4173>. Sur iPhone : Safari → Partager → Sur l’écran d’accueil.

## Écrans

- **Accueil — La récolte** : une boîte de 12 alvéoles. Un tap pose un œuf, chaque tap suivant change sa couleur (dans l’ordre des couleurs choisies dans les réglages), puis le retire. Une deuxième boîte apparaît au-delà de 12 œufs. Flèches ‹ › pour les jours précédents, calendrier en touchant la date, graphique des 7 derniers jours (un jour oublié s’affiche en pointillés avec « ? »). Bouton « Aucun œuf aujourd’hui » pour distinguer un jour sans ponte d’un oubli. Widgets stock et météo (alerte gel ou forte chaleur).
- **Œufs** : stock calculé (les plus anciens sortent en premier), fraîcheur (< 7 j, 1–3 semaines, 3–4 semaines à consommer vite, > 28 jours), sorties consommés / vendus / donnés / cassés (par boîte de 6 ou à l’unité, prix et client pour les ventes), inventaire pour corriger le stock, journal complet.
- **Poules** : liste par couleur d’œuf, recherche, au repos, cimetière. Fiche avec photo, race, arrivée et âge, ponte estimée de la couleur, soins à venir et historique, suivis en cours (mue, couvaison).
- **Soins** : routines du jour à cocher (badge sur l’onglet), tâches ajoutées par la météo, routines à venir, suivis en cours, historique. Routines par défaut : eau, aliment et grit (tous les jours), pondoirs et abreuvoir (chaque semaine), litière (toutes les 2 semaines), grand nettoyage et coquilles d’huîtres (tous les mois), vermifuge (tous les 6 mois), contrôle des poux rouges (mensuel d’avril à octobre).
- **Bilan** : œufs, moyenne par jour noté, coût par œuf, recettes, dépenses, solde ; production sur 12 mois, répartition par couleur, destination des œufs, dépenses du mois.
- **Réglages** : compte (Google ou e-mail), prénom, prix de la boîte de 6 (1,50 € par défaut), couleurs d’œufs, export / import JSON, forcer la mise à jour, suppression complète.
- **iPhone ouvert / tablette** (≥ 720 px) : mises en page sur 2 colonnes, liste des poules et fiche côte à côte.

## Données et synchronisation

- Sans compte, tout reste sur l’appareil (`localStorage`, clé `poupoules-v3`).
- Connecté, tout est synchronisé dans Firestore sous `users/{uid}/…` : `hens`, `days` (un document par date), `moves`, `tasks`, `care`, `expenses`, et `meta/settings`. Le cache hors ligne de Firestore est activé.
- Le SDK Firebase est chargé à la demande : l’app démarre même hors ligne.

### Migration depuis la v2.5

- Au premier lancement, les données locales de la v2.5 (`poupoules-state`) sont converties : poules (les 6 poules de démo jamais modifiées sont ignorées), récoltes, achats (→ dépenses), ventes (→ recettes), prix de la boîte, prénom.
- À la première connexion, les anciennes récoltes Firestore (`egg_entries`) sont aussi reprises, puis tout est envoyé dans la nouvelle structure.
- Couleurs : crème → blanc, chocolat et tacheté → brun, vert → bleu.
- Le stock démarre le jour de la migration : faire un inventaire dans l’onglet Œufs.

### Règles Firestore

À publier dans Firebase Console → Firestore Database → Rules :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Anciennes récoltes v2.5 : lecture pour la migration, suppression possible.
    match /egg_entries/{entryId} {
      allow read, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

Aucun index composite n’est nécessaire.

## Version

**3.0.0** — à chaque livraison, mettre à jour `APP_VERSION` dans `app.js`, `VERSION` dans `sw.js` et le `?v=` dans `index.html`.
