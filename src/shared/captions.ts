export interface CaptionWord { text: string; start: number; end: number }
export interface CaptionCue { text: string; start: number; end: number; words: CaptionWord[] }
export interface CaptionRequest { projectId: string; clipId?: string; range?: { start: number; end: number }; model?: 'base.en' | 'small.en' }
export interface CaptionProgress { stage: string; percent: number }
