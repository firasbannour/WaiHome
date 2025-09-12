// Utilitaires pour la gestion des composants avec structure détaillée

export interface DetailedComponent {
  name: string;
  relay: number;
  status: boolean;
  power: number;
  voltage: number;
  current: number;
  energy: number;
  temperature: number;
  frequency?: number;
}

export interface DetailedComponents {
  pump: DetailedComponent;
  heater: DetailedComponent;
  auger: DetailedComponent;
  highWater: DetailedComponent;
}

// Fonction pour créer des composants avec tous les détails complets
export const createDetailedComponents = (deviceId: string): DetailedComponents => {
  return {
    pump: {
      name: "Pump",
      relay: 0,
      status: false,
      power: 0,
      voltage: 0,
      current: 0,
      energy: 0,
      temperature: 0,
      frequency: 0,
    },
    heater: {
      name: "Heater",
      relay: 1,
      status: false,
      power: 0,
      voltage: 0,
      current: 0,
      energy: 0,
      temperature: 0,
      frequency: 0,
    },
    auger: {
      name: "Auger",
      relay: 2,
      status: false,
      power: 0,
      voltage: 0,
      current: 0,
      energy: 0,
      temperature: 0,
      frequency: 0,
    },
    highWater: {
      name: "High Water Alarm",
      relay: 3,
      status: false,
      power: 0,
      voltage: 0,
      current: 0,
      energy: 0,
      temperature: 0,
      frequency: 0,
    },
  };
};

// Fonction utilitaire pour mettre à jour un composant avec structure détaillée
export const updateComponentDetailed = (
  components: DetailedComponents,
  componentName: keyof DetailedComponents,
  newStatus: boolean,
): DetailedComponents => {
  if (!components || !components[componentName]) {
    return components;
  }

  return {
    ...components,
    [componentName]: {
      ...components[componentName],
      status: newStatus,
    },
  } as DetailedComponents;
};

// Fonction pour convertir des composants simples (booléens) en composants détaillés
export const convertSimpleToDetailedComponents = (
  simpleComponents: Record<string, boolean>,
): DetailedComponents => {
  const detailed = createDetailedComponents("");

  Object.keys(simpleComponents).forEach((componentName) => {
    if (componentName in detailed) {
      (detailed as any)[componentName].status = simpleComponents[componentName];
    }
  });

  return detailed;
};

// Fonction pour s'assurer que les composants ont la structure détaillée
export const ensureDetailedComponents = (components: any): DetailedComponents => {
  if (!components) {
    return createDetailedComponents("");
  }

  // Vérifier si c'est déjà la structure détaillée
  const first = components[Object.keys(components)[0]] as any;
  if (first && typeof first === "object" && "name" in first && "relay" in first) {
    return components as DetailedComponents;
  }

  // Sinon, convertir depuis la structure simple
  return convertSimpleToDetailedComponents(components);
};


