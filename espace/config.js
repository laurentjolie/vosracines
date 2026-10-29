// Configuration Firebase du projet Vos Racines (à remplir une fois le projet créé : console Firebase > Paramètres du projet > Vos applications > Web).
// Ces valeurs sont publiques par nature : la sécurité repose sur les règles Firestore (firestore.rules), pas sur leur secret.
export const FIREBASE = {
  apiKey: 'AIzaSyANND96hxSla4dMzwOW2yVeUnH_nws6AaU',
  authDomain: 'vosracines-espace.firebaseapp.com',
  projectId: 'vosracines-espace',
  appId: '1:411886208703:web:ee55aef39fa57c8fdee80a',
};
// Développement : émulateurs locaux (firebase emulators:start) quand la page est servie depuis localhost.
export const EMULATEURS = ['localhost', '127.0.0.1'].includes(location.hostname) && !new URLSearchParams(location.search).has('dev');
export const CONTACT = 'contact@vosracines.fr';
