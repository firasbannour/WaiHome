// Mock pour react-native-ble-plx
export enum State {
  Unknown = 'Unknown',
  Resetting = 'Resetting',
  Unsupported = 'Unsupported',
  Unauthorized = 'Unauthorized',
  PoweredOff = 'PoweredOff',
  PoweredOn = 'PoweredOn',
}

export class BleManager {
  constructor() {
    console.log('BleManager mock initialized');
  }
  
  onStateChange(listener: (state: State) => void, emitCurrentState: boolean = false) {
    if (emitCurrentState) {
      setTimeout(() => listener(State.PoweredOn), 0);
    }
    return { remove: () => {} };
  }

  startDeviceScan() {
    console.log('Mock: startDeviceScan called');
  }
  
  stopDeviceScan() {
    console.log('Mock: stopDeviceScan called');
  }
  
  connectToDevice() {
    console.log('Mock: connectToDevice called');
    return Promise.resolve(new Device());
  }
  
  discoverAllServicesAndCharacteristicsForDevice() {
    console.log('Mock: discoverAllServicesAndCharacteristicsForDevice called');
    return Promise.resolve(new Device());
  }
}

export class Device {
  id: string = 'mock-device-id';
  name: string = 'Mock Device';
  localName: string = 'Mock Device';
  rssi: number = -50;

  async discoverAllServicesAndCharacteristics() {
    console.log('Mock Device: discoverAllServicesAndCharacteristics called');
    return this;
  }

  monitorCharacteristicForService(
    serviceUUID: string,
    characteristicUUID: string,
    callback: (error: BleError | null, characteristic: Characteristic | null) => void
  ) {
    console.log('Mock Device: monitorCharacteristicForService', serviceUUID, characteristicUUID);
    const characteristic = new Characteristic();
    characteristic.serviceUUID = serviceUUID;
    characteristic.uuid = characteristicUUID;
    setTimeout(() => callback(null, characteristic), 0);
    return { remove: () => {} };
  }
}

export class Service {
  uuid: string = 'mock-service-uuid';
  isPrimary: boolean = true;
}

export class Characteristic {
  uuid: string = 'mock-characteristic-uuid';
  serviceUUID: string = 'mock-service-uuid';
  isReadable: boolean = true;
  isWritableWithResponse: boolean = true;
  isWritableWithoutResponse: boolean = false;
  isNotifiable: boolean = true;
  isIndicatable: boolean = false;
}

export class BleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BleError';
  }
}
