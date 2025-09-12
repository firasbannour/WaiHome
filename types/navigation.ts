// types/navigation.ts
export type RootStackParamList = {
  signup: undefined;
  login: undefined;
  pendingConfirmation: { email: string };
  confirmSignup: { email: string };
  accountExists: { email: string };
  MainPage: undefined;
  forgotPassword: undefined;
};

// Type pour la navigation
export type NavigationProp = {
  navigate: <RouteName extends keyof RootStackParamList>(
    name: RouteName,
    params?: RootStackParamList[RouteName]
  ) => void;
  goBack: () => void;
  reset: (state: any) => void;
};
