# Poupoules

Première version locale de la webapp iOS-first pour gérer un poulailler et suivre les récoltes d’œufs.

## Lancer en local

```bash
python3 -m http.server 4173
```

Puis ouvrir <http://localhost:4173> dans Safari ou Chrome. Pour l’installer sur iPhone, ouvrir l’URL en Safari puis **Partager → Sur l’écran d’accueil**.

## Fonctionnalités incluses

- Tableau de bord responsive style Apple avec métriques du jour.
- Graphique de production sur 7 ou 14 jours.
- Journal des activités récentes.
- Équipe des poules avec races et statut.
- Ajout d’une récolte d’œufs, sauvegarde locale et export JSON.
- Synchronisation Firestore préparée sur `egg_entries` avec bascule automatique en mode démo si Firebase n’est pas accessible.
- PWA installable et cache offline.

## Firebase

La configuration client fournie se trouve dans `firebase-config.js`. Il faudra activer l’authentification (idéalement anonyme au début) et publier des règles Firestore avant un usage multi-utilisateur. La clé API web n’est pas un secret ; la protection doit être faite par les règles Firestore et l’authentification.

L’icône `icon.png` est utilisée automatiquement si elle est ajoutée à la racine du projet. Elle n’était pas présente dans le dossier reçu au moment de la génération.
