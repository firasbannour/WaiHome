// context/NotificationContext.tsx
import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io, { Socket } from 'socket.io-client';

interface MedicamentEvt  { patientId?: string }
interface RendezvousEvt  { patientId?: string }
interface MessageEvt     { patientId?: string; senderName: string }

interface NotificationContextProps {
  hasNewMedicament : boolean
  setHasNewMedicament : (v: boolean) => void
  hasNewRendezvous : boolean
  setHasNewRendezvous : (v: boolean) => void
  hasNewMessage    : boolean
  setHasNewMessage    : (v: boolean) => void
}

export const NotificationContext = createContext<NotificationContextProps>({
  hasNewMedicament    : false,
  setHasNewMedicament : () => {},
  hasNewRendezvous    : false,
  setHasNewRendezvous : () => {},
  hasNewMessage       : false,
  setHasNewMessage    : () => {},
});

interface Props { children: ReactNode }
const SOCKET_URL = 'http://192.168.100.193:5000';

export const NotificationProvider = ({ children }: Props) => {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [hasNewMedicament, setHasNewMedicament] = useState(false);
  const [hasNewRendezvous, setHasNewRendezvous] = useState(false);
  const [hasNewMessage,    setHasNewMessage]    = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    async function loadPatientId() {
      const id = await AsyncStorage.getItem('patientId');
      setPatientId(id);
    }
    loadPatientId();
  }, []);

  useEffect(() => {
    if (!patientId) return;
    
    const initSocket = async () => {
      try {
        const { default: io } = await import('socket.io-client');
        socketRef.current = io(SOCKET_URL);

        socketRef.current.on('newMedicament', (e: MedicamentEvt) => {
          if (e.patientId === patientId) {
            setHasNewMedicament(true);
          }
        });

        socketRef.current.on('newRendezvous', (e: RendezvousEvt) => {
          if (e.patientId === patientId) {
            setHasNewRendezvous(true);
          }
        });

        socketRef.current.on('newMessage', (e: MessageEvt) => {
          if (e.patientId === patientId && e.senderName !== 'Patient') {
            setHasNewMessage(true);
          }
        });
      } catch (error) {
        console.log('Socket connection error:', error);
      }
    };

    initSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [patientId]);

  return (
    <NotificationContext.Provider
      value={{
        hasNewMedicament,  setHasNewMedicament,
        hasNewRendezvous,  setHasNewRendezvous,
        hasNewMessage,     setHasNewMessage,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
