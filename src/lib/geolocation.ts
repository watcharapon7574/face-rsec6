export interface Coordinates {
  lat: number;
  lng: number;
}

export function getDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation ไม่รองรับบนอุปกรณ์นี้'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('ไม่สามารถระบุตำแหน่งได้'));
            break;
          case err.TIMEOUT:
            reject(new Error('หมดเวลาในการระบุตำแหน่ง'));
            break;
          default:
            reject(new Error('เกิดข้อผิดพลาดในการระบุตำแหน่ง'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

export function isWithinRadius(
  current: Coordinates,
  office: Coordinates,
  radiusMeters: number
): { within: boolean; distance: number } {
  const distance = getDistance(current, office);
  return { within: distance <= radiusMeters, distance: Math.round(distance) };
}
