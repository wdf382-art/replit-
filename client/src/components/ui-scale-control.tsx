import { useState, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useUiScaleStore, MIN_SCALE, MAX_SCALE, DEFAULT_SCALE } from "@/stores/ui-scale-store";

export function UiScaleControl() {
  const { scale, setScale, resetScale } = useUiScaleStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; startScale: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, startScale: scale };
  }, [scale]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const scaleDelta = deltaX / 200;
    const newScale = dragStartRef.current.startScale + scaleDelta;
    
    requestAnimationFrame(() => {
      setScale(newScale);
    });
  }, [isDragging, setScale]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const percentage = Math.round(scale * 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1 px-2"
          data-testid="button-ui-scale"
        >
          <ZoomIn className="h-4 w-4" />
          <span className="text-xs tabular-nums">{percentage}%</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">界面缩放</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetScale}
              disabled={scale === DEFAULT_SCALE}
              data-testid="button-reset-scale"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              重置
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[scale]}
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              onValueChange={([value]) => setScale(value)}
              className="flex-1"
              data-testid="slider-ui-scale"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <div className="text-center text-2xl font-bold tabular-nums">
            {percentage}%
          </div>
          
          <div 
            className={`h-8 rounded-md border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground cursor-ew-resize select-none ${isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            data-testid="drag-zone-scale"
          >
            {isDragging ? '松开以确认' : '左右拖动调整'}
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(MIN_SCALE * 100)}%</span>
            <span>{Math.round(MAX_SCALE * 100)}%</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
