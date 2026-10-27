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
  const watchSessionRef = useRef<number>(0);
  const hasFixRef = useRef<boolean>(false);
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const onNoticeRef = useRef(onNotice);

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    onNoticeRef.current = onNotice;
  }, [onNotice]);

  const stopLiveGps = useCallback(() => {
    watchSessionRef.current += 1;
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    hasFixRef.current = false;
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

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setGpsStatus('permission_denied');
      setIsLiveGpsActive(false);
      setGpsErrorModal({
        title: 'Güvenli Bağlantı (HTTPS) Gerekli',
        message:
          'iOS Safari ve mobil tarayıcılar güvenlik kuralları gereği HTTP (yerel IP) üzerinden konum verisi paylaşmaz. Telefonunuzda konum izni açık olsa bile canlı GPS için HTTPS bağlantısı kullanılmalıdır.',
      });
      return;
    }

    setGpsErrorModal(null);
    setGpsStatus('searching');
    hasFixRef.current = false;
    onNoticeRef.current?.('📡 Canlı GPS konumu kontrol ediliyor...');

    const clearCurrentWatch = () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const startWatch = (highAccuracy: boolean) => {
      clearCurrentWatch();
      const sessionId = ++watchSessionRef.current;

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (sessionId !== watchSessionRef.current) return;
          const { latitude, longitude, accuracy } = pos.coords;

          // Strict boundary check: If user is at home / outside GTÜ campus, stop immediately and show error dialog!
          if (!isWithinCampusBounds(latitude, longitude)) {
            clearCurrentWatch();
            hasFixRef.current = false;
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
          hasFixRef.current = true;
          setIsLiveGpsActive(true);
          setGpsStatus('active');
          setGpsAccuracyMeters(accuracy || 5);
          onPositionUpdateRef.current?.(latitude, longitude, accuracy || 4.0);
        },
        (err) => {
          if (sessionId !== watchSessionRef.current) return;
          console.warn('Live GPS watchPosition warning:', err.code, err.message);

          // Ignore transient signal loss (code 2 or 3) if we already acquired a valid GPS lock
          if (hasFixRef.current && (err.code === 2 || err.code === 3)) {
            return;
          }

          clearCurrentWatch();

          // On iOS CoreLocation (kCLErrorLocationUnknown = code 2) or indoor timeout (code 3),
          // automatically fall back from highAccuracy satellite mode to fused/network positioning
          if (highAccuracy && (err.code === 2 || err.code === 3)) {
            startWatch(false);
            return;
          }

          setGpsStatus('permission_denied');
          setIsLiveGpsActive(false);
          setGpsAccuracyMeters(null);
          setGpsErrorModal({
            title: 'Canlı GPS Konumu Alınamadı',
            message:
              err.code === 1
                ? 'Tarayıcı konum izni reddedildi veya bağlantı güvenli (HTTPS) değil. iOS kullanıyorsanız Ayarlar > Gizlilik ve Güvenlik > Konum Servisleri > Safari Web Siteleri izninin "Uygulamayı Kullanırken" ve "Tam Konum" açık olduğundan ve HTTPS bağlantısı kullandığınızdan emin olun.'
                : 'Cihazınızdan anlık GPS sinyali alınamadı. Lütfen açık alanda olduğunuzdan ve cihaz konum servislerinin açık olduğundan emin olup tekrar deneyin.',
          });
        },
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: highAccuracy ? 0 : 5000,
          timeout: highAccuracy ? 15000 : 20000,
        }
      );

      if (sessionId === watchSessionRef.current) {
        watchIdRef.current = id;
      } else {
        navigator.geolocation.clearWatch(id);
      }
    };

    startWatch(true);
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
