// Ambiente de DESARROLLO (ng serve): el backend corre en tu máquina.
// Para producción se usa environment.prod.ts (ng build lo sustituye solo, ver "fileReplacements" en angular.json).
// Esta configuración de Firebase es pública por naturaleza (viaja en el navegador): no es un secreto.
export const environment = {
  production: false,

  backend: {
    url: 'http://localhost:8080'
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