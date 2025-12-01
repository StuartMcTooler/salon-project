import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativeApp } from '@/lib/platform';

export const useNativeCamera = () => {
  const takePhoto = async (): Promise<Blob> => {
    if (!isNativeApp()) {
      throw new Error('Native camera only available in mobile app');
    }

    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });

    // Convert photo URI to blob
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    
    return blob;
  };

  return { takePhoto, isNativeSupported: isNativeApp() };
};
