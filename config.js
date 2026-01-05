// config.js - Frontend Configuration
(function() {
  // Detect environment
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
  
  // Configuration for different environments
  const configs = {
    development: {
      apiUrl: 'http://localhost:3000',
      aiServiceUrl: 'http://localhost:5000',
      firebaseConfig: {
        apiKey: "AIzaSyA-OqVS4u4qLnOEtmpjiF5SB70Z7kp04-o",
        authDomain: "safecity-c191a.firebaseapp.com",
        projectId: "safecity-c191a",
        storageBucket: "safecity-c191a.firebasestorage.app",
        messagingSenderId: "122742447524",
        appId: "1:122742447524:web:89abd64764bb2dd1737531"
      }
    },
    production: {
      apiUrl: 'https://nagrik-raskshak-f8t1.onrender.com', // Will update after deployment
      aiServiceUrl: 'https://nagrik-ai-service.onrender.com', // Will update
        firebaseConfig: {
        apiKey: "AIzaSyA-OqVS4u4qLnOEtmpjiF5SB70Z7kp04-o",
        authDomain: "safecity-c191a.firebaseapp.com",
        projectId: "safecity-c191a",
        storageBucket: "safecity-c191a.firebasestorage.app",
        messagingSenderId: "122742447524",
        appId: "1:122742447524:web:89abd64764bb2dd1737531"
      }
    }
  };
  
  // Select config based on environment
  const config = isLocalhost ? configs.development : configs.production;
  
  // Make it globally available
  window.APP_CONFIG = config;
  
  // Log for debugging
  console.log(`Running in ${isLocalhost ? 'Development' : 'Production'} mode`);
  console.log('API URL:', config.apiUrl);
})();
