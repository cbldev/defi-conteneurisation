# Défi : conteneuriser une application complète

## Mission

Conteneurisez cette application et PostgreSQL 17. Écrivez vous-même le `Dockerfile`,
le `.dockerignore` et le `compose.yaml` : aucun de ces fichiers n’est fourni.

## Application fournie

- Node.js 24 LTS ; installation : `npm ci` ; démarrage : `npm start`.
- Écoute sur `0.0.0.0:3000` ; connexion PostgreSQL via `DATABASE_URL`.
- La table est créée au démarrage : aucune migration manuelle.
- `GET /` affiche un formulaire si aucun pseudo n’existe.
- `POST /` enregistre le pseudo ; le premier pseudo est partagé par tous et ne peut
  pas être remplacé. Les pages suivantes affichent « Bonjour &lt;pseudo&gt; ».
- Pseudo : 1 à 50 caractères Unicode, espaces périphériques retirés.
- `GET /health` interroge réellement la base : **200** si elle répond, **503** sinon.
- La base doit être disponible au démarrage ; sinon le processus échoue.

Le code, le `package-lock.json`, les tests et le `.env.example` sont fournis.
Il n’y a ni compte utilisateur, ni cookie, ni commande de migration à lancer.

## Essai local facultatif, sans conteneurisation de l’application

Prérequis : Node.js 24, npm et une base PostgreSQL 17 accessible.
Créez au préalable une base et un utilisateur autorisé à y créer une table.
Copiez `.env.example` vers `.env` et adaptez la connexion.

```sh
npm ci
node --env-file=.env src/server.js
```

Le script `npm start` suppose que `DATABASE_URL` est déjà injectée dans
l’environnement. La commande ci-dessus est uniquement un raccourci local
pour lire le fichier `.env` ; l’application ne le charge pas elle-même.

Ouvrez ensuite <http://localhost:3000>.

## Travail demandé

### 1. Image applicative

Écrivez **manuellement** un Dockerfile basé sur une image officielle Node.js compatible.
L’installation doit utiliser le lockfile avec `npm ci` et le service doit démarrer
avec `npm start`. Exécutez le processus **sans privilèges root**. N’incorporez aucun
secret et ne transmettez pas les identifiants de base pendant la construction.
N’ajoutez pas d’outil inutile à l’exécution. Construisez et nommez votre image.

### 2. Contexte de construction

Écrivez un `.dockerignore`. Excluez les secrets et fichiers d’environnement locaux,
les dépendances installées sur l’hôte, les métadonnées Git, les journaux, les tests
et la documentation sans utilité dans l’image. Vérifiez aussi que le Dockerfile
ne copie que les fichiers nécessaires.

### 3. Assemblage

Écrivez un `compose.yaml` qui :

- construit l’image applicative et démarre l’application et PostgreSQL **17** ;
- publie le port **3000** de l’application ;
- injecte `DATABASE_URL` à l’exécution, avec le **nom du service de base** comme hôte ;
- configure la base, son utilisateur et son mot de passe de façon cohérente ;
- monte un **volume nommé** sur le répertoire de données de PostgreSQL 17 ;
- définit un **healthcheck PostgreSQL** et attend sa bonne santé avant de démarrer
  l’application.

`localhost` dans le conteneur applicatif ne désigne pas le conteneur PostgreSQL.
Le fichier `.env` de Compose permet l’interpolation : il n’injecte pas à lui seul
toutes ses variables dans le conteneur. Évitez de publier le port PostgreSQL si
cela n’est pas nécessaire. Les identifiants d’exemple sont réservés au développement.

### 4. Démarrage et preuves

Démarrez votre assemblage, puis collectez les **sorties réelles** :

```sh
docker compose up --build -d
docker compose ps
curl -i http://localhost:3000/health
curl -i http://localhost:3000/
curl -i --data-urlencode 'pseudo=Ada' http://localhost:3000/
curl -i http://localhost:3000/
```

Attendus sur une base vide : services démarrés, base saine, santé HTTP 200,
formulaire, redirection 303 après l’enregistrement, puis « Bonjour Ada ».
curl est exécuté **depuis l’hôte** : inutile de l’installer dans l’image applicative.

### 5. Persistance

Une fois le pseudo enregistré :

```sh
docker compose down
docker compose up -d
docker compose ps
curl -i http://localhost:3000/health
curl -i http://localhost:3000/
```

La salutation doit rester présente après recréation des conteneurs.
**Ne supprimez pas les volumes : `docker compose down -v` détruit les données.**

## Rendu et critères de réussite

- Dockerfile écrit manuellement, image officielle et processus non-root.
- `.dockerignore` pertinent ; aucun secret ni fichier inutile dans l’image.
- `compose.yaml` avec les deux services, PostgreSQL 17, volume et healthcheck.
- Référence de l’image construite localement (nom et tag).
- Sorties réelles de `docker compose ps` et des commandes curl, avant et après
  recréation des conteneurs, dans un fichier `PREUVES.md`.
- Explication courte de vos choix de sécurité, de disponibilité et de persistance.
- Aucun mot de passe ni URL de connexion contenant un secret dans les preuves.

Il n’est pas demandé de publier l’image sur un registre ni de déployer dans le cloud.

## Tests du code fourni

```sh
npm test
```

Les tests HTTP et de configuration ne nécessitent pas de base.
Pour l’intégration, utilisez **une base PostgreSQL 17 jetable dédiée**, jamais votre
base de développement : ce test supprime la table `nickname` de la base sélectionnée.

```sh
TEST_DATABASE_URL=postgresql://utilisateur:motdepasse@127.0.0.1:5432/defi_test npm run test:integration
```

Sans `TEST_DATABASE_URL`, l’intégration est ignorée, et non validée.
