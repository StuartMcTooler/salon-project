import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  streamRef: React.MutableRefObject<MediaStream | null>;
  videoRef: React.RefObject<HTMLVideoElement>;
  isInIframe: boolean;
};

const prettyReadyState = (rs?: number) =>
  ({
    0: "HAVE_NOTHING",
    1: "HAVE_METADATA",
    2: "HAVE_CURRENT_DATA",
    3: "HAVE_FUTURE_DATA",
    4: "HAVE_ENOUGH_DATA",
  } as any)[rs ?? -1] ?? String(rs);

const CameraDebugPanel: React.FC<Props> = ({ streamRef, videoRef, isInIframe }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = useState<string>("unknown");
  const [trackSettings, setTrackSettings] = useState<MediaTrackSettings | null>(null);
  const [trackInfo, setTrackInfo] = useState<{ readyState?: string; enabled?: boolean; muted?: boolean; label?: string } | null>(null);
  const [videoMetrics, setVideoMetrics] = useState({ width: 0, height: 0, readyState: 0 });
  const [videoStatus, setVideoStatus] = useState<{ paused: boolean; hasSrcObject: boolean }>({ paused: true, hasSrcObject: false });
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const refresh = async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const list = await navigator.mediaDevices.enumerateDevices();
        const vids = list.filter((d) => d.kind === "videoinput");
        setDevices(vids);
        if (!selectedDeviceId && vids[0]?.deviceId) {
          setSelectedDeviceId(vids[0].deviceId);
        }
      }
      // Permissions API may not exist on all browsers
      try {
        const permAny = (navigator as any).permissions;
        const status = await permAny?.query({ name: 'camera' });
        if (status) {
          setPermission(status.state);
          status.onchange = () => setPermission(status.state);
        }
      } catch {}

      const track = streamRef.current?.getVideoTracks?.()[0] ?? null;
      setTrackSettings(track ? track.getSettings() : null);
      setTrackInfo(track ? { readyState: track.readyState, enabled: track.enabled, muted: (track as any)?.muted ?? false, label: track.label } : null);

      if (videoRef.current) {
        setVideoMetrics({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
          readyState: videoRef.current.readyState,
        });
        setVideoStatus({ paused: videoRef.current.paused, hasSrcObject: Boolean(videoRef.current.srcObject) });
      }
    } catch (e) {
      console.warn("CameraDebugPanel refresh error", e);
    }
  };
  const reattachStream = async () => {
    try {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;
      // Reattach stream and attempt play
      video.srcObject = null;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.srcObject = streamRef.current;
      try {
        await video.play();
      } catch (e) {
        console.warn('Reattach play() failed', e);
      }
      await refresh();
    } catch (e) {
      console.warn('reattachStream error', e);
    }
  };

  const switchToDevice = async () => {
    if (!selectedDeviceId) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDeviceId } },
      });
      // Stop previous
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch {}
      streamRef.current = newStream;
      await reattachStream();
    } catch (e) {
      console.warn('switchToDevice error', e);
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Camera Debug</div>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <div>In iframe: {String(isInIframe)}</div>
        <div>Permission: {permission}</div>
        <div>
          Devices: {devices.length > 0 ? devices.map((d) => (d.label || "Camera") + ` (${d.deviceId.slice(0,6)}…)`).join(", ") : "none"}
        </div>
        <div>Selected deviceId: {selectedDeviceId || 'none'}</div>
        <div>Track settings: {trackSettings ? JSON.stringify(trackSettings) : "no track"}</div>
        <div>Track state: {trackInfo ? `${trackInfo.readyState} | enabled:${String(trackInfo.enabled)} | muted:${String(trackInfo.muted)} | label:${trackInfo.label || ''}` : 'no track'}</div>
        <div>
          Video readyState: {prettyReadyState(videoMetrics.readyState)} ({videoMetrics.readyState})
        </div>
        <div>Video dimensions: {videoMetrics.width} x {videoMetrics.height}</div>
        <div>Video paused: {String(videoStatus.paused)} | srcObject set: {String(videoStatus.hasSrcObject)}</div>
        <div>Active stream: {Boolean(streamRef.current)?.toString()}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          className="px-2 py-1 rounded border border-border bg-background text-foreground"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={switchToDevice}>Use Device</Button>
        <Button size="sm" variant="secondary" onClick={reattachStream}>Reattach Stream</Button>
      </div>
    </Card>
  );
};

export default CameraDebugPanel;
