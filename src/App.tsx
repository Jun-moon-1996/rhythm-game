import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeAudio, Beat } from './lib/audio';
import { HandTracker } from './lib/handTracker';
import { preloadCatImage } from './lib/image';
import { GameCanvas } from './components/GameCanvas';
import { Play, RotateCcw, Camera, Music, Keyboard, Check, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { CatType, PreloadedCatImage } from './types';
import { CAT_IMAGES } from './constants';

const AUDIO_URL = 'https://raw.githubusercontent.com/Jun-moon-1996/-music/main/fall%20in%20love.mp3';

const translations = {
  en: {
    title: "Fall in Love",
    subtitle: '"Chase the rhythm, release the bubbles."',
    handControl: "Hand Control",
    handControlDesc: "Use your webcam to control movement. Move your hand up and down. Fist to pause.",
    keyboard: "Keyboard",
    keyboardDesc: "W/S or Arrows to move. Space to pause.",
    rhythmBased: "Rhythm Based",
    rhythmBasedDesc: "Bubbles are generated from the song's waveform. Hit them all!",
    chooseCat: "CHOOSE YOUR CAT",
    startJourney: "START JOURNEY",
    easy: "EASY",
    normal: "NORMAL",
    hard: "HARD",
    halfSong: "HALF SONG",
    fullSong: "FULL SONG",
    loading: "Analyzing sound waves & initializing camera...",
    paused: "PAUSED",
    resume: "RESUME",
    handDetected: "HAND DETECTED",
    noHandDetected: "NO HAND DETECTED",
    gameOver: "GAME OVER",
    tryAgain: "TRY AGAIN",
    clear: "CLEAR!",
    winDesc: "You released all the bubbles!",
    playAgain: "PLAY AGAIN",
    cameraDenied: "Camera access denied. Please allow camera permissions in your browser settings and refresh.",
    noCamera: "No camera found. Please connect a webcam to play.",
    initError: "Failed to initialize game."
  },
  zh: {
    title: "坠入爱河",
    subtitle: '"追随节奏，释放气泡。"',
    handControl: "手势控制",
    handControlDesc: "使用摄像头控制移动。上下移动手部。握拳暂停。",
    keyboard: "键盘控制",
    keyboardDesc: "W/S 或方向键移动。空格键暂停。",
    rhythmBased: "节奏感应",
    rhythmBasedDesc: "气泡根据歌曲波形生成。击碎所有气泡！",
    chooseCat: "选择你的猫咪",
    startJourney: "开始旅程",
    easy: "简单",
    normal: "普通",
    hard: "困难",
    halfSong: "半首歌",
    fullSong: "整首歌",
    loading: "正在分析声波并初始化摄像头...",
    paused: "已暂停",
    resume: "继续游戏",
    handDetected: "已检测到手部",
    noHandDetected: "未检测到手部",
    gameOver: "游戏失败",
    tryAgain: "再试一次",
    clear: "通关！",
    winDesc: "你释放了所有的气泡！",
    playAgain: "再玩一次",
    cameraDenied: "摄像头访问被拒绝。请在浏览器设置中允许摄像头权限并刷新。",
    noCamera: "未找到摄像头。请连接摄像头以进行游戏。",
    initError: "初始化游戏失败。"
  }
};

interface CatPreviewProps {
  key?: string | number;
  type: CatType;
  selected: boolean;
  onClick: () => void;
  preloaded?: PreloadedCatImage;
}

const CatPreview = ({ type, selected, onClick, preloaded }: CatPreviewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = (img: HTMLImageElement, bounds: { x: number, y: number, w: number, h: number }) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      const targetSize = 80;
      const scale = targetSize / Math.max(bounds.w, bounds.h);
      ctx.scale(scale, scale);
      
      ctx.drawImage(
        img, 
        bounds.x, bounds.y, bounds.w, bounds.h,
        -bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h
      );
      
      ctx.restore();
    };

    if (preloaded) {
      draw(preloaded.img, preloaded.bounds);
    } else {
      const img = new Image();
      img.src = CAT_IMAGES[type];
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!tempCtx) return;

        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);

        const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;

        let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const alpha = data[(y * img.width + x) * 4 + 3];
            if (alpha > 10) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
              found = true;
            }
          }
        }

        const bounds = found 
          ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
          : { x: 0, y: 0, w: img.width, h: img.height };

        draw(img, bounds);
      };
    }
  }, [type, preloaded]);

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative cursor-pointer p-4 rounded-2xl border-2 transition-all ${selected ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
    >
      <canvas ref={canvasRef} width={120} height={100} className="mx-auto" />
      {selected && (
        <div className="absolute top-2 right-2 bg-blue-500 rounded-full p-1">
          <Check size={12} className="text-white" />
        </div>
      )}
    </motion.div>
  );
};

const Cloud = ({ x, y, size, speed }: { x: string, y: string, size: number, speed: number }) => {
  return (
    <motion.div
      initial={{ x: '-20%' }}
      animate={{ x: '120%' }}
      transition={{ duration: 60 / speed, repeat: Infinity, ease: 'linear' }}
      style={{ left: x, top: y, position: 'absolute' }}
      className="pointer-events-none"
    >
      <div className="relative">
        {/* Light Blue Outline */}
        <div className="absolute inset-0 scale-110 blur-[2px]" style={{ opacity: 0.5 }}>
          <div className="bg-[#cce0f5] rounded-b-none rounded-t-full absolute" style={{ width: size * 1.8, height: size * 1.5, left: '20%', bottom: 0 }} />
          <div className="bg-[#cce0f5] rounded-b-none rounded-t-full absolute" style={{ width: size * 1.2, height: size * 0.9, left: '60%', bottom: 0 }} />
          <div className="bg-[#cce0f5] absolute" style={{ width: size * 4, height: size * 0.5, left: 0, bottom: 0 }} />
        </div>
        {/* White Fill */}
        <div className="relative">
          <div className="bg-white rounded-b-none rounded-t-full absolute" style={{ width: size * 1.8, height: size * 1.5, left: '20%', bottom: 0 }} />
          <div className="bg-white rounded-b-none rounded-t-full absolute" style={{ width: size * 1.2, height: size * 0.9, left: '60%', bottom: 0 }} />
          <div className="bg-white absolute" style={{ width: size * 4, height: size * 0.5, left: 0, bottom: 0 }} />
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'loading' | 'countdown' | 'playing' | 'gameover' | 'win'>('start');
  const [isPaused, setIsPaused] = useState(false);
  const [resumeCountdown, setResumeCountdown] = useState(0);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [handY, setHandY] = useState(0.5);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [preloadedCats, setPreloadedCats] = useState<Record<CatType, PreloadedCatImage> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catType, setCatType] = useState<CatType>('tuxedo_cat');
  const [gameSpeed, setGameSpeed] = useState<number>(2);
  const [songMode, setSongMode] = useState<'half' | 'full'>('full');
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('bubble_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });

  const t = translations[language];

  const videoRef = useRef<HTMLVideoElement>(null);
  const handTrackerRef = useRef<HandTracker | null>(null);

  // Preload cats on mount
  useEffect(() => {
    const preload = async () => {
      try {
        const results = await Promise.all(
          Object.entries(CAT_IMAGES).map(async ([type, url]) => {
            const data = await preloadCatImage(type as CatType, url);
            return { type, data };
          })
        );
        const map = results.reduce((acc, { type, data }) => {
          acc[type as CatType] = data;
          return acc;
        }, {} as Record<CatType, PreloadedCatImage>);
        setPreloadedCats(map);
      } catch (err) {
        console.error('Failed to preload cats:', err);
      }
    };
    preload();
  }, []);

  const startGame = async () => {
    setGameState('loading');
    setError(null);
    try {
      // 1. Start hand tracking first to trigger camera prompt immediately
      if (videoRef.current) {
        if (!handTrackerRef.current) {
          handTrackerRef.current = new HandTracker(videoRef.current, (results) => {
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
              setIsHandDetected(true);
              const landmarks = results.multiHandLandmarks[0];
              if (!landmarks || landmarks.length < 21) return;
              
              // Fist detection: Tips (8,12,16,20) below MCPs (5,9,13,17)
              const fingerTips = [8, 12, 16, 20];
              const fingerMcps = [5, 9, 13, 17];
              const isFist = fingerTips.every((tipIdx, i) => {
                const tip = landmarks[tipIdx];
                const mcp = landmarks[fingerMcps[i]];
                return tip && mcp && tip.y > mcp.y;
              });

              if (isFist) {
                setGameState(current => {
                  if (current === 'playing') {
                    setIsPaused(p => {
                      if (!p) return true;
                      return p;
                    });
                  }
                  return current;
                });
              }

              // Calculate palm center by averaging key landmarks:
              // 0: Wrist, 5: Index MCP, 9: Middle MCP, 13: Ring MCP, 17: Pinky MCP
              const palmLandmarks = [0, 5, 9, 13, 17];
              let sumY = 0;
              let count = 0;
              
              palmLandmarks.forEach(idx => {
                if (landmarks[idx]) {
                  sumY += landmarks[idx].y;
                  count++;
                }
              });
              
              const rawPalmY = count > 0 ? sumY / count : 0.5;
              
              // Map 0.2-0.8 range to 0-1 for easier reach
              const mappedY = (rawPalmY - 0.2) / 0.6;
              const finalY = Math.max(0, Math.min(1, mappedY));
              
              if (!isNaN(finalY)) {
                setHandY(finalY);
              }
            } else {
              setIsHandDetected(false);
            }
          });
        }
        await handTrackerRef.current.start();
      } else {
        throw new Error('Camera element not ready.');
      }

      // 2. Load and analyze audio in parallel or after camera
      const maxDuration = songMode === 'half' ? 128 : undefined;
      const { beats: analyzedBeats, audioBuffer: buffer, duration: analyzedDuration } = await analyzeAudio(AUDIO_URL, gameSpeed, maxDuration);
      setBeats(analyzedBeats);
      setAudioBuffer(buffer);
      setDuration(analyzedDuration);

      setGameState('playing');
    } catch (err) {
      console.error('Initialization error:', err);
      let message = t.initError;
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = t.cameraDenied;
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = t.noCamera;
        } else {
          message = `${t.initError}: ${err.message}`;
        }
      }
      setError(message);
      setGameState('start');
      if (handTrackerRef.current) {
        handTrackerRef.current.stop();
      }
    }
  };

  const resetGame = () => {
    if (handTrackerRef.current) {
      handTrackerRef.current.stop();
    }
    setGameState('start');
    setIsPaused(false);
    setResumeCountdown(0);
    setBeats([]);
    setAudioBuffer(null);
  };

  // Keyboard Controls
  useEffect(() => {
    if (gameState !== 'playing') return;

    const keysPressed = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (resumeCountdown === 0) {
          if (isPaused) {
            setResumeCountdown(3);
          } else {
            setIsPaused(true);
          }
        }
        return;
      }
      if (isPaused || resumeCountdown > 0) return;
      keysPressed.add(e.key.toLowerCase());
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let lastTime = performance.now();
    const moveSpeed = 1.8; // Increased speed for better responsiveness

    let frameId: number;
    const update = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      let dy = 0;
      if (keysPressed.has('w') || keysPressed.has('arrowup')) dy -= moveSpeed * dt;
      if (keysPressed.has('s') || keysPressed.has('arrowdown')) dy += moveSpeed * dt;

      if (dy !== 0) {
        setHandY(prev => Math.max(0, Math.min(1, prev + dy)));
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(frameId);
    };
  }, [gameState, isPaused, resumeCountdown]);

  // Resume Countdown Logic
  useEffect(() => {
    if (resumeCountdown > 0) {
      const timer = setTimeout(() => {
        if (resumeCountdown === 1) {
          setIsPaused(false);
        }
        setResumeCountdown(resumeCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resumeCountdown]);

  const isStartScreen = gameState === 'start';
  const backgroundUrl = 'https://raw.githubusercontent.com/Jun-moon-1996/fall-in-love-game/main/fil%20background.png';

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 font-sans overflow-hidden transition-all duration-1000 bg-[#f0f9ff] text-slate-800"
    >
      {/* Hidden Video for Hand Tracking (Always rendered to avoid ref issues) */}
      <video
        ref={videoRef}
        className="fixed opacity-0 pointer-events-none w-1 h-1"
        autoPlay
        muted
        playsInline
      />

      <AnimatePresence mode="wait">
        {gameState === 'start' && (
          <motion.div
            key="start"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative w-full max-w-6xl aspect-video bg-[#f0f9ff] rounded-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center p-8"
          >
            {/* Language Switcher & High Score */}
            <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
              <div className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-yellow-200 rounded-full text-xs font-bold text-yellow-700 shadow-sm">
                🏆 {language === 'en' ? 'BEST' : '最高分'}: {highScore}
              </div>
              <button
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="px-4 py-2 bg-white border border-blue-100 rounded-full text-xs font-bold text-blue-600 shadow-sm hover:bg-blue-50 transition-colors"
              >
                {language === 'en' ? '中文' : 'English'}
              </button>
            </div>

            <div className="relative z-10 text-center max-w-4xl w-full mx-auto">
              <h1 className={`text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 drop-shadow-sm text-center w-full ${language === 'zh' ? 'font-zh-title mb-4 tracking-wide' : 'font-en-title mb-2'}`}>
                {t.title}
              </h1>
              <p className={`text-xl text-slate-600 italic font-medium text-center w-full ${language === 'zh' ? 'mb-10' : 'mb-8'}`}>
                {t.subtitle}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2 text-blue-600">
                    <Camera size={20} />
                    <h3 className="font-bold text-sm">{t.handControl}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.handControlDesc}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2 text-green-600">
                    <Keyboard size={20} />
                    <h3 className="font-bold text-sm">{t.keyboard}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.keyboardDesc}</p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2 text-purple-600">
                    <Music size={20} />
                    <h3 className="font-bold text-sm">{t.rhythmBased}</h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{t.rhythmBasedDesc}</p>
                </div>
              </div>

              <div className="mb-10">
                <h3 className="text-sm font-bold mb-4 text-slate-400 uppercase tracking-widest">{t.chooseCat}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  {(['tuxedo_cat', 'orange_tabby', 'siamese', 'calico'] as CatType[]).map(type => (
                    <CatPreview
                      key={type}
                      type={type}
                      selected={catType === type}
                      onClick={() => setCatType(type)}
                      preloaded={preloadedCats?.[type]}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mb-10 max-w-4xl mx-auto w-full">
                {/* Speed Selector */}
                <div className="flex justify-end">
                  <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-2xl border border-blue-100 shadow-sm">
                    <button 
                      onClick={() => {
                        const speeds = [1, 2, 4];
                        const idx = speeds.indexOf(gameSpeed);
                        setGameSpeed(speeds[(idx - 1 + speeds.length) % speeds.length]);
                      }}
                      className="p-1 hover:bg-blue-100 rounded-full transition-colors text-blue-600"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="w-16 text-center font-bold text-slate-700 text-sm whitespace-nowrap">
                      {gameSpeed === 1 ? t.easy : gameSpeed === 2 ? t.normal : t.hard}
                    </div>
                    <button 
                      onClick={() => {
                        const speeds = [1, 2, 4];
                        const idx = speeds.indexOf(gameSpeed);
                        setGameSpeed(speeds[(idx + 1) % speeds.length]);
                      }}
                      className="p-1 hover:bg-blue-100 rounded-full transition-colors text-blue-600"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={startGame}
                    className="group relative px-10 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-200"
                  >
                    <span className="flex items-center gap-2">
                      <Play fill="currentColor" size={20} /> {t.startJourney}
                    </span>
                  </button>
                </div>

                {/* Duration Selector */}
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-2xl border border-purple-100 shadow-sm">
                    <button 
                      onClick={() => setSongMode(prev => prev === 'full' ? 'half' : 'full')}
                      className="p-1 hover:bg-purple-100 rounded-full transition-colors text-purple-600"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="w-24 text-center font-bold text-slate-700 text-sm whitespace-nowrap">
                      {songMode === 'half' ? t.halfSong : t.fullSong}
                    </div>
                    <button 
                      onClick={() => setSongMode(prev => prev === 'full' ? 'half' : 'full')}
                      className="p-1 hover:bg-purple-100 rounded-full transition-colors text-purple-600"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative w-full max-w-6xl aspect-video bg-cover bg-center rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 flex flex-col items-center justify-center"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          >
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white font-bold animate-pulse drop-shadow-md">{t.loading}</p>
          </motion.div>
        )}

        {(gameState === 'playing' || gameState === 'gameover' || gameState === 'win') && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative w-full max-w-6xl aspect-video bg-cover bg-center rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          >
            <GameCanvas
              beats={beats}
              audioBuffer={audioBuffer!}
              duration={duration}
              handY={handY}
              isPlaying={gameState === 'playing'}
              isPaused={isPaused}
              onGameOver={() => setGameState(s => s === 'playing' ? 'gameover' : s)}
              onWin={() => setGameState(s => s === 'playing' ? 'win' : s)}
              catType={catType}
              gameSpeed={gameSpeed}
              preloadedCats={preloadedCats}
              highScore={highScore}
              onNewHighScore={(score) => {
                setHighScore(score);
                localStorage.setItem('bubble_high_score', score.toString());
              }}
              language={language}
            />

            {/* Pause Button */}
            {gameState === 'playing' && (
              <button
                onClick={() => {
                  if (resumeCountdown === 0) {
                    if (isPaused) {
                      setResumeCountdown(3);
                    } else {
                      setIsPaused(true);
                    }
                  }
                }}
                className="absolute top-4 right-4 z-50 p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white hover:bg-white/30 transition-all"
              >
                {isPaused || resumeCountdown > 0 ? <Play fill="currentColor" size={24} /> : <div className="flex gap-1"><div className="w-1.5 h-6 bg-white rounded-full" /><div className="w-1.5 h-6 bg-white rounded-full" /></div>}
              </button>
            )}

            {/* BGM Info */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/50 pointer-events-none z-30">
              BGM: JUN《 Fall In Love 》
            </div>

            {/* Pause Overlay */}
            <AnimatePresence>
              {(isPaused || resumeCountdown > 0) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm z-40 flex flex-col items-center justify-center"
                >
                  {resumeCountdown > 0 ? (
                    <motion.div
                      key={resumeCountdown}
                      initial={{ scale: 2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-9xl font-black text-white drop-shadow-2xl"
                    >
                      {resumeCountdown}
                    </motion.div>
                  ) : (
                    <>
                      <h2 className="text-5xl font-black text-white mb-8 tracking-tighter">{t.paused}</h2>
                      <button
                        onClick={() => setResumeCountdown(3)}
                        className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-xl shadow-xl transition-all hover:scale-105"
                      >
                        {t.resume}
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hand Status Indicator */}
            <div className={`absolute top-4 left-4 px-4 py-2 rounded-full text-sm font-bold backdrop-blur-md transition-colors ${isHandDetected ? 'bg-green-500/40 text-green-200 border border-green-500/50' : 'bg-red-500/40 text-red-200 border border-red-500/50'}`}>
              {isHandDetected ? t.handDetected : t.noHandDetected}
            </div>

            {/* Camera Overlay (Displaying the same video stream) */}
            <div className="absolute bottom-4 right-4 w-40 aspect-video bg-black/50 rounded-lg border border-white/20 overflow-hidden">
              <canvas
                ref={(canvas) => {
                  if (canvas && videoRef.current) {
                    const ctx = canvas.getContext('2d');
                    const draw = () => {
                      if (ctx && videoRef.current) {
                        ctx.save();
                        ctx.scale(-1, 1);
                        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
                        ctx.restore();
                        
                        if (isHandDetected) {
                          ctx.fillStyle = '#60a5fa';
                          ctx.fillRect(0, handY * canvas.height - 2, canvas.width, 4);
                          
                          // Draw a dot for the palm center
                          ctx.beginPath();
                          ctx.arc(canvas.width / 2, handY * canvas.height, 6, 0, Math.PI * 2);
                          ctx.fillStyle = '#ffffff';
                          ctx.fill();
                          ctx.strokeStyle = '#60a5fa';
                          ctx.lineWidth = 2;
                          ctx.stroke();
                        }
                      }
                      requestAnimationFrame(draw);
                    };
                    draw();
                  }
                }}
                width={160}
                height={90}
                className="w-full h-full"
              />
            </div>

            {/* Game Over Overlay */}
            <AnimatePresence>
              {gameState === 'gameover' && (
                <motion.div
                  initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                  animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                  className="absolute inset-0 bg-blue-900/40 flex flex-col items-center justify-center"
                >
                  <h2 className="text-6xl font-black text-red-500 mb-8 drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]">{t.gameOver}</h2>
                  <button
                    onClick={resetGame}
                    className="flex items-center gap-2 px-10 py-4 bg-white text-blue-900 rounded-full font-bold text-lg hover:bg-blue-50 transition-all hover:scale-105 shadow-2xl"
                  >
                    <RotateCcw size={22} /> {t.tryAgain}
                  </button>
                </motion.div>
              )}

              {gameState === 'win' && (
                <motion.div
                  initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                  animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                  className="absolute inset-0 bg-blue-900/40 flex flex-col items-center justify-center"
                >
                  <h2 className="text-6xl font-bold text-yellow-400 mb-4">{t.clear}</h2>
                  <p className="text-xl text-white mb-8">{t.winDesc}</p>
                  <button
                    onClick={resetGame}
                    className="flex items-center gap-2 px-8 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-200 transition-colors"
                  >
                    <RotateCcw size={20} /> {t.playAgain}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer removed */}
    </div>
  );
}
