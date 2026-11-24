// Ambiente de PRODUCCIÓN (ng build): lo usa el sitio publicado en Firebase Hosting.
// Sustituye a environment.ts automáticamente (fileReplacements en angular.json).
export const environment = {
  production: true,

  backend: {
    url: 'https://liveplanbackend.liidutpl.ec'
  },

  firebase: {
    apiKey: 'AIzaSyD9cuGR40LdTuh21Uy_ZRmUAHP4Guyx3Jc',
    authDomain: 'liveplan-frontend.firebaseapp.com',
    projectId: 'liveplan-frontend',
    storageBucket: 'liveplan-frontend.firebasestorage.app',
    messagingSenderId: '828784072956',
    appId: '1:828784072956:web:5fa43c08318dfbfe841f79'
  }
};