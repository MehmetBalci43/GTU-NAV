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
  const lastEmittedRef = useRef<{ lat: number; lon: number; acc: number } | null>(null);
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
    lastEmittedRef.current = null;
    setIsLiveGpsActive(false);
    setGpsStatus('idle');
    setGpsAccuracyMeters(null);
  }, []);

  const clearGpsErrorModal = useCallback(() => {
    setGpsErrorModal(null);
  }, []);

  const startLiveGps = useCallback((silentAutoStart: boolean = false) => {
    if (watchIdRef.current !== null) return;

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      setIsLiveGpsActive(false);
      if (!silentAutoStart) {
        setGpsErrorModal({
          title: 'GPS Desteklenmiyor',
          message: 'Tarayıcınız canlı GPS konum servisini desteklemiyor.',
        });
      }
      return;
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setGpsStatus('permission_denied');
      setIsLiveGpsActive(false);
      if (!silentAutoStart) {
        setGpsErrorModal({
          title: 'Güvenli Bağlantı (HTTPS) Gerekli',
          message:
            'iOS Safari ve mobil tarayıcılar güvenlik kuralları gereği HTTP (yerel IP) üzerinden konum verisi paylaşmaz. Telefonunuzda konum izni açık olsa bile canlı GPS için HTTPS bağlantısı kullanılmalıdır.',
        });
      }
      return;
    }

    setGpsErrorModal(null);
    setGpsStatus('searching');
    hasFixRef.current = false;
    if (!silentAutoStart) {
      onNoticeRef.current?.('📡 Canlı GPS konumu kontrol ediliyor...');
    }

    const clearCurrentWatch = () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    const startWatch = (highAccuracy: boolean) => {
      clearCurrentWatch();
      const sessionId = ++watchSessionRef.current;
      let transientErrorCount = 0;

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (sessionId !== watchSessionRef.current) return;
          const { latitude, longitude, accuracy } = pos.coords;
          transientErrorCount = 0;

          // Strict boundary check: If user is at home / outside GTÜ campus, stop immediately and fallback to Marmaray!
          if (!isWithinCampusBounds(latitude, longitude)) {
            clearCurrentWatch();
            hasFixRef.current = false;
            setIsLiveGpsActive(false);
            setGpsStatus('out_of_campus');
            setGpsAccuracyMeters(null);
            if (!silentAutoStart) {
              setGpsErrorModal({
                title: 'Kampüs Sınırları Dışındasınız',
                message:
                  'Mevcut konumunuz GTÜ Çayırova Yerleşkesi sınırları dışında algılandı. Canlı GPS takibi yalnızca kampüs içerisindeyken açılabilir. Başlangıç noktanız Marmaray çıkışı olarak korundu.',
              });
            }
            return;
          }

          // Verified inside GTÜ campus! Now activate Live GPS mode
          const nextAcc = Math.round(accuracy || 5);
          const prev = lastEmittedRef.current;
          if (prev) {
            const approxDistM = Math.hypot(
              (latitude - prev.lat) * 111320,
              (longitude - prev.lon) * 84200
            );
            // Battery saver deadband: ignore sub-1.2m stationary noise unless accuracy improved significantly
            if (approxDistM < 1.2 && nextAcc >= prev.acc - 2) {
              return;
            }
          }
          lastEmittedRef.current = { lat: latitude, lon: longitude, acc: nextAcc };

          hasFixRef.current = true;
          setIsLiveGpsActive(true);
          setGpsStatus('active');
          setGpsAccuracyMeters(nextAcc);
          onPositionUpdateRef.current?.(latitude, longitude, accuracy || 4.0);
        },
        (err) => {
          if (sessionId !== watchSessionRef.current) return;
          console.warn('Live GPS watchPosition warning:', err.code, err.message);

          // Ignore transient signal loss (code 2 or 3) if we already acquired a valid GPS lock
          if (hasFixRef.current && (err.code === 2 || err.code === 3)) {
            return;
          }

          // On iOS CoreLocation, watchPosition(enableHighAccuracy: true) often emits 1-2 transient
          // kCLErrorLocationUnknown (code 2) events while warming up the GNSS receiver.
          // Let watchPosition keep trying before falling back to low-accuracy network mode!
          if (highAccuracy && err.code === 2 && transientErrorCount < 2) {
            transientErrorCount += 1;
            return;
          }

          clearCurrentWatch();

          if (highAccuracy && (err.code === 2 || err.code === 3)) {
            startWatch(false);
            return;
          }

          setGpsStatus('permission_denied');
          setIsLiveGpsActive(false);
          setGpsAccuracyMeters(null);
          if (!silentAutoStart) {
            setGpsErrorModal({
              title: 'Canlı GPS Konumu Alınamadı',
              message:
                err.code === 1
                  ? 'Tarayıcı konum izni reddedildi veya bağlantı güvenli (HTTPS) değil. iOS kullanıyorsanız Ayarlar > Gizlilik ve Güvenlik > Konum Servisleri > Safari Web Siteleri izninin "Uygulamayı Kullanırken" ve "Tam Konum" açık olduğundan ve HTTPS bağlantısı kullandığınızdan emin olun.'
                  : 'Cihazınızdan anlık GPS sinyali alınamadı. Lütfen açık alanda olduğunuzdan ve cihaz konum servislerinin açık olduğundan emin olup tekrar deneyin.',
            });
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: highAccuracy ? 2000 : 5000,
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
      startLiveGps(false);
    }
  }, [isLiveGpsActive, gpsStatus, stopLiveGps, startLiveGps]);

  // Auto-request GPS on initial app mount; silently falls back to Marmaray default if off-campus or unavailable
  useEffect(() => {
    startLiveGps(true);
  }, [startLiveGps]);

  // Battery saver: automatically suspend hardware GPS watch when phone screen is locked or tab is in background,
  // and resume seamlessly when the student returns to the app.
  useEffect(() => {
    if (!isLiveGpsActive && gpsStatus !== 'searching') return;

    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        if (watchIdRef.current !== null && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      } else if (document.visibilityState === 'visible' && watchIdRef.current === null) {
        startLiveGps(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isLiveGpsActive, gpsStatus, startLiveGps]);

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
