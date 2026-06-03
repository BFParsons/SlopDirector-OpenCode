"use client";

import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type MouseEvent,
} from "react";
import { useShallow } from "zustand/react/shallow";
import type { PanelProps } from "@/types/panel";
import { useStudioWorkspaceStore } from "@/stores/studioWorkspaceStore";
import type { WorkspaceSection } from "@/config/studio-presets";
import { getPanel, getPanelComponent } from "./PanelRegistry";
import PanelChrome from "./PanelChrome";
import MinimizedBar from "./MinimizedBar";
import { StudioToolbar } from "./StudioToolbar";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RndComponent = ComponentType<any>;

export default function WorkspaceShell({ section = "video" }: { section?: WorkspaceSection } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isReady = useStudioWorkspaceStore((s) => s.isReady);
  const enterSection = useStudioWorkspaceStore((s) => s.enterSection);
  const containerWidth = useStudioWorkspaceStore((s) => s.containerSize.width);
  const setContainerSize = useStudioWorkspaceStore((s) => s.setContainerSize);
  const [Rnd, setRnd] = useState<RndComponent | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; windowId: string } | null>(null);

  // react-rnd touches `window`, so import it on the client only.
  useEffect(() => {
    let alive = true;
    import("react-rnd").then((mod) => {
      if (alive) setRnd(() => mod.Rnd);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Enter the requested suite once the container has a real measured size (so the
  // hardcoded layout fits). enterSection() self-guards: a remount with the same
  // section keeps the current arrangement, while switching suites reloads that
  // section's own discrete layout (Audio = hardcoded default; Video = saved).
  useEffect(() => {
    if (containerWidth < 2) return;
    void enterSection(section);
  }, [section, containerWidth, enterSection]);

  // Track the container size so presets + maximize fit the real workspace.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(el);
    setContainerSize(el.clientWidth, el.clientHeight);
    return () => observer.disconnect();
  }, [setContainerSize]);

  // No auto-save: a saved workspace is only overwritten when the user explicitly
  // hits Save (SaveMenu → "Save changes"). Rearranging panels marks the workspace
  // dirty (the ⊞ menu shows an "unsaved changes" dot) but never persists on its
  // own — so testing/experimenting can't clobber a saved layout.

  const handleDragStop = useCallback((id: string, _e: unknown, d: { x: number; y: number }) => {
    useStudioWorkspaceStore.getState().updateWindowPosition(id, d.x, d.y);
  }, []);

  const handleResizeStop = useCallback(
    (id: string, _e: unknown, _dir: unknown, ref: HTMLElement, _delta: unknown, position: { x: number; y: number }) => {
      const store = useStudioWorkspaceStore.getState();
      store.updateWindowSize(id, ref.offsetWidth, ref.offsetHeight);
      store.updateWindowPosition(id, position.x, position.y);
    },
    [],
  );

  const handleMouseDown = useCallback((id: string) => {
    useStudioWorkspaceStore.getState().bringToFront(id);
  }, []);

  const handleContextMenu = useCallback((e: MouseEvent, windowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, windowId });
  }, []);

  const dismissContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [contextMenu]);

  const windowIds = useStudioWorkspaceStore(useShallow((s) => s.windows.map((w) => w.id)));

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      <StudioToolbar />
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {!isReady || !Rnd ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
            Loading workspace…
          </div>
        ) : (
          <>
            {windowIds.map((id) => (
              <WindowFrame
                key={id}
                windowId={id}
                RndComponent={Rnd}
                onDragStop={handleDragStop}
                onResizeStop={handleResizeStop}
                onMouseDown={handleMouseDown}
                onContextMenu={handleContextMenu}
              />
            ))}
            <MinimizedBarConnected />
          </>
        )}
      </div>
      {contextMenu ? (
        <WindowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          windowId={contextMenu.windowId}
          onDismiss={dismissContextMenu}
        />
      ) : null}
    </div>
  );
}

function MinimizedBarConnected() {
  const windows = useStudioWorkspaceStore((s) => s.windows);
  return (
    <MinimizedBar windows={windows} onRestore={(id) => useStudioWorkspaceStore.getState().restoreWindow(id)} />
  );
}

function WindowContextMenu({
  x,
  y,
  windowId,
  onDismiss,
}: {
  x: number;
  y: number;
  windowId: string;
  onDismiss: () => void;
}) {
  const store = useStudioWorkspaceStore.getState();
  const win = store.windows.find((w) => w.id === windowId);
  if (!win) return null;

  const siblingPanels = store.windows.filter((w) => w.panelType === win.panelType && w.id !== windowId);

  const menuItems = [
    ...(win.isMaximized
      ? [{ label: "Restore", action: () => store.restoreWindow(windowId) }]
      : [{ label: "Maximize", action: () => store.maximizeWindow(windowId) }]),
    ...(win.isMinimized
      ? [{ label: "Restore", action: () => store.restoreWindow(windowId) }]
      : [{ label: "Minimize", action: () => store.minimizeWindow(windowId) }]),
    { label: "Reset Position", action: () => store.resetWindowPosition(windowId) },
    { label: "Auto Arrange All", action: () => store.arrangeWindows() },
    ...(siblingPanels.length > 0
      ? [{
          label: "Standardize Panel Size",
          action: () => {
            for (const sibling of siblingPanels) {
              store.updateWindowSize(sibling.id, win.size.width, win.size.height);
            }
          },
        }]
      : []),
    { label: "Close", action: () => store.closeWindow(windowId), danger: true },
  ];

  const menuWidth = 170;
  const menuHeight = menuItems.length * 32 + 8;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div
      className="fixed"
      style={{ left: adjustedX, top: adjustedY, zIndex: 99999 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="min-w-[170px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)]">
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
              "danger" in item && item.danger
                ? "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/12"
                : "text-[var(--color-fg)] hover:bg-white/5"
            }`}
            onClick={() => {
              item.action();
              onDismiss();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const WindowFrame = memo(function WindowFrame({
  windowId,
  RndComponent,
  onDragStop,
  onResizeStop,
  onMouseDown,
  onContextMenu,
}: {
  windowId: string;
  RndComponent: RndComponent;
  onDragStop: (id: string, e: unknown, d: { x: number; y: number }) => void;
  onResizeStop: (id: string, e: unknown, dir: unknown, ref: HTMLElement, delta: unknown, pos: { x: number; y: number }) => void;
  onMouseDown: (id: string) => void;
  onContextMenu: (e: MouseEvent, windowId: string) => void;
}) {
  const win = useStudioWorkspaceStore(useShallow((s) => s.windows.find((w) => w.id === windowId)));

  const handleDrag = useCallback(
    (_e: unknown, d: { x: number; y: number }) => onDragStop(windowId, _e, d),
    [windowId, onDragStop],
  );
  const handleResize = useCallback(
    (_e: unknown, dir: unknown, ref: HTMLElement, delta: unknown, pos: { x: number; y: number }) =>
      onResizeStop(windowId, _e, dir, ref, delta, pos),
    [windowId, onResizeStop],
  );
  const handleMouse = useCallback(() => onMouseDown(windowId), [windowId, onMouseDown]);
  const handleContext = useCallback((e: MouseEvent) => onContextMenu(e, windowId), [windowId, onContextMenu]);

  if (!win) return null;

  const Component = getPanelComponent(win.panelType);
  const panelEntry = getPanel(win.panelType);
  if (!Component) return null;

  return (
    <RndComponent
      style={{ zIndex: win.zIndex, display: win.isMinimized ? "none" : undefined }}
      position={win.position}
      size={win.size}
      minWidth={panelEntry?.minWidth ?? 240}
      minHeight={panelEntry?.minHeight ?? 160}
      dragHandleClassName="window-drag-handle"
      bounds="parent"
      onMouseDown={handleMouse}
      onDragStop={handleDrag}
      onResizeStop={handleResize}
      enableResizing={!win.isMaximized}
      disableDragging={win.isMaximized}
    >
      <div
        className="h-full w-full overflow-hidden rounded-lg border border-[var(--color-border)] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        onContextMenu={handleContext}
      >
        <Suspense
          fallback={
            <PanelChrome title={win.title}>
              <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--color-muted)]">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
                <span>Loading…</span>
              </div>
            </PanelChrome>
          }
        >
          <WindowPanel
            windowId={win.id}
            isMaximized={win.isMaximized}
            isMinimized={win.isMinimized}
            Component={Component}
          />
        </Suspense>
      </div>
    </RndComponent>
  );
});

const WindowPanel = memo(function WindowPanel({
  windowId,
  isMaximized,
  isMinimized,
  Component,
}: {
  windowId: string;
  isMaximized: boolean;
  isMinimized: boolean;
  Component: ComponentType<PanelProps>;
}) {
  const store = useStudioWorkspaceStore.getState();
  return (
    <Component
      panelId={windowId}
      isMinimized={isMinimized}
      windowControls={{
        isMaximized,
        onMinimize: () => store.minimizeWindow(windowId),
        onMaximize: () => (isMaximized ? store.restoreWindow(windowId) : store.maximizeWindow(windowId)),
        onClose: () => store.closeWindow(windowId),
      }}
    />
  );
});
