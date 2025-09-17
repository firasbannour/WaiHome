const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

const withNetworkSecurity = (config) => {
  // Configurer le manifest Android
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // Ajouter usesCleartextTraffic au Application
    const application = androidManifest.manifest.application[0];
    if (application && application.$) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    
    return config;
  });

  // Configurer MainApplication.java pour les permissions réseau
  config = withMainApplication(config, (config) => {
    const mainApplication = config.modResults;
    
    // Ajouter les imports nécessaires
    if (!mainApplication.contents.includes('import android.os.StrictMode;')) {
      mainApplication.contents = mainApplication.contents.replace(
        'import android.app.Application;',
        'import android.app.Application;\nimport android.os.StrictMode;'
      );
    }
    
    // Ajouter la configuration StrictMode pour permettre les connexions réseau
    if (!mainApplication.contents.includes('StrictMode.setThreadPolicy')) {
      mainApplication.contents = mainApplication.contents.replace(
        'super.onCreate();',
        `super.onCreate();
        
        // Permettre les connexions réseau pour les Shelly
        StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
        StrictMode.setThreadPolicy(policy);`
      );
    }
    
    return config;
  });

  return config;
};

module.exports = withNetworkSecurity;
