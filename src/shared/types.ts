export type Us = number;

export interface Project {
  id: string; name: string; version: 1;
  settings: { width: number; height: number; fps: number; sampleRate: 48000 };
  media: Record<string, MediaAsset>;
  tracks: Track[];                  // index 0 = bottom of the visual stack
  markers: { id: string; time: Us; label: string }[];
  captionStyles: Record<string, TextStyle>;   // user-saved presets
}

export interface MediaAsset {
  id: string; path: string;         // absolute path of original
  kind: 'video' | 'audio' | 'image';
  duration: Us; width?: number; height?: number; fps?: number;
  hasAudio: boolean; rotation?: number;
  proxyPath?: string; peaksPath?: string; thumbDir?: string;
  status: 'importing' | 'ready' | 'error';
}

export interface Track {
  id: string; kind: 'video' | 'audio' | 'text';   // 'video' tracks hold video/image/sticker clips
  name: string; locked: boolean; hidden: boolean; muted: boolean;
  clips: Clip[];                    // non-overlapping within a track, sorted by start
}

export type Clip = MediaClip | TextClip;

export interface ClipBase {
  linkId?: string;
  id: string; trackId: string;
  start: Us; duration: Us;          // placement on the timeline
  transform: Transform;             // animatable
  opacity: Animatable<number>;      // 0..1
  effects: EffectInstance[];
  transitionIn?: Transition;        // applies at clip start (overlaps previous clip)
}

export interface MediaClip extends ClipBase {
  type: 'media'; mediaId: string;
  sourceIn: Us; sourceOut: Us;      // trim window in source time
  speed: number;                    // 0.1..100, constant (curve in P1)
  reverse: boolean;
  volume: Animatable<number>;       // 0..4 (linear gain), default 1
  fadeIn: Us; fadeOut: Us;          // audio fades
  muted: boolean;
  fit: 'fit' | 'fill' | 'stretch';  // default 'fit' with blurred-background option
  blurBackground: boolean;
  crop: { l: number; t: number; r: number; b: number };   // 0..1 fractions
  filter?: { preset: string; intensity: number };
  adjust: { brightness: number; contrast: number; saturation: number; temperature: number; vignette: number; sharpen: number };
}

export interface TextClip extends ClipBase {
  type: 'text';
  content: string;                  // plain text; \n allowed
  style: TextStyle;
  animIn?: TextAnimation; animOut?: TextAnimation; animLoop?: TextAnimation;
  caption?: { words: { text: string; start: Us; end: Us }[] };  // present for auto-caption clips
}

export interface Transform {
  x: Animatable<number>; y: Animatable<number>;          // canvas-normalized center, 0..1 (0.5,0.5 = center)
  scale: Animatable<number>; rotation: Animatable<number>; // rotation in degrees
}

export type Animatable<T> = { value: T; keyframes: Keyframe<T>[] };   // keyframes sorted by time (clip-relative Us)
export interface Keyframe<T> { time: Us; value: T; easing: 'linear'|'easeIn'|'easeOut'|'easeInOut'|'hold'|{bezier:[number,number,number,number]} }

export interface TextStyle {
  fontFamily: string; fontSize: number;       // px at 1080p reference height; scale with canvas
  weight: 400|500|600|700|800|900; italic: boolean;
  color: string; align: 'left'|'center'|'right';
  lineHeight: number; letterSpacing: number;
  stroke?: { color: string; width: number };
  shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
  glow?: { color: string; blur: number };
  background?: { color: string; opacity: number; paddingX: number; paddingY: number; radius: number };
  gradient?: { from: string; to: string; angle: number };
  maxWidthFraction: number;                   // wrap width as fraction of canvas width
}

export interface TextAnimation {
  preset: string;                              // key into textAnimations registry (§7.4)
  duration: Us;                                // for in/out; for loop = one cycle
  easing: Keyframe<number>['easing'];
  granularity: 'whole' | 'line' | 'word' | 'char';
  stagger: Us;                                 // delay between units when granularity != whole
}

export interface Transition { type: 'fade'|'dissolve'|'slideLeft'|'slideRight'|'slideUp'|'slideDown'|'wipeLeft'|'wipeRight'|'zoomIn'|'zoomOut'|'blur'|'flash'; duration: Us }
export interface EffectInstance { type: string; params: Record<string, number | string>; enabled: boolean }
