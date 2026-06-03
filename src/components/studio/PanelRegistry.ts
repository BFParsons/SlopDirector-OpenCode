import { lazy } from "react";
import type { PanelRegistryEntry, PanelType } from "@/types/panel";
import { makeComingSoonPanel } from "./panels/ComingSoonPanel";

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
  REGISTRY.set(entry.type, entry);
}

registerPanel({ type: "monitor", title: "Program Monitor", icon: "▣", group: "Viewer", component: MonitorPanel, minWidth: 480, minHeight: 320 });
registerPanel({ type: "video-edit", title: "Video Edit", icon: "✂", group: "Viewer", component: VideoEditPanel, minWidth: 360, minHeight: 320 });
registerPanel({ type: "video-gen", title: "Video Generator", icon: "✨", group: "Edit", component: VideoGenPanel, minWidth: 190, minHeight: 280 });
registerPanel({ type: "voiceover", title: "Voiceover", icon: "🎙", group: "Audio", component: VoiceoverPanel, minWidth: 280, minHeight: 260 });
registerPanel({ type: "timeline", title: "Timeline", icon: "▤", group: "Edit", component: TimelinePanel, minWidth: 560, minHeight: 220 });
registerPanel({ type: "visual", title: "Visual / Media", icon: "🎬", group: "Edit", component: VisualPanel, minWidth: 360, minHeight: 320 });
registerPanel({ type: "effect-controls", title: "Effects", icon: "◆", group: "Edit", component: EffectControlsPanel, minWidth: 180, minHeight: 200 });
registerPanel({ type: "polish", title: "Polish", icon: "✨", group: "Finish", component: PolishPanel, minWidth: 360, minHeight: 320 });
registerPanel({ type: "text-overlays", title: "Text Overlays", icon: "T", group: "Finish", component: TextOverlayPanel, minWidth: 200, minHeight: 200 });
registerPanel({ type: "audio-multitrack", title: "Multitrack Timeline", icon: "▤", group: "Audio", component: AudioMultitrackPanel, minWidth: 480, minHeight: 240 });
registerPanel({ type: "audio-visualizer", title: "Visualizer", icon: "📊", group: "Audio", component: AudioVisualizerPanel, minWidth: 160, minHeight: 56 });
registerPanel({ type: "audio-importer", title: "Audio Importer", icon: "🗂", group: "Audio", component: AudioImporterPanel, minWidth: 260, minHeight: 280 });
registerPanel({ type: "stem-separation", title: "Stem Separation", icon: "🎛", group: "Audio", component: StemSeparationPanel, minWidth: 280, minHeight: 320 });
registerPanel({ type: "audio-processing", title: "Processing Rack", icon: "◆", group: "Audio", component: AudioProcessingPanel, minWidth: 280, minHeight: 360 });
registerPanel({ type: "loudness-meter", title: "Loudness Meter", icon: "📈", group: "Audio", component: LoudnessMeterPanel, minWidth: 260, minHeight: 320 });
registerPanel({ type: "audio-tools", title: "Audio Tools", icon: "🧰", group: "Audio", component: AudioToolsPanel, minWidth: 280, minHeight: 320 });
registerPanel({ type: "media-bucket", title: "Media Bucket", icon: "🗂", group: "Library", component: MediaBucketPanel, minWidth: 320, minHeight: 280 });
registerPanel({ type: "youtube-importer", title: "YouTube Importer", icon: "▶", group: "Library", component: makeComingSoonPanel("YouTube Importer", "▶"), minWidth: 360, minHeight: 240 });

export function getPanel(type: PanelType): PanelRegistryEntry | undefined {
  return REGISTRY.get(type);
}

export function getPanelComponent(type: PanelType): PanelRegistryEntry["component"] | undefined {
  return REGISTRY.get(type)?.component;
}

export function getAllPanels(): PanelRegistryEntry[] {
  return [...REGISTRY.values()];
}
