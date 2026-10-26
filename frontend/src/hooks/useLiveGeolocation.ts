import { useState, useCallback, useRef, useEffect } from 'react';
import { isWithinCampusBounds } from '../services/campusBounds';

export type GpsTrackingStatus =
  | 'idle'
  | 'searching'
  | 'active'
  | 'out_of_campus'
  | 'permission_denied'
  | 'unsupported';

export interface GpsErrorModalState {
  title: string;
  message: string;
}

interface UseLiveGeolocationOptions {
  onPositionUpdate?: (lat: number, lon: number, accuracyM: number) => void;
  onNotice?: (message: string) => void;
}

/**
 * Isolated Live Geolocation Hook.
 * Manages navigator.geolocation independently from the core A* routing engine.
 *
 * Guarantees:
 * 1. Off-campus coordinates (common on PC Wi-Fi/ISP geolocation) NEVER activate GPS mode or leak into the core navigation origin.
 * 2. When outside campus, immediately stops watching and triggers an explicit error dialog ("Kampüs Sınırları Dışındasınız").
 * 3. 100% opt-in: stays completely hidden/idle unless explicitly activated from the menu.
 */
export function useLiveGeolocation({ onPositionUpdate, onNotice }: UseLiveGeolocationOptions = {}) {
  const [isLiveGpsActive, setIsLiveGpsActive] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<GpsTrackingStatus>('idle');
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [gpsErrorModal, setGpsErrorModal] = useState<GpsErrorModalState | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const onNoticeRef = useRef(onNotice);

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    onNoticeRef.current = onNotice;
  }, [onNotice]);

  const stopLiveGps = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setIsLiveGpsActive(false);
    setGpsStatus('idle');
    setGpsAccuracyMeters(null);
  }, []);

  const clearGpsErrorModal = useCallback(() => {
    setGpsErrorModal(null);
  }, []);

  const startLiveGps = useCallback(() => {
    if (watchIdRef.current !== null) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      setIsLiveGpsActive(false);
      setGpsErrorModal({
        title: 'GPS Desteklenmiyor',
        message: 'Tarayıcınız canlı GPS konum servisini desteklemiyor.',
      });
      return;
    }

    setGpsErrorModal(null);
    setGpsStatus('searching');
    onNoticeRef.current?.('📡 Canlı GPS konumu kontrol ediliyor...');

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // Strict boundary check: If user is at home / outside GTÜ campus, stop immediately and show error dialog!
        if (!isWithinCampusBounds(latitude, longitude)) {
          if (watchIdRef.current !== null && 'geolocation' in navigator) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          setIsLiveGpsActive(false);
          setGpsStatus('out_of_campus');
          setGpsAccuracyMeters(null);
          setGpsErrorModal({
            title: 'Kampüs Sınırları Dışındasınız',
            message:
              'Mevcut konumunuz GTÜ Çayırova Yerleşkesi sınırları dışında algılandı. Canlı GPS takibi yalnızca kampüs içerisindeyken açılabilir. Kampüs dışındayken harita üzerinden rota çizebilir ve yürüyüş simülatörünü kullanabilirsiniz.',
          });
          return;
        }

        // Verified inside GTÜ campus! Now activate Live GPS mode
        setIsLiveGpsActive(true);
        setGpsStatus('active');
        setGpsAccuracyMeters(accuracy || 5);
        onPositionUpdateRef.current?.(latitude, longitude, accuracy || 4.0);
      },
      (err) => {
        console.warn('Live GPS watchPosition warning:', err.message);
        if (watchIdRef.current !== null && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        setGpsStatus('permission_denied');
        setIsLiveGpsActive(false);
        setGpsAccuracyMeters(null);
        setGpsErrorModal({
          title: 'Canlı GPS Konumu Alınamadı',
          message:
            'Cihazınızın konum izni kapalı veya GPS sinyali alınamadı. Lütfen tarayıcı konum iznini kontrol edin.',
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 10000,
      }
    );

    watchIdRef.current = id;
  }, []);

  const toggleLiveGps = useCallback(() => {
    if (isLiveGpsActive || gpsStatus === 'searching') {
      stopLiveGps();
      onNoticeRef.current?.('Canlı GPS takibi durduruldu.');
    } else {
      startLiveGps();
    }
  }, [isLiveGpsActive, gpsStatus, stopLiveGps, startLiveGps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isLiveGpsActive,
    gpsStatus,
    gpsAccuracyMeters,
    gpsErrorModal,
    clearGpsErrorModal,
    startLiveGps,
    stopLiveGps,
    toggleLiveGps,
  };
}
