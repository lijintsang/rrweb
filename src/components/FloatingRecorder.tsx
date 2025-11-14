import { useRef, useState } from 'react';
import { record } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';
import { useNavigate } from 'react-router-dom';

type Recording = {
  id: string;
  name: string;
  createdAt: number;
  events: eventWithTime[];
};

const STORAGE_KEY = 'rrweb-recordings';

function readRecordings(): Recording[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

function writeRecordings(list: Recording[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function FloatingRecorder() {
  const [isRecording, setRecording] = useState(false);
  const [events, setEvents] = useState<eventWithTime[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();
  const [isDrawing, setIsDrawing] = useState(false);
  const drawRef = useRef<{
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    isPainting: boolean;
    cleanup: () => void;
  } | null>(null);

  const startRecording = () => {
    if (isRecording) return;
    setEvents([]);
    const stop = record({
      emit(event) {
        setEvents((prev) => [...prev, event]);
      },
      // 录制 <canvas> 内容（可选采样和图片质量）
      recordCanvas: true,
      sampling: { canvas: 15 },
      dataURLOptions: { type: 'image/webp', quality: 0.6 },
    });
    stopRef.current = stop ?? null;
    setRecording(true);
  };

  // 开启/关闭画笔
  const toggleDrawing = () => {
    if (!isDrawing) {
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.className = 'rr-draw-canvas'; // 不使用 rr-block，确保被录制
      document.body.appendChild(canvas);

      const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      };
      resize();

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = '#ff4d4f';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      const state = { isPainting: false };

      const start = (e: PointerEvent) => {
        state.isPainting = true;
        ctx.beginPath();
        ctx.moveTo(e.clientX, e.clientY);
      };
      const move = (e: PointerEvent) => {
        if (!state.isPainting) return;
        ctx.lineTo(e.clientX, e.clientY);
        ctx.stroke();
      };
      const end = () => {
        state.isPainting = false;
        ctx.beginPath();
      };

      canvas.addEventListener('pointerdown', start);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointerleave', end);
      window.addEventListener('resize', resize);

      const cleanup = () => {
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('pointerdown', start);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', end);
        canvas.removeEventListener('pointerleave', end);
        canvas.remove();
      };

      drawRef.current = { canvas, ctx, isPainting: state.isPainting, cleanup };
      setIsDrawing(true);
    } else {
      drawRef.current?.cleanup();
      drawRef.current = null;
      setIsDrawing(false);
    }
  };

  const stopRecording = () => {
    stopRef.current?.();
    stopRef.current = null;
    setRecording(false);

    // 关闭画笔（如开启中）
    if (isDrawing) {
      toggleDrawing();
    }

    // 停止后自动保存
    if (events.length > 0) {
      // console.log('🚀 ~ stopRecording ~ events-------->', events);
      const createdAt = Date.now();
      const id = `${createdAt}`;
      const name = `录制-${new Date(createdAt).toLocaleString()}`;
      const list = readRecordings();
      writeRecordings([{ id, name, createdAt, events }, ...list]);
      setEvents([]);
    }
  };

  const goToReplay = () => {
    if (isRecording) {
      stopRecording();
    }
    // 关闭画笔以免影响页面交互
    if (isDrawing) toggleDrawing();
    navigate('/replay');
  };

  return (
    <div className="floating-recorder" title="页面录制控制">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={isRecording ? 'stop' : 'start'}
      >
        {isRecording ? '停止并保存' : '开始录制'}
      </button>
      <button onClick={goToReplay}>回放</button>
      <button onClick={toggleDrawing} className={isDrawing ? 'stop' : 'start'}>
        {isDrawing ? '关闭画笔' : '开启画笔'}
      </button>
    </div>
  );
}
