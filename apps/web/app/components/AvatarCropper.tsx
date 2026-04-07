"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CANVAS_W = 300;
const CANVAS_H_CIRCLE = 300;   // avatar: square canvas
const CANVAS_H_BANNER = 169;   // cover: 16:9
const PREVIEW_SIZE = 72;

interface AvatarCropperProps {
  src: string;
  shape?: "circle" | "banner";
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

export default function AvatarCropper({ src, shape = "circle", onConfirm, onCancel }: AvatarCropperProps) {
  const CANVAS_SIZE = CANVAS_W;
  const CANVAS_H = shape === "banner" ? CANVAS_H_BANNER : CANVAS_H_CIRCLE;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minScale, setMinScale] = useState(0.5);
  const [ready, setReady] = useState(false);

  const draw = useCallback(
    (s: number, o: { x: number; y: number }) => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      const preview = previewRef.current;
      if (!img || !canvas || !preview) return;

      const ctx = canvas.getContext("2d");
      const pctx = preview.getContext("2d");
      if (!ctx || !pctx) return;

      const W = CANVAS_SIZE;
      const H = CANVAS_H;
      const iw = img.width * s;
      const ih = img.height * s;
      const ix = (W - iw) / 2 + o.x;
      const iy = (H - ih) / 2 + o.y;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, ix, iy, iw, ih);

      if (shape === "circle") {
        const cx = W / 2;
        const radius = cx - 4;
        // Dimming overlay with circular cut-out
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(cx, cx, radius, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.restore();
        // Dashed ring
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(cx, cx, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        // Preview (circle)
        const P = PREVIEW_SIZE;
        const ratio = P / W;
        pctx.clearRect(0, 0, P, P);
        pctx.save();
        pctx.beginPath();
        pctx.arc(P / 2, P / 2, P / 2, 0, Math.PI * 2);
        pctx.clip();
        pctx.drawImage(img, ix * ratio, iy * ratio, iw * ratio, ih * ratio);
        pctx.restore();
      } else {
        // Banner: thin dashed border only
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        const pad = 4;
        ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
        ctx.restore();
        // Preview (rectangle, same 16:9 ratio)
        const PW = PREVIEW_SIZE * 2;
        const PH = PREVIEW_SIZE;
        const rw = PW / W;
        const rh = PH / H;
        pctx.clearRect(0, 0, PW, PH);
        pctx.drawImage(img, ix * rw, iy * rh, iw * rw, ih * rh);
      }
    },
    [shape, CANVAS_SIZE, CANVAS_H]
  );

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      const fit = Math.max(CANVAS_SIZE / img.width, CANVAS_H / img.height);
      const min = Math.max(fit * 0.75, 0.2);
      setMinScale(min);
      setScale(fit);
      setOffset({ x: 0, y: 0 });
      draw(fit, { x: 0, y: 0 });
      setReady(true);
    };
    img.src = src;
  }, [src, draw, CANVAS_SIZE, CANVAS_H]);

  useEffect(() => {
    if (ready) draw(scale, offset);
  }, [scale, offset, ready, draw]);

  function startDrag(mx: number, my: number) {
    dragging.current = true;
    dragOrigin.current = { mx, my, ox: offset.x, oy: offset.y };
  }

  function moveDrag(mx: number, my: number) {
    if (!dragging.current) return;
    setOffset({
      x: dragOrigin.current.ox + (mx - dragOrigin.current.mx),
      y: dragOrigin.current.oy + (my - dragOrigin.current.my),
    });
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setScale((s) => Math.min(10, Math.max(minScale, s - e.deltaY * 0.003)));
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img) return;

    const OUT_W = shape === "banner" ? 1500 : 400;
    const OUT_H = shape === "banner" ? 500 : 400;
    const out = document.createElement("canvas");
    out.width = OUT_W;
    out.height = OUT_H;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(OUT_W / 2, OUT_H / 2, OUT_W / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    const rw = OUT_W / CANVAS_SIZE;
    const rh = OUT_H / CANVAS_H;
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = (CANVAS_SIZE - iw) / 2 + offset.x;
    const iy = (CANVAS_H - ih) / 2 + offset.y;
    ctx.drawImage(img, ix * rw, iy * rh, iw * rw, ih * rh);

    out.toBlob(
      (blob) => {
        if (!blob) return;
        const name = shape === "banner" ? "cover.jpeg" : "avatar.jpeg";
        onConfirm(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(20px)" }}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl p-6"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        <h3 className="text-base font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
          {shape === "banner" ? "Crop cover image" : "Crop avatar"}
        </h3>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          Drag to position · scroll or slide to zoom
        </p>

        <div className="flex flex-col items-center gap-4">
          {/* Main crop canvas */}
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_H}
            className="rounded-2xl cursor-grab active:cursor-grabbing select-none"
            style={{ maxWidth: "100%", touchAction: "none" }}
            onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
            onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
            onMouseUp={() => { dragging.current = false; }}
            onMouseLeave={() => { dragging.current = false; }}
            onWheel={handleWheel}
            onTouchStart={(e) => {
              const t = e.touches.item(0);
              if (!t) return;
              startDrag(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              const t = e.touches.item(0);
              if (!t) return;
              moveDrag(t.clientX, t.clientY);
            }}
            onTouchEnd={() => { dragging.current = false; }}
          />

          {/* Zoom slider */}
          <div className="w-full flex items-center gap-3">
            <button
              className="text-base leading-none pb-0.5 transition-opacity hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setScale((s) => Math.max(minScale, s - 0.1))}
            >
              −
            </button>
            <input
              type="range"
              min={Math.round(minScale * 100)}
              max={800}
              step={1}
              value={Math.round(scale * 100)}
              onChange={(e) => setScale(Number(e.target.value) / 100)}
              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "var(--accent)" }}
            />
            <button
              className="text-base leading-none pb-0.5 transition-opacity hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
              onClick={() => setScale((s) => Math.min(10, s + 0.1))}
            >
              +
            </button>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Preview</span>
            <canvas
              ref={previewRef}
              width={shape === "banner" ? PREVIEW_SIZE * 2 : PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className={shape === "banner" ? "rounded-lg" : "rounded-full"}
              style={{ border: "2px solid var(--border)" }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-70"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-opacity hover:opacity-85"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
