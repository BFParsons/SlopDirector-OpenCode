import { lazy } from "react";
import type { PanelRegistryEntry, PanelType } from "@/types/panel";
import { makeComingSoonPanel } from "./panels/ComingSoonPanel";
import { panelMin } from "@/config/panel-min-sizes";

const MonitorPanel = lazy(() => import("./panels/MonitorPanel"));
const VideoEditPanel = lazy(() => import("./panels/VideoEditPanel"));
const VideoGenPanel = lazy(() => import("./panels/VideoGenPanel"));
const VoiceoverPanel = lazy(() => import("./panels/VoiceoverPanel"));
const TimelinePanel = lazy(() => import("./panels/TimelinePanel"));
const VisualPanel = lazy(() => import("./panels/VisualPanel"));
const EffectControlsPanel = lazy(() => import("./panels/EffectControlsPanel"));
const MediaBucketPanel = lazy(() => import("./panels/MediaBucketPanel"));
const PolishPanel = lazy(() => import("./panels/PolishPanel"));
const TextOverlayPanel = lazy(() => import("./panels/TextOverlayPanel"));
const AudioMultitrackPanel = lazy(() => import("./panels/AudioMultitrackPanel"));
const AudioVisualizerPanel = lazy(() => import("./panels/AudioVisualizerPanel"));
const AudioImporterPanel = lazy(() => import("./panels/AudioImporterPanel"));
const StemSeparationPanel = lazy(() => import("./panels/StemSeparationPanel"));
const AudioProcessingPanel = lazy(() => import("./panels/AudioProcessingPanel"));
const LoudnessMeterPanel = lazy(() => import("./panels/LoudnessMeterPanel"));
const AudioToolsPanel = lazy(() => import("./panels/AudioToolsPanel"));

const REGISTRY = new Map<PanelType, PanelRegistryEntry>();



function registerPanel(entry: PanelRegistryEntry) {
  // Minimum sizes live in src/config/panel-min-sizes.ts (shared with the
  // layout math) unless an entry overrides them explicitly.
  const min = panelMin(entry.type);
  REGISTRY.set(entry.type, { minWidth: min.width, minHeight: min.height, ...entry });
}

registerPanel({ type: "monitor", title: "Program Monitor", icon: "▣", group: "Viewer", component: MonitorPanel });
registerPanel({ type: "video-edit", title: "Video Edit", icon: "✂", group: "Viewer", component: VideoEditPanel });
registerPanel({ type: "video-gen", title: "Video Generator", icon: "✨", group: "Edit", component: VideoGenPanel });
registerPanel({ type: "voiceover", title: "Voiceover", icon: "🎙", group: "Audio", component: VoiceoverPanel });
registerPanel({ type: "timeline", title: "Timeline", icon: "▤", group: "Edit", component: TimelinePanel });
registerPanel({ type: "visual", title: "Visual / Media", icon: "🎬", group: "Edit", component: VisualPanel });
registerPanel({ type: "effect-controls", title: "Effects", icon: "◆", group: "Edit", component: EffectControlsPanel });
registerPanel({ type: "polish", title: "Polish", icon: "✨", group: "Finish", component: PolishPanel });
registerPanel({ type: "text-overlays", title: "Text Overlays", icon: "T", group: "Finish", component: TextOverlayPanel });
registerPanel({ type: "audio-multitrack", title: "Multitrack Timeline", icon: "▤", group: "Audio", component: AudioMultitrackPanel });
registerPanel({ type: "audio-visualizer", title: "Visualizer", icon: "📊", group: "Audio", component: AudioVisualizerPanel });
registerPanel({ type: "audio-importer", title: "Audio Importer", icon: "🗂", group: "Audio", component: AudioImporterPanel });
registerPanel({ type: "stem-separation", title: "Stem Separation", icon: "🎛", group: "Audio", component: StemSeparationPanel });
registerPanel({ type: "audio-processing", title: "Processing Rack", icon: "◆", group: "Audio", component: AudioProcessingPanel });
registerPanel({ type: "loudness-meter", title: "Loudness Meter", icon: "📈", group: "Audio", component: LoudnessMeterPanel });
registerPanel({ type: "audio-tools", title: "Audio Tools", icon: "🧰", group: "Audio", component: AudioToolsPanel });
registerPanel({ type: "media-bucket", title: "Media Bucket", icon: "🗂", group: "Library", component: MediaBucketPanel });
registerPanel({ type: "youtube-importer", title: "YouTube Importer", icon: "▶", group: "Library", component: makeComingSoonPanel("YouTube Importer", "▶") });

export function getPanel(type: PanelType): PanelRegistryEntry | undefined {
  return REGISTRY.get(type);
}

export function getPanelComponent(type: PanelType): PanelRegistryEntry["component"] | undefined {
  return REGISTRY.get(type)?.component;
}

export function getAllPanels(): PanelRegistryEntry[] {
  return [...REGISTRY.values()];
}
