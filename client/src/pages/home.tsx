import { useState, useRef, useEffect, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MousePointer2,
  Hand,
  Ruler,
  Highlighter,
  StickyNote,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Upload,
  Settings2,
  Trash2,
  X,
  FileText,
  PanelRightOpen,
  PanelRightClose,
  AlertCircle,
  Check,
  RotateCcw,
} from "lucide-react";
import type {
  ToolMode,
  ScaleUnit,
  DrawingScale,
  Annotation,
  Measurement,
  ScaleCalibration,
} from "@shared/schema";

const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "#FFD60080", text: "#b8a000" },
  { label: "Red", value: "#FF453A80", text: "#cc2a1f" },
  { label: "Green", value: "#30D15880", text: "#1a9e3a" },
  { label: "Blue", value: "#0A84FF80", text: "#0060cc" },
  { label: "Orange", value: "#FF9F0A80", text: "#cc7500" },
];

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const [tool, setTool] = useState<ToolMode>("pan");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [scale, setScale] = useState<DrawingScale>({
    pixelsPerUnit: 1,
    unit: "m",
    drawingRatio: "1:100",
    calibrated: false,
  });

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const drawCurrent = useRef<{ x: number; y: number } | null>(null);
  const isDrawing = useRef(false);

  const scaleCalib = useRef<ScaleCalibration | null>(null);
  const scaleDrawStart = useRef<{ x: number; y: number } | null>(null);
  const scaleDrawCurrent = useRef<{ x: number; y: number } | null>(null);

  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<Partial<Annotation> | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [scaleRealLength, setScaleRealLength] = useState("10");
  const [scaleUnit, setScaleUnit] = useState<ScaleUnit>("m");
  const [scaleRatio, setScaleRatio] = useState("1:100");

  const [showScaleSetup, setShowScaleSetup] = useState(false);
  const [scaleMode, setScaleMode] = useState<"ratio" | "calibrate">("ratio");

  const [rotation, setRotation] = useState(0);
  const [renderedPage, setRenderedPage] = useState(0);
  const [renderedZoom, setRenderedZoom] = useState(0);
  const [renderedRotation, setRenderedRotation] = useState(-1);

  const pageRef = useRef<any>(null);
  const pageScaleRef = useRef(1);

  const loadPDF = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
      setAnnotations([]);
      setMeasurements([]);
      setPanOffset({ x: 0, y: 0 });
      setRenderedPage(0);
      setRenderedZoom(0);
    } catch (e) {
      console.error("Failed to load PDF", e);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;
    if (renderedPage === currentPage && renderedZoom === zoom && renderedRotation === rotation) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      pageRef.current = page;
      const viewport = page.getViewport({ scale: zoom, rotation });
      pageScaleRef.current = zoom;

      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      if (overlayRef.current) {
        overlayRef.current.width = viewport.width;
        overlayRef.current.height = viewport.height;
      }

      setRenderedPage(currentPage);
      setRenderedZoom(zoom);
      setRenderedRotation(rotation);
    } catch (e) {
      console.error("Render error", e);
    }
  }, [pdfDoc, currentPage, zoom, rotation, renderedPage, renderedZoom, renderedRotation]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const getCanvasCoords = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top),
    };
  }, []);

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const pageAnnotations = annotations.filter((a) => a.pageNum === currentPage);
    for (const ann of pageAnnotations) {
      ctx.save();
      if (ann.type === "highlight") {
        ctx.fillStyle = ann.color;
        ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
        ctx.strokeStyle = ann.color.replace("80", "ff");
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
      } else {
        ctx.fillStyle = ann.color;
        ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
        ctx.strokeStyle = ann.color.replace("80", "ff");
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
        if (ann.note) {
          ctx.fillStyle = "#1a1a1a";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText("N", ann.x + 4, ann.y + 13);
        }
      }
      ctx.restore();
    }

    const pageMeasurements = measurements.filter((m) => m.pageNum === currentPage);
    for (const m of pageMeasurements) {
      ctx.save();
      ctx.strokeStyle = "#0066ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();

      const mx = (m.x1 + m.x2) / 2;
      const my = (m.y1 + m.y2) / 2;
      const label = `${m.realLength.toFixed(2)} ${m.unit}`;
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,80,200,0.85)";
      const tw = ctx.measureText(label).width + 12;
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2, my - 11, tw, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);

      ctx.fillStyle = "#0066ff";
      ctx.beginPath();
      ctx.arc(m.x1, m.y1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(m.x2, m.y2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (isDrawing.current && drawStart.current && drawCurrent.current) {
      const ds = drawStart.current;
      const dc = drawCurrent.current;
      ctx.save();
      if (tool === "measure") {
        ctx.strokeStyle = "#0066ff";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(ds.x, ds.y);
        ctx.lineTo(dc.x, dc.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const pxLen = distance(ds.x, ds.y, dc.x, dc.y);
        const realLen = scale.calibrated ? pxLen / scale.pixelsPerUnit : 0;
        const label = scale.calibrated ? `${realLen.toFixed(2)} ${scale.unit}` : `${pxLen.toFixed(0)}px`;
        const mx = (ds.x + dc.x) / 2;
        const my = (ds.y + dc.y) / 2;
        ctx.fillStyle = "rgba(0,80,200,0.9)";
        const tw = ctx.measureText(label).width + 12;
        ctx.beginPath();
        ctx.roundRect(mx - tw / 2, my - 11, tw, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my);
      } else if (tool === "highlight" || tool === "note") {
        const rx = Math.min(ds.x, dc.x);
        const ry = Math.min(ds.y, dc.y);
        const rw = Math.abs(dc.x - ds.x);
        const rh = Math.abs(dc.y - ds.y);
        ctx.fillStyle = selectedColor;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = selectedColor.replace("80", "dd");
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (tool === "scale-set" && scaleDrawStart.current && scaleDrawCurrent.current) {
        const sd = scaleDrawStart.current;
        const sc2 = scaleDrawCurrent.current;
        ctx.strokeStyle = "#ff6600";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(sd.x, sd.y);
        ctx.lineTo(sc2.x, sc2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ff6600";
        ctx.beginPath();
        ctx.arc(sd.x, sd.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sc2.x, sc2.y, 5, 0, Math.PI * 2);
        ctx.fill();
        const pxLen = distance(sd.x, sd.y, sc2.x, sc2.y);
        const label = `${pxLen.toFixed(0)}px`;
        const mx = (sd.x + sc2.x) / 2;
        const my = (sd.y + sc2.y) / 2;
        ctx.fillStyle = "rgba(200,80,0,0.9)";
        const tw = ctx.measureText(label).width + 12;
        ctx.beginPath();
        ctx.roundRect(mx - tw / 2, my - 11, tw, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, mx, my);
      }
      ctx.restore();
    }
  }, [annotations, measurements, currentPage, tool, scale, selectedColor]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, renderedPage, renderedZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);

    if (tool === "pan") {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
      return;
    }

    if (tool === "select") return;

    if (tool === "scale-set") {
      isDrawing.current = true;
      scaleDrawStart.current = pos;
      scaleDrawCurrent.current = pos;
      drawStart.current = pos;
      drawCurrent.current = pos;
      return;
    }

    isDrawing.current = true;
    drawStart.current = pos;
    drawCurrent.current = pos;
  }, [tool, panOffset, getCanvasCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);

    if (isPanning.current && tool === "pan") {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPanOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
      return;
    }

    if (isDrawing.current) {
      drawCurrent.current = pos;
      if (tool === "scale-set") {
        scaleDrawCurrent.current = pos;
      }
      drawOverlay();
    }
  }, [tool, getCanvasCoords, drawOverlay]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const pos = getCanvasCoords(e);

    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    if (!isDrawing.current || !drawStart.current) return;
    isDrawing.current = false;

    const ds = drawStart.current;
    drawStart.current = null;
    drawCurrent.current = null;

    if (tool === "measure") {
      const pxLen = distance(ds.x, ds.y, pos.x, pos.y);
      if (pxLen < 5) return;
      const realLen = scale.calibrated ? pxLen / scale.pixelsPerUnit : pxLen;
      const m: Measurement = {
        id: generateId(),
        pageNum: currentPage,
        x1: ds.x,
        y1: ds.y,
        x2: pos.x,
        y2: pos.y,
        pixelLength: pxLen,
        realLength: realLen,
        unit: scale.unit,
        label: "",
        createdAt: Date.now(),
      };
      setMeasurements((prev) => [...prev, m]);
    } else if (tool === "highlight" || tool === "note") {
      const rx = Math.min(ds.x, pos.x);
      const ry = Math.min(ds.y, pos.y);
      const rw = Math.abs(pos.x - ds.x);
      const rh = Math.abs(pos.y - ds.y);
      if (rw < 5 || rh < 5) return;
      const ann: Partial<Annotation> = {
        id: generateId(),
        type: tool === "highlight" ? "highlight" : "note",
        pageNum: currentPage,
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        color: selectedColor,
        createdAt: Date.now(),
      };
      setPendingAnnotation(ann);
      setNoteText("");
      setShowNoteDialog(true);
    } else if (tool === "scale-set") {
      if (!scaleDrawStart.current) return;
      const sd = scaleDrawStart.current;
      const pxLen = distance(sd.x, sd.y, pos.x, pos.y);
      if (pxLen < 5) return;
      scaleCalib.current = {
        x1: sd.x, y1: sd.y,
        x2: pos.x, y2: pos.y,
        pixelLength: pxLen,
      };
      scaleDrawStart.current = null;
      scaleDrawCurrent.current = null;
      setShowScaleDialog(true);
    }
    drawOverlay();
  }, [tool, getCanvasCoords, scale, currentPage, selectedColor, drawOverlay]);

  const handleMouseLeave = useCallback(() => {
    if (isPanning.current) isPanning.current = false;
    if (isDrawing.current) {
      isDrawing.current = false;
      drawStart.current = null;
      drawCurrent.current = null;
      drawOverlay();
    }
  }, [drawOverlay]);

  const confirmNote = () => {
    if (!pendingAnnotation) return;
    const ann: Annotation = {
      ...(pendingAnnotation as Annotation),
      note: noteText,
    };
    setAnnotations((prev) => [...prev, ann]);
    setShowNoteDialog(false);
    setPendingAnnotation(null);
    setNoteText("");
  };

  const cancelNote = () => {
    setShowNoteDialog(false);
    setPendingAnnotation(null);
    setNoteText("");
    drawOverlay();
  };

  const confirmScale = () => {
    if (scaleMode === "calibrate" && scaleCalib.current) {
      const realLen = parseFloat(scaleRealLength);
      if (!isNaN(realLen) && realLen > 0) {
        const ppu = scaleCalib.current.pixelLength / realLen;
        setScale({ pixelsPerUnit: ppu, unit: scaleUnit, drawingRatio: scaleRatio, calibrated: true });
        setMeasurements((prev) =>
          prev.map((m) => ({
            ...m,
            realLength: m.pixelLength / ppu,
            unit: scaleUnit,
          }))
        );
      }
    } else {
      const parts = scaleRatio.split(":").map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
        const factor = parts[1] / parts[0];
        const ppu = zoom / (factor * 0.001);
        setScale({ pixelsPerUnit: ppu, unit: scaleUnit, drawingRatio: scaleRatio, calibrated: true });
        setMeasurements((prev) =>
          prev.map((m) => ({
            ...m,
            realLength: m.pixelLength / ppu,
            unit: scaleUnit,
          }))
        );
      }
    }
    setShowScaleDialog(false);
    scaleCalib.current = null;
  };

  const deleteAnnotation = (id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  };

  const deleteMeasurement = (id: string) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
  };

  const fitToPage = () => {
    if (!canvasRef.current || !containerRef.current) return;
    const cont = containerRef.current;
    const cw = cont.clientWidth - 48;
    const ch = cont.clientHeight - 48;
    const canvas = canvasRef.current;
    const baseW = canvas.width / zoom;
    const baseH = canvas.height / zoom;
    const newZoom = Math.min(cw / baseW, ch / baseH, 3);
    setZoom(Math.max(0.1, newZoom));
    setPanOffset({ x: 0, y: 0 });
  };

  const getCursor = () => {
    if (tool === "pan") return isPanning.current ? "grabbing" : "grab";
    if (tool === "select") return "default";
    if (tool === "measure" || tool === "scale-set") return "crosshair";
    if (tool === "highlight" || tool === "note") return "crosshair";
    return "default";
  };

  const toolItems: { id: ToolMode; icon: any; label: string; shortcut: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
    { id: "pan", icon: Hand, label: "Pan", shortcut: "H" },
    { id: "measure", icon: Ruler, label: "Measure", shortcut: "M" },
    { id: "highlight", icon: Highlighter, label: "Highlight", shortcut: "L" },
    { id: "note", icon: StickyNote, label: "Note", shortcut: "N" },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "h" || e.key === "H") setTool("pan");
      if (e.key === "m" || e.key === "M") setTool("measure");
      if (e.key === "l" || e.key === "L") setTool("highlight");
      if (e.key === "n" || e.key === "N") setTool("note");
      if (e.key === "=" || e.key === "+") setZoom((z) => Math.min(5, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.1, z - 0.25));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const activePageAnnotations = annotations.filter((a) => a.pageNum === currentPage);
  const activePageMeasurements = measurements.filter((m) => m.pageNum === currentPage);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b bg-card shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">
            {fileName || "PDF Drawing Viewer"}
          </span>
          {fileName && (
            <Badge variant="outline" className="text-xs shrink-0">
              {totalPages} page{totalPages !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {pdfDoc && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-1 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {pdfDoc && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={fitToPage}
              data-testid="button-fit-page"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-0.5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  data-testid="button-rotate"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate 90°</TooltipContent>
            </Tooltip>
          </div>
        )}

        <Separator orientation="vertical" className="h-6" />

        {pdfDoc && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant={scale.calibrated ? "default" : "outline"}
              onClick={() => setShowScaleSetup(true)}
              className="gap-1.5"
              data-testid="button-scale-setup"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {scale.calibrated ? `${scale.drawingRatio} (${scale.unit})` : "Set Scale"}
            </Button>
          </div>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={() => setSidebarOpen((v) => !v)}
          data-testid="button-toggle-sidebar"
        >
          {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5 shrink-0"
          data-testid="button-open-file"
        >
          <Upload className="w-3.5 h-3.5" />
          Open PDF
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadPDF(file);
            e.target.value = "";
          }}
          data-testid="input-file"
        />
      </header>

      <div className="flex flex-1 min-h-0">
        {pdfDoc && (
          <aside className="flex flex-col gap-1 p-2 border-r bg-card shrink-0 z-10">
            {toolItems.map((t) => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={tool === t.id ? "default" : "ghost"}
                    onClick={() => setTool(t.id)}
                    data-testid={`button-tool-${t.id}`}
                    className="w-9 h-9"
                  >
                    <t.icon className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="flex items-center gap-2">
                    <span>{t.label}</span>
                    <kbd className="text-xs bg-muted px-1 rounded">{t.shortcut}</kbd>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}

            <Separator className="my-1" />

            {(tool === "highlight" || tool === "note") && (
              <div className="flex flex-col gap-1">
                {HIGHLIGHT_COLORS.map((c) => (
                  <Tooltip key={c.value}>
                    <TooltipTrigger asChild>
                      <button
                        className={`w-9 h-9 rounded-md border-2 transition-all ${selectedColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c.value }}
                        onClick={() => setSelectedColor(c.value)}
                        data-testid={`button-color-${c.label.toLowerCase()}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="right">{c.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}

            {tool === "scale-set" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setTool("pan")}
                    className="w-9 h-9"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Cancel</TooltipContent>
              </Tooltip>
            )}
          </aside>
        )}

        <main
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-muted/30"
          style={{ cursor: getCursor() }}
        >
          {!pdfDoc && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 select-none">
              <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                <div className="w-20 h-20 rounded-2xl bg-card border-2 border-dashed border-border flex items-center justify-center">
                  <FileText className="w-10 h-10 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg mb-1">Open a PDF Drawing</h2>
                  <p className="text-sm text-muted-foreground">
                    Load a technical drawing to view, annotate, and measure dimensions.
                  </p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} className="gap-2" data-testid="button-open-empty">
                  <Upload className="w-4 h-4" />
                  Open PDF File
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-xl">
                {[
                  { icon: Ruler, title: "Scale Measurement", desc: "Set drawing scale and measure real distances" },
                  { icon: Highlighter, title: "Highlight Areas", desc: "Mark up important sections with colors" },
                  { icon: StickyNote, title: "Add Notes", desc: "Annotate areas with detailed comments" },
                ].map((item) => (
                  <div key={item.title} className="bg-card border rounded-md p-4 text-center">
                    <item.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading PDF...</span>
              </div>
            </div>
          )}

          {pdfDoc && (
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: `translate(-50%, -50%) translate(${panOffset.x}px, ${panOffset.y}px)`,
                }}
              >
                <div className="relative shadow-xl rounded-sm" style={{ display: "inline-block" }}>
                  <canvas ref={canvasRef} className="block" style={{ borderRadius: "2px" }} />
                  <canvas
                    ref={overlayRef}
                    className="absolute inset-0"
                    style={{ borderRadius: "2px" }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    data-testid="canvas-overlay"
                  />
                </div>
              </div>

              {!scale.calibrated && tool === "measure" && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Set drawing scale first for real-world measurements
                </div>
              )}

              {tool === "scale-set" && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-orange-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow">
                  <Ruler className="w-3.5 h-3.5" />
                  Draw a line of known length on the drawing to calibrate scale
                </div>
              )}
            </div>
          )}
        </main>

        {pdfDoc && sidebarOpen && (
          <aside className="w-72 border-l bg-card flex flex-col shrink-0 overflow-hidden">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-sm">Annotations</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {activePageAnnotations.length === 0 && activePageMeasurements.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No annotations on this page.
                  <br />
                  Use the tools on the left to add highlights, notes, and measurements.
                </div>
              )}

              {activePageMeasurements.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground px-1 py-1">MEASUREMENTS</p>
                  {activePageMeasurements.map((m) => (
                    <div
                      key={m.id}
                      className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover-elevate bg-background mb-1"
                      data-testid={`measurement-item-${m.id}`}
                    >
                      <Ruler className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                          {m.realLength.toFixed(3)} {m.unit}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.pixelLength.toFixed(0)}px on drawing</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-6 h-6"
                        onClick={() => deleteMeasurement(m.id)}
                        data-testid={`button-delete-measurement-${m.id}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {activePageAnnotations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground px-1 py-1 mt-2">ANNOTATIONS</p>
                  {activePageAnnotations.map((ann) => (
                    <div
                      key={ann.id}
                      className="group rounded-md px-2 py-1.5 mb-1 hover-elevate bg-background"
                      data-testid={`annotation-item-${ann.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-3.5 h-3.5 rounded-sm mt-0.5 shrink-0 border"
                          style={{ backgroundColor: ann.color, borderColor: ann.color.replace("80", "aa") }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs font-medium capitalize">{ann.type}</span>
                            <Badge variant="outline" className="text-xs py-0 h-4">
                              pg {ann.pageNum}
                            </Badge>
                          </div>
                          {ann.note && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{ann.note}</p>
                          )}
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-6 h-6 shrink-0"
                            onClick={() => {
                              setEditingAnnotation(ann);
                              setNoteText(ann.note);
                              setShowNoteDialog(true);
                            }}
                            data-testid={`button-edit-annotation-${ann.id}`}
                          >
                            <StickyNote className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-6 h-6 shrink-0"
                            onClick={() => deleteAnnotation(ann.id)}
                            data-testid={`button-delete-annotation-${ann.id}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t p-2">
              <div className="bg-background rounded-md p-2 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Scale</span>
                  <span className={scale.calibrated ? "font-medium" : "text-muted-foreground"}>
                    {scale.calibrated ? `${scale.drawingRatio}` : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium">{scale.unit}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Measurements</span>
                  <span className="font-medium">{measurements.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Annotations</span>
                  <span className="font-medium">{annotations.length}</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      <Dialog open={showNoteDialog} onOpenChange={(v) => { if (!v) cancelNote(); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-note">
          <DialogHeader>
            <DialogTitle>
              {editingAnnotation ? "Edit Note" : pendingAnnotation?.type === "note" ? "Add Note" : "Add Highlight Note"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="note-text">Note (optional)</Label>
              <Textarea
                id="note-text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note or comment for this annotation..."
                className="mt-1 resize-none"
                rows={4}
                data-testid="input-note-text"
              />
            </div>
            {!editingAnnotation && (
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={`w-7 h-7 rounded-md border-2 transition-all ${selectedColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setSelectedColor(c.value)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelNote} data-testid="button-note-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingAnnotation) {
                  setAnnotations((prev) =>
                    prev.map((a) => a.id === editingAnnotation.id ? { ...a, note: noteText } : a)
                  );
                  setEditingAnnotation(null);
                  setShowNoteDialog(false);
                  setNoteText("");
                } else {
                  confirmNote();
                }
              }}
              data-testid="button-note-confirm"
            >
              <Check className="w-4 h-4 mr-1" />
              {editingAnnotation ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showScaleSetup} onOpenChange={setShowScaleSetup}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-scale-setup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Drawing Scale Setup
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`p-3 rounded-md border text-sm font-medium text-left transition-colors ${scaleMode === "ratio" ? "border-primary bg-primary/5" : "border-border"}`}
                onClick={() => setScaleMode("ratio")}
                data-testid="button-scale-mode-ratio"
              >
                <p className="font-semibold mb-0.5">Use Drawing Ratio</p>
                <p className="text-xs text-muted-foreground">Enter the ratio from the title block (e.g. 1:100)</p>
              </button>
              <button
                className={`p-3 rounded-md border text-sm font-medium text-left transition-colors ${scaleMode === "calibrate" ? "border-primary bg-primary/5" : "border-border"}`}
                onClick={() => setScaleMode("calibrate")}
                data-testid="button-scale-mode-calibrate"
              >
                <p className="font-semibold mb-0.5">Calibrate from Drawing</p>
                <p className="text-xs text-muted-foreground">Draw a line over a known dimension</p>
              </button>
            </div>

            {scaleMode === "ratio" ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="scale-ratio">Drawing Scale Ratio</Label>
                  <Input
                    id="scale-ratio"
                    value={scaleRatio}
                    onChange={(e) => setScaleRatio(e.target.value)}
                    placeholder="e.g. 1:100"
                    className="mt-1"
                    data-testid="input-scale-ratio"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Common: 1:10, 1:20, 1:50, 1:100, 1:200, 1:500</p>
                </div>
                <div>
                  <Label>Output Unit</Label>
                  <Select value={scaleUnit} onValueChange={(v) => setScaleUnit(v as ScaleUnit)}>
                    <SelectTrigger className="mt-1" data-testid="select-scale-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">Millimetres (mm)</SelectItem>
                      <SelectItem value="cm">Centimetres (cm)</SelectItem>
                      <SelectItem value="m">Metres (m)</SelectItem>
                      <SelectItem value="in">Inches (in)</SelectItem>
                      <SelectItem value="ft">Feet (ft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowScaleSetup(false);
                    setTool("pan");
                    confirmScale();
                  }}
                  data-testid="button-scale-apply-ratio"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Apply Scale
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-md p-3">
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">How to calibrate:</p>
                  <ol className="text-xs text-orange-700 dark:text-orange-300 space-y-1 list-decimal list-inside">
                    <li>Close this dialog</li>
                    <li>The "Calibrate Scale" tool will activate</li>
                    <li>Draw a line over a dimension you know (e.g. a dimension line)</li>
                    <li>Enter the real-world length of that line</li>
                  </ol>
                </div>
                <div>
                  <Label>Output Unit</Label>
                  <Select value={scaleUnit} onValueChange={(v) => setScaleUnit(v as ScaleUnit)}>
                    <SelectTrigger className="mt-1" data-testid="select-scale-unit-calibrate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">Millimetres (mm)</SelectItem>
                      <SelectItem value="cm">Centimetres (cm)</SelectItem>
                      <SelectItem value="m">Metres (m)</SelectItem>
                      <SelectItem value="in">Inches (in)</SelectItem>
                      <SelectItem value="ft">Feet (ft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setShowScaleSetup(false);
                    setTool("scale-set");
                  }}
                  data-testid="button-scale-start-calibrate"
                >
                  <Ruler className="w-4 h-4 mr-2" />
                  Start Calibration
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showScaleDialog} onOpenChange={setShowScaleDialog}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-scale-calibrate">
          <DialogHeader>
            <DialogTitle>Calibrate Scale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {scaleCalib.current && (
              <div className="bg-muted rounded-md p-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Line drawn:</span>
                <span className="font-medium">{scaleCalib.current.pixelLength.toFixed(0)} pixels</span>
              </div>
            )}
            <div>
              <Label htmlFor="real-length">Real-world length of this line</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="real-length"
                  type="number"
                  value={scaleRealLength}
                  onChange={(e) => setScaleRealLength(e.target.value)}
                  placeholder="e.g. 10"
                  className="flex-1"
                  data-testid="input-real-length"
                />
                <Select value={scaleUnit} onValueChange={(v) => setScaleUnit(v as ScaleUnit)}>
                  <SelectTrigger className="w-24" data-testid="select-calibrate-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mm">mm</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="m">m</SelectItem>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="ft">ft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowScaleDialog(false);
                scaleCalib.current = null;
                setTool("pan");
              }}
              data-testid="button-calibrate-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                confirmScale();
                setTool("measure");
              }}
              data-testid="button-calibrate-confirm"
            >
              <Check className="w-4 h-4 mr-1" />
              Set Scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
