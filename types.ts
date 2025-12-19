export type FontStyleKey = 'style1' | 'style2' | 'style3' | 'style4' | 'style5';

export interface TextConfig {
  line1: string;
  line2: string;
  fontKey: FontStyleKey;
  size: number;
  color: string;
}

export interface ParticleConfig {
  treeCount: number;
  dustCount: number;
  snowCount: number;
  snowSize: number;
  snowSpeed: number;
}

export interface StoredPhoto {
  id: string;
  data: string; // Base64
}

export interface StoredMusic {
  id: string;
  data: Blob;
}

export type SceneMode = 'TREE' | 'SCATTER' | 'FOCUS';

export interface GestureState {
  detected: boolean;
  x: number;
  y: number;
}