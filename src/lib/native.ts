import { ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { Native } from '../../modules/camart-native';

/** True in a development/production build; false in Expo Go (features stay hidden). */
export const hasNative = !!Native;

// --- Subject lift -----------------------------------------------------------

/** Lifts the main subject out of the original photo; resolves to a transparent PNG file URI. */
export async function liftSubject(originalUri: string) {
  if (!Native) throw new Error('Subject lift needs the CamArt app build, not Expo Go.');
  return Native.removeBackground(originalUri);
}

// --- Home-screen widget ----------------------------------------------------

function widgetFile() {
  if (Platform.OS === 'ios') {
    const dir = Native?.appGroup ? Paths.appleSharedContainers[Native.appGroup] : undefined;
    return dir ? new File(dir, 'today.png') : null;
  }
  const dir = new Directory(Paths.document, 'camart', 'widget');
  dir.create({ idempotent: true, intermediates: true });
  return new File(dir, 'today.png');
}

/** Puts the newest sticker on the home-screen widget (or clears it). Never throws: the widget is a nicety. */
export function syncWidget(renderedUri: string | null) {
  if (!Native) return;
  try {
    const out = widgetFile();
    if (!out) return;
    if (out.exists) out.delete();
    if (renderedUri) new File(renderedUri).copy(out);
    Native.reloadWidgets();
  } catch {}
}

// --- WhatsApp sticker pack --------------------------------------------------

const PACK_ID = 'camart-latest';

async function decode(uri: string) {
  const img = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!img) throw new Error('Could not read a sticker');
  return img;
}

function resize(img: SkImage, size: number) {
  const s = Skia.Surface.MakeOffscreen(size, size)!;
  s.getCanvas().drawImageRect(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, size, size), Skia.Paint());
  s.flush();
  return s.makeImageSnapshot();
}

/** WhatsApp wants 512×512 WebP under 100 KB: step the quality down until it fits. */
function stickerWebp(img: SkImage) {
  const small = resize(img, 512);
  for (const q of [90, 80, 70, 60, 50, 40, 30]) {
    const bytes = small.encodeToBytes(ImageFormat.WEBP, q);
    if (bytes.length < 100_000) return bytes;
  }
  throw new Error('A sticker is too detailed to fit WhatsApp’s size limit');
}

/** Sends the newest stickers (3–30) to WhatsApp as one "CamArt" pack. Re-sending updates it. */
export async function sendToWhatsApp(renderedUris: string[]): Promise<'added' | 'cancelled'> {
  if (!Native) throw new Error('Sticker packs need the CamArt app build, not Expo Go.');
  const uris = renderedUris.slice(0, 30);
  if (uris.length < 3) throw new Error('WhatsApp packs need at least 3 stickers. Make a few more first.');
  const images = await Promise.all(uris.map(decode));
  const tray = resize(images[0], 96).encodeToBytes(ImageFormat.PNG, 100);
  const webps = images.map(stickerWebp);
  const name = 'CamArt';
  const version = String(Date.now());

  if (Platform.OS === 'android') {
    // The native ContentProvider serves this folder to WhatsApp.
    const dir = new Directory(Paths.document, 'camart', 'whatsapp', PACK_ID);
    if (dir.exists) dir.delete();
    dir.create({ intermediates: true });
    new File(dir, 'tray.png').write(tray);
    webps.forEach((b, i) => new File(dir, `${i + 1}.webp`).write(b));
    new File(dir, 'contents.json').write(
      JSON.stringify({
        identifier: PACK_ID, name, publisher: 'CamArt', tray_image_file: 'tray.png', image_data_version: version,
        stickers: webps.map((_, i) => ({ image_file: `${i + 1}.webp`, emojis: ['✨'], accessibility_text: 'CamArt sticker' })),
      }),
    );
    return Native.addToWhatsApp(PACK_ID, name);
  }
  await Native.sendWhatsAppPack(
      JSON.stringify({
        identifier: PACK_ID, name, publisher: 'CamArt', tray_image: toBase64(tray), ios_app_store_link: '', android_play_store_link: '',
        stickers: webps.map((b) => ({ image_data: toBase64(b), emojis: ['✨'] })),
      }),
    );
  return 'added' as const;
}

/** Base64 without Buffer (not in React Native). */
function toBase64(bytes: Uint8Array) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (i + 1 < bytes.length ? abc[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? abc[n & 63] : '=');
  }
  return out;
}
