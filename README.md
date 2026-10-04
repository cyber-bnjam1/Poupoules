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
- Pages séparées Accueil, Journal, Poules et Statistiques avec navigation persistante.
- Journal fonctionnel avec ajout de récoltes depuis sa propre page.
- Authentification Firebase par e-mail / mot de passe, création de compte, profil et déconnexion.
- Mode démo local activable depuis l’écran de connexion si Email/Password n’est pas encore activé.
- Synchronisation Firestore sécurisée par `userId` sur `egg_entries`, avec bascule automatique en mode démo si Firebase n’est pas accessible.
- Statistiques avancées : taux de ponte moyen, comparaison par race, revenus, coûts d’alimentation, autres coûts et résultat net paramétrable.
- PWA installable et cache offline.

## Firebase

La configuration client fournie se trouve dans `firebase-config.js`. Il faut activer **Authentication → Sign-in method → Email/Password** dans Firebase, puis publier des règles Firestore avant un usage multi-utilisateur. Si ce fournisseur n’est pas encore activé, l’écran affiche maintenant l’erreur exacte et propose le mode démo local. La webapp filtre les récoltes par `userId`. La clé API web n’est pas un secret ; la protection doit être faite par les règles Firestore et l’authentification.

L’icône `icon.png` existante du dépôt est conservée et utilisée par la PWA.

### Règles Firestore de départ

À publier dans Firebase Console → Firestore Database → Rules (à adapter si d’autres collections sont ajoutées) :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /egg_entries/{entryId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

Pour les requêtes avec `where('userId', '==', user.uid)` et `orderBy('createdAt')`, Firebase peut demander la création d’un index composite : le lien est fourni automatiquement dans la console si nécessaire.
