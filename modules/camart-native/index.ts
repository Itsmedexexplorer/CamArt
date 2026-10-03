import { requireOptionalNativeModule } from 'expo-modules-core';

type CamartNative = {
  /** Lifts the main subject out of a photo; resolves to a transparent PNG file URI. */
  removeBackground(uri: string): Promise<string>;
  /** Android only: asks WhatsApp to add the pack written under <documents>/camart/whatsapp/<id>/. */
  addToWhatsApp(id: string, name: string): Promise<'added' | 'cancelled'>;
  /** iOS only: hands a pack to WhatsApp through the pasteboard (JSON per WhatsApp's spec). */
  sendWhatsAppPack(json: string): Promise<void>;
  /** Redraws home-screen widgets after today's sticker changes. */
  reloadWidgets(): void;
  /** iOS App Group used by the widget and the iMessage sticker extension. */
  readonly appGroup?: string;
};

// Null in Expo Go (no custom native code): every caller must treat these features as optional.
export const Native = requireOptionalNativeModule<CamartNative>('CamartNative');
