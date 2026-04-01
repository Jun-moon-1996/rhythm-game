import { useEffect, useRef, useState } from 'react';
import { Beat } from '../lib/audio';
import { CatType, PreloadedCatImage } from '../types';
import { CAT_IMAGES } from '../constants';

interface GameCanvasProps {
  beats: Beat[];
  audioBuffer: AudioBuffer;
  duration: number;
  handY: number; // 0 to 1
  onGameOver: () => void;
  onWin: () => void;
  isPlaying: boolean;
  isPaused: boolean;
  catType: CatType;
  gameSpeed: number;
  preloadedCats: Record<CatType, PreloadedCatImage> | null;
  highScore: number;
  onNewHighScore: (score: number) => void;
  language: 'en' | 'zh';
}

export const GameCanvas = ({ beats, audioBuffer, duration, handY, onGameOver, onWin, isPlaying, isPaused, catType, gameSpeed, preloadedCats, highScore, onNewHighScore, language }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(() => {
    if (gameSpeed === 1) return 2;
    if (gameSpeed === 2) return 4;
    return 6;
  });
  const [combo, setCombo] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const comboRef = useRef(0);
  const livesRef = useRef(gameSpeed === 1 ? 2 : gameSpeed === 2 ? 4 : 6);
  const scoreRef = useRef(0);

  // Reset game stats when starting
  useEffect(() => {
    if (isPlaying) {
      setScore(0);
      scoreRef.current = 0;
      const initialLives = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 4 : 6;
      setLives(initialLives);
      livesRef.current = initialLives;
      setCombo(0);
      comboRef.current = 0;
      setShowNewRecord(false);
    }
  }, [isPlaying, gameSpeed]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  // Use a ref for handY to avoid stale closures in the animation loop
  const handYRef = useRef(handY);
  useEffect(() => {
    handYRef.current = handY;
  }, [handY]);

  // Game state
  const catPos = useRef({ x: 150, y: 300 });
  const lastBeatIndex = useRef(0);
  const catVelocity = useRef(0);
  const prevHandY = useRef(handY);
  const activeBeats = useRef<Beat[]>([]);
  const particles = useRef<{ 
    x: number, 
    y: number, 
    vx: number, 
    vy: number, 
    life: number, 
    color: string, 
    size: number,
    rotation: number,
    vRotation: number
  }[]>([]);
  const bursts = useRef<{ x: number, y: number, radius: number, maxRadius: number, life: number, color: string, isSpecial?: boolean }[]>([]);
  const shake = useRef(0);
  const catFlash = useRef(0);
  const catScale = useRef(1.0);
  const catState = useRef<'normal' | 'prep' | 'taunt'>('normal');
  const catStateTimer = useRef(0);
  const screenFlash = useRef(0);
  const comboPop = useRef(1.0);

  const catImagesRef = useRef<Record<CatType, PreloadedCatImage | null>>({
    tuxedo_cat: null,
    orange_tabby: null,
    siamese: null,
    calico: null,
  });

  useEffect(() => {
    if (preloadedCats) {
      catImagesRef.current = preloadedCats;
    }
  }, [preloadedCats]);

  useEffect(() => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === 'closed') return;
    
    if (isPaused) {
      ctx.suspend();
    } else {
      ctx.resume();
    }
  }, [isPaused]);

  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Start Audio
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    sourceRef.current = audioContextRef.current.createBufferSource();
    sourceRef.current.buffer = audioBuffer;
    sourceRef.current.connect(audioContextRef.current.destination);
    startTimeRef.current = audioContextRef.current.currentTime;
    sourceRef.current.start();
    
    if (duration > 0) {
      sourceRef.current.stop(startTimeRef.current + duration);
    }

    sourceRef.current.onended = () => {
      onWin();
    };

    const animate = () => {
      if (isPaused) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }
      const currentTime = audioContextRef.current!.currentTime - startTimeRef.current;
      
      // Update Timers
      if (catStateTimer.current > 0) {
        catStateTimer.current -= 0.016; // Approx 60fps
        if (catStateTimer.current <= 0) {
          catState.current = 'normal';
        }
      }

      if (screenFlash.current > 0) {
        screenFlash.current -= 0.05;
      }

      if (comboPop.current > 1.0) {
        comboPop.current += (1.0 - comboPop.current) * 0.1;
        if (comboPop.current < 1.01) comboPop.current = 1.0;
      }

      // Update Cat position based on handYRef
      // Ultra-snappy interpolation for minimum latency
      const targetY = 80 + handYRef.current * 470;
      const dy = targetY - catPos.current.y;
      catPos.current.y += dy * 0.98; // Increased from 0.85 to 0.98 for nearly instant follow
      
      // Calculate velocity for tilt effect
      const currentVelocity = (handYRef.current - prevHandY.current) * 20; // Increased from 18 to 20
      catVelocity.current += (currentVelocity - catVelocity.current) * 0.3; // Increased from 0.2 to 0.3 for faster response
      prevHandY.current = handYRef.current;

      // Update cat flash
      if (catFlash.current > 0) catFlash.current -= 0.05;
      
      // Update cat scale (pop effect on hit)
      if (catScale.current > 1.0) {
        catScale.current -= 0.023; // Reduced from 0.05 to extend duration by ~0.1s
        if (catScale.current < 1.0) catScale.current = 1.0;
      }

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Global Screen Shake (for background, bubbles, etc. - excluding cat head)
      ctx.save();
      if (shake.current > 0) {
        const sx = (Math.random() - 0.5) * shake.current;
        const sy = (Math.random() - 0.5) * shake.current;
        ctx.translate(sx, sy);
        // We update shake.current later in the cat drawing section or here
      }

      const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, radiusRaw: number, points: number, inset: number) => {
        const radius = Math.max(1.0, radiusRaw); // Increased minimum radius for stability
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? radius : radius * inset;
          const angle = (i * Math.PI) / points - Math.PI / 2;
          const px = x + Math.cos(angle) * r;
          const py = y + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      };

      const drawGummy = (ctx: CanvasRenderingContext2D, x: number, y: number, sizeRaw: number, color: string, life: number) => {
        const size = Math.max(1.0, sizeRaw); // Increased minimum size for stability
        ctx.save();
        ctx.translate(x, y);
        
        // Gummy body
        const grad = ctx.createRadialGradient(-size * 0.2, -size * 0.2, 0, 0, 0, size * 1.5); // Increased radius to cover offset
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.5, color.replace('1)', '0.6)'));
        grad.addColorStop(1, color.replace('1)', '0.2)'));
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        
        // Tiny highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${life * 0.9})`;
        ctx.beginPath();
        ctx.arc(-size * 0.4, -size * 0.4, Math.max(0.5, size * 0.25), 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        
        // Optional tiny blinking face
        if (size > 6 && life > 0.4) {
          ctx.strokeStyle = `rgba(0, 0, 0, ${life * 0.5})`;
          ctx.lineWidth = 1;
          // Eyes
          const blink = Math.sin(currentTime * 10) > 0.8;
          if (blink) {
            ctx.beginPath(); ctx.moveTo(-size * 0.3, -size * 0.1); ctx.lineTo(-size * 0.1, -size * 0.1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(size * 0.1, -size * 0.1); ctx.lineTo(size * 0.3, -size * 0.1); ctx.stroke();
          } else {
            ctx.beginPath(); ctx.arc(-size * 0.2, -size * 0.1, 1, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(size * 0.2, -size * 0.1, 1, 0, Math.PI * 2); ctx.stroke();
          }
          // Smile
          ctx.beginPath(); ctx.arc(0, size * 0.1, size * 0.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }
        
        ctx.restore();
      };

      // Draw Particles
      particles.current = particles.current.filter(p => p.life > 0);
      if (particles.current.length > 200) {
        particles.current = particles.current.slice(-200);
      }
      
      particles.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98; // Drag
        p.vy *= 0.98; // Drag
        p.life -= 0.025; // Faster decay for performance
        p.rotation += p.vRotation;
        
        const alpha = Math.max(0, p.life);
        ctx.globalAlpha = alpha;
        
        ctx.fillStyle = p.color;
        const radius = Math.max(0, p.size * p.life);
        const points = 5;
        const inset = 0.5;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
          const r = i % 2 === 0 ? radius : radius * inset;
          const angle = (i * Math.PI) / points - Math.PI / 2 + p.rotation;
          ctx.lineTo(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Bursts (Magical Halo)
      bursts.current = bursts.current.filter(b => b.life > 0);
      bursts.current.forEach(b => {
        // Special combo bursts linger slightly longer for better visual impact
        b.life -= b.isSpecial ? 0.05 : 0.12; 
        b.radius += (b.maxRadius - b.radius) * (b.isSpecial ? 0.1 : 0.2);
        
        const alpha = Math.max(0, b.life);
        ctx.save();
        ctx.globalAlpha = alpha;
        
        if (b.isSpecial) {
          // Rainbow Halo Effect with Macaron Colors (Low Saturation)
          const macaronColors = ['#FFB4C8', '#B4DCFF', '#DCBEFF', '#FFFFB4', '#B4FFD2'];
          ctx.lineWidth = 12; // Even thicker halo
          macaronColors.forEach((color, i) => {
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha * (1 - i * 0.15);
            ctx.beginPath();
            // Multiple rings for a "halo" look
            ctx.arc(b.x, b.y, Math.max(0.5, b.radius + i * 6), 0, Math.PI * 2);
            ctx.closePath();
            ctx.stroke();
          });
          
          // Add a soft white glow
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(b.x, b.y, Math.max(0.5, b.radius), 0, Math.PI * 2);
          ctx.closePath();
          ctx.stroke();
        } else {
          // Soft Glow Halo for normal bursts (Macaron Blue/Cyan)
          const baseColor = '180, 230, 255'; // Soft blue
          
          // Use an even wider radial gradient for maximum softness
          const innerRadius = Math.max(0, b.radius - 30);
          const outerRadius = b.radius + 30;
          const gradient = ctx.createRadialGradient(b.x, b.y, innerRadius, b.x, b.y, outerRadius);
          
          gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
          gradient.addColorStop(0.4, `rgba(${baseColor}, ${alpha * 0.15})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.5})`);
          gradient.addColorStop(0.6, `rgba(${baseColor}, ${alpha * 0.15})`);
          gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 60; // Maximum softness
          ctx.beginPath();
          ctx.arc(b.x, b.y, Math.max(0.5, b.radius), 0, Math.PI * 2);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      });

      // Handle Beats/Bubbles
      // leadTime determines how long a bubble takes to cross the screen
      const leadTime = 2.5;
      const speed = (canvas.width - catPos.current.x) / leadTime;

      // Optimized Beat Filtering: Use a sliding window
      while (lastBeatIndex.current < beats.length && beats[lastBeatIndex.current].time < currentTime - 0.5) {
        lastBeatIndex.current++;
      }

      let count = 0;
      for (let i = lastBeatIndex.current; i < beats.length && count < 8; i++) {
        const beat = beats[i];
        if (beat.hit) continue;
        
        const timeDiff = beat.time - currentTime;
        if (timeDiff > leadTime) break;
        if (timeDiff < -0.5) continue;
        
        count++;
        const x = catPos.current.x + timeDiff * speed;
        // Map amplitude (0.05-0.95) to y position (80-550) to avoid overlapping with UI
        const y = 80 + (1 - beat.amplitude) * 470;

        ctx.save();
        const pulse = Math.sin(currentTime * 10) * (1 + beat.amplitude * 3);
        const floatY = Math.sin(currentTime * 4 + beat.time) * 15; // Reduced float amplitude (25 -> 15)
        const currentY = y + floatY;
        
        // Approach scaling: grows slightly as it gets closer to the cat
        const approachScale = 1 + Math.max(0, (1 - timeDiff / leadTime)) * 0.4;
        
        // Base size 20, plus intensity factor
        const baseSize = 20 + beat.amplitude * 35;
        const currentSize = Math.max(0.5, (baseSize + pulse) * approachScale);
        
        // Draw Normal Bubble
        ctx.beginPath();
        ctx.arc(x, currentY, Math.max(1.0, currentSize), 0, Math.PI * 2);
        ctx.closePath();
        
        const bubbleGrad = ctx.createRadialGradient(
          x - currentSize * 0.2, currentY - currentSize * 0.2, 0, 
          x, currentY, Math.max(0.1, currentSize * 1.5) 
        );
        bubbleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        bubbleGrad.addColorStop(0.4, `rgba(${180 + beat.amplitude * 75}, ${220 + beat.amplitude * 35}, 255, 0.5)`);
        bubbleGrad.addColorStop(1, `rgba(${150 + beat.amplitude * 105}, ${200 + beat.amplitude * 55}, 255, 0.2)`);
        
        ctx.fillStyle = bubbleGrad;
        ctx.fill();
        
        // Soft white rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5 + beat.amplitude * 2;
        ctx.stroke();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(x - currentSize * 0.35, currentY - currentSize * 0.35, Math.max(0.5, currentSize * 0.2), 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        
        // Collision Detection
        const dist = Math.sqrt(Math.pow(x - catPos.current.x, 2) + Math.pow(currentY - catPos.current.y, 2));
        // Tightened hitbox for better rhythm accuracy (65 -> 48)
        const hitThreshold = currentSize + 48; 
        
        if (dist < hitThreshold) {
          beat.hit = true;
          
          // Scoring Logic
          const newCombo = comboRef.current + 1;
          comboRef.current = newCombo; 
          setCombo(newCombo);
          
          let points = 5;
          let isSpecialBurst = false;
          if (newCombo > 0 && newCombo % 10 === 0) {
            points += newCombo; 
            isSpecialBurst = true;
            screenFlash.current = 0.25; 
            shake.current = 15 + beat.amplitude * 20; 
            comboPop.current = 1.6; // Pop the combo counter
          } else {
            screenFlash.current = 0.12; 
            shake.current = 0; // No vibration for normal hits as requested
            comboPop.current = 1.0; // Stay stable
          }
          
          const newScore = scoreRef.current + points;
          scoreRef.current = newScore; 
          setScore(newScore);
          
          if (newScore > highScore && !showNewRecord) {
            setShowNewRecord(true);
            onNewHighScore(newScore);
          } else if (newScore > highScore) {
            onNewHighScore(newScore);
          }

          catScale.current = 1.25; 
          catFlash.current = 0.6; 
          catState.current = 'taunt';
          catStateTimer.current = 0.5;
          
          const macaronColors = [
            'rgba(255, 180, 200, 1)', 
            'rgba(180, 220, 255, 1)', 
            'rgba(220, 190, 255, 1)', 
            'rgba(255, 255, 180, 1)', 
            'rgba(180, 255, 210, 1)', 
          ];

          // Add Burst Effect (Halo)
          bursts.current.push({
            x,
            y: currentY,
            radius: currentSize,
            maxRadius: isSpecialBurst ? currentSize * 3.0 : currentSize * 1.8,
            life: 1.0,
            color: isSpecialBurst ? 'rainbow' : 'white',
            isSpecial: isSpecialBurst
          });

          // Scattered Particles (Stars only)
          const particleCount = isSpecialBurst ? 70 : 45; // Slightly increased count to maintain visual density
          for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 12 + 4) * (1 + beat.amplitude);
            
            particles.current.push({
              x, y: currentY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color: macaronColors[Math.floor(Math.random() * macaronColors.length)],
              size: Math.random() * 10 + 4, // Slightly increased max size for variety
              rotation: Math.random() * Math.PI * 2,
              vRotation: (Math.random() - 0.5) * 0.3
            });
          }
        }

        if (timeDiff < -0.15 && !beat.hit) {
          beat.hit = true; 
          setCombo(0);
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            onGameOver();
          }
        }

        ctx.restore(); 
      }

      // Draw Cat Head
      ctx.restore(); // End of global shake context
      ctx.save();
      
      // Cat Head remains stable relative to its position (no shake)
      ctx.translate(catPos.current.x, catPos.current.y);
      
      // Update shake decay here since we used it for global translation
      if (shake.current > 0) {
        shake.current *= 0.6; // Even sharper decay for a "cleaner" hit feel
        if (shake.current < 0.1) shake.current = 0;
      }
      
      // Enlarge cat by 1.1x (reduced from 1.2x)
      ctx.scale(1.1, 1.1);

      // Apply Squish (Prep)
      if (catState.current === 'taunt') {
        ctx.scale(1.1, 1.1);
      }
      
      // Tilt based on velocity (restored as requested)
      const tilt = Math.max(-0.15, Math.min(0.15, catVelocity.current * 1.2));
      ctx.rotate(tilt);

      const drawHeadPath = () => {
        ctx.beginPath();
        // Start from left ear base
        ctx.moveTo(-35, -15);
        // Left Ear (Middle ground tilt)
        ctx.quadraticCurveTo(-35, -45, -15, -25);
        // Top of head
        ctx.quadraticCurveTo(0, -30, 15, -25);
        // Right Ear (Middle ground tilt)
        ctx.quadraticCurveTo(35, -45, 35, -15);
        // Right side of face
        ctx.bezierCurveTo(55, 5, 40, 35, 0, 35);
        // Left side of face
        ctx.bezierCurveTo(-40, 35, -55, 5, -35, -15);
        ctx.closePath();
      };

      const drawCat = (type: CatType) => {
        const catData = catImagesRef.current[type];
        if (catData) {
          const { img, bounds } = catData;
          
          // Target size for the cat head itself
          const targetSize = 110 * catScale.current;
          
          // Calculate scale to make the head fit the target size
          // We use the larger dimension to ensure it fits, or just width if we want them all same width
          const scale = targetSize / Math.max(bounds.w, bounds.h);
          
          ctx.save();
          ctx.scale(scale, scale);
          
          // Draw the cropped head centered
          // We translate so the center of the head bounds is at (0,0)
          const centerX = bounds.x + bounds.w / 2;
          const centerY = bounds.y + bounds.h / 2;
          
          ctx.drawImage(
            img, 
            bounds.x, bounds.y, bounds.w, bounds.h, // Source
            -bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h // Destination
          );

          // White flash overlay
          if (catFlash.current > 0) {
            ctx.save();
            ctx.globalAlpha = catFlash.current * 0.8;
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'white';
            ctx.fillRect(-bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h);
            ctx.restore();
          }
          
          ctx.restore();
          return;
        }
        
        // Fallback to original drawing if image not loaded
        drawHeadPath();
        
        if (type === 'tuxedo_cat') {
          // 1. Base Head (White)
          ctx.fillStyle = 'white';
          ctx.fill();
          
          // 2. Symmetrical Black Patches (Inward-curving arcs, leaving nose area white)
          ctx.save();
          drawHeadPath();
          ctx.clip();
          ctx.fillStyle = 'black';
          // Left patch covering eye area
          ctx.beginPath(); ctx.arc(-45, -15, 45, 0, Math.PI * 2); ctx.fill();
          // Right patch covering eye area
          ctx.beginPath(); ctx.arc(45, -15, 45, 0, Math.PI * 2); ctx.fill();
          // Top bridge to melt the white gap at the top of the head
          ctx.beginPath(); ctx.ellipse(0, -40, 60, 35, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();

          // 3. Ears (Black with Pink Inner)
          ctx.fillStyle = 'black';
          // Left ear (Middle ground tilt)
          ctx.beginPath(); ctx.moveTo(-35, -15); ctx.quadraticCurveTo(-35, -45, -15, -25); ctx.fill();
          // Right ear (Middle ground tilt)
          ctx.beginPath(); ctx.moveTo(35, -15); ctx.quadraticCurveTo(35, -45, 15, -25); ctx.fill();
          
          // Inner ears (Light Grey-Brown)
          ctx.fillStyle = '#a19c99'; // Light grey-brown
          // Left inner (Rounded triangle)
          ctx.beginPath(); ctx.moveTo(-32, -18); ctx.quadraticCurveTo(-32, -38, -18, -24); ctx.closePath(); ctx.fill();
          // Right inner (Rounded triangle)
          ctx.beginPath(); ctx.moveTo(32, -18); ctx.quadraticCurveTo(32, -38, 18, -24); ctx.closePath(); ctx.fill();
        } else if (type === 'orange_tabby') {
          ctx.fillStyle = '#fbbf24'; // Orange
          ctx.fill();
          
          // Stripes
          ctx.save();
          drawHeadPath();
          ctx.clip();
          ctx.strokeStyle = '#d97706'; // Darker orange
          ctx.lineWidth = 4;
          // Top stripes
          ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(-10, -15); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -35); ctx.lineTo(0, -20); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(10, -30); ctx.lineTo(10, -15); ctx.stroke();
          // Side stripes
          ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-30, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-50, 10); ctx.lineTo(-30, 10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(50, 0); ctx.lineTo(30, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(50, 10); ctx.lineTo(30, 10); ctx.stroke();
          ctx.restore();
          
          // Muzzle area
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.ellipse(0, 20, 25, 15, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (type === 'siamese') {
          ctx.fillStyle = '#fef3c7'; // Cream
          ctx.fill();
          
          // Dark mask
          ctx.save();
          drawHeadPath();
          ctx.clip();
          const maskGrad = ctx.createRadialGradient(0, 10, 5, 0, 10, 45);
          maskGrad.addColorStop(0, '#321b12'); // Darker brown
          maskGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = maskGrad;
          ctx.fillRect(-60, -60, 120, 120);
          ctx.restore();
          
          // Dark ears (Full brown)
          ctx.fillStyle = '#321b12';
          // Left ear (Middle ground tilt)
          ctx.beginPath(); ctx.moveTo(-35, -15); ctx.quadraticCurveTo(-35, -45, -15, -25); ctx.fill();
          // Right ear (Middle ground tilt)
          ctx.beginPath(); ctx.moveTo(35, -15); ctx.quadraticCurveTo(35, -45, 15, -25); ctx.fill();
        } else if (type === 'calico') {
          ctx.fillStyle = 'white';
          ctx.fill();
          
          ctx.save();
          drawHeadPath();
          ctx.clip();
          // Lighter Orange patch
          ctx.fillStyle = '#fde68a'; // Lighter orange/amber
          ctx.beginPath(); ctx.arc(-35, -20, 40, 0, Math.PI * 2); ctx.fill();
          // Lighter Black (Grey) patch
          ctx.fillStyle = '#6b7280'; // Lighter black/grey
          ctx.beginPath(); ctx.arc(30, -10, 35, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        // Outline
        drawHeadPath();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 2. Eyes
        if (type === 'tuxedo_cat') {
          // Faint white outline for eyes to stand out against black fur
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(-15, 5, 3.8, 5.8, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(15, 5, 3.8, 5.8, 0, 0, Math.PI * 2); ctx.stroke();
        }

        if (catState.current === 'taunt') {
          // Star eyes for taunt
          ctx.fillStyle = '#fbbf24';
          drawStar(ctx, -15, 5, 8, 5, 0.5);
          drawStar(ctx, 15, 5, 8, 5, 0.5);
        } else if (catState.current === 'prep') {
          // Sharp eyes for prep
          ctx.fillStyle = 'black';
          ctx.beginPath(); ctx.moveTo(-22, 2); ctx.lineTo(-8, 8); ctx.lineTo(-22, 10); ctx.fill();
          ctx.beginPath(); ctx.moveTo(22, 2); ctx.lineTo(8, 8); ctx.lineTo(22, 10); ctx.fill();
        } else {
          ctx.fillStyle = 'black';
          const pupilW = type === 'tuxedo_cat' ? 2.7 : 3;
          const pupilH = type === 'tuxedo_cat' ? 4.5 : 5;
          ctx.beginPath(); ctx.ellipse(-15, 5, pupilW, pupilH, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(15, 5, pupilW, pupilH, 0, 0, Math.PI * 2); ctx.fill();
        }

        // 3. Nose
        ctx.fillStyle = '#f472b6'; // Pink
        ctx.beginPath(); ctx.ellipse(0, 12, 4, 3, 0, 0, Math.PI * 2); ctx.fill();

        // 4. Mouth
        if (catState.current === 'taunt') {
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 18, 6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        }

        // 5. Blush (Cheeks) - NO DOTS
        ctx.fillStyle = 'rgba(255, 170, 187, 0.8)';
        ctx.beginPath(); ctx.ellipse(-28, 13, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(28, 13, 8, 5.5, 0, 0, Math.PI * 2); ctx.fill();

        // 6. Whiskers
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        // Left Whiskers (Symmetrical around y=12)
        // Shorter length (15px), 1/3 on face (start at x=-38, boundary ~45)
        // Tilt (~15 degrees: tan(15) * 15px approx 4px)
        ctx.beginPath(); ctx.moveTo(-38, 8); ctx.lineTo(-53, 8 - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-38, 16); ctx.lineTo(-53, 16 + 4); ctx.stroke();
        
        // Right Whiskers (Symmetrical around y=12)
        ctx.beginPath(); ctx.moveTo(38, 8); ctx.lineTo(53, 8 - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(38, 16); ctx.lineTo(53, 16 + 4); ctx.stroke();
      };

      drawCat(catType);

      // Draw Cat Flash
      if (catFlash.current > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Reduce flash for orange_tabby to avoid overexposure
        const flashIntensity = catType === 'orange_tabby' ? 0.25 : 0.4;
        ctx.globalAlpha = catFlash.current * flashIntensity;
        
        const catData = catImagesRef.current[catType];
        if (catData) {
          const { img, bounds } = catData;
          const targetSize = 110 * catScale.current;
          const scale = targetSize / Math.max(bounds.w, bounds.h);
          ctx.scale(scale, scale);
          ctx.drawImage(
            img, 
            bounds.x, bounds.y, bounds.w, bounds.h,
            -bounds.w / 2, -bounds.h / 2, bounds.w, bounds.h
          );
        } else {
          ctx.fillStyle = 'white';
          drawHeadPath();
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.restore();

      // Reset translation from shake
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Draw UI: Score & Life Bar (Top Right, shifted left to avoid pause button)
      const uiY = 16; // Aligned with top-4 (16px)
      const uiHeight = 36; // Aligned with py-2 + text-sm (36px)
      const barWidth = 280;
      
      ctx.save();
      // Removed expensive shadowBlur for performance
      
      // 1. Score Box
      const scoreText = `${language === 'en' ? 'SCORE' : '分数'}: ${scoreRef.current}`;
      ctx.font = 'bold 20px "Arial", sans-serif'; 
      const scoreTextWidth = ctx.measureText(scoreText).width;
      const scoreBoxWidth = scoreTextWidth + 40;
      
      // Calculate total width to align from right
      const totalUIWidth = scoreBoxWidth + 12 + barWidth;
      const uiX = canvas.width - totalUIWidth - 100; 
      
      // Glass background for score
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; 
      ctx.beginPath();
      ctx.roundRect(uiX, uiY, scoreBoxWidth, uiHeight, 18);
      ctx.fill();
      
      // Soft white border
      ctx.strokeStyle = 'rgba(219, 234, 254, 0.8)'; 
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.fillStyle = '#B4DCFF'; // Macaron Blue matching the theme
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle'; 
      ctx.fillText(scoreText, uiX + scoreBoxWidth / 2, uiY + uiHeight / 2 + 2); 
      ctx.textBaseline = 'alphabetic'; 
      
      // 2. Life Bar (Next to Score)
      const barX = uiX + scoreBoxWidth + 12;
      
      // Glass background for life bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(barX, uiY, barWidth, uiHeight, 18);
      ctx.fill();
      
      // Soft white border
      ctx.strokeStyle = 'rgba(219, 234, 254, 0.8)'; 
      ctx.lineWidth = 3;
      ctx.stroke();
      
      const maxLives = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 4 : 6;
      const fillPercent = Math.max(0, livesRef.current / maxLives);
      const fillWidth = fillPercent * (barWidth - 10);
      
      if (fillWidth > 0) {
        // Gradient matching the image: Sakura Pink to Light Blue (Low Saturation)
        const barGrad = ctx.createLinearGradient(barX + 5, 0, barX + 5 + fillWidth, 0);
        barGrad.addColorStop(0, '#FFF1F2'); // Very Pale Sakura Pink
        barGrad.addColorStop(0.5, '#fff0f5'); // Lavender Blush (Very light pink)
        barGrad.addColorStop(1, '#e0f7fa'); // Light Cyan (Very light blue)
        
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(barX + 5, uiY + 5, fillWidth, uiHeight - 10, 13);
        ctx.fill();
      }
      
      ctx.restore();

      // Draw Combo (Below Score/LifeBar on the right)
      if (comboRef.current > 1) {
        ctx.save();
        ctx.fillStyle = '#F5F3FF'; // Very Light Purple
        const fontSize = Math.floor(32 * comboPop.current);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(`${comboRef.current} COMBO!`, canvas.width - 100, uiY + uiHeight + 45);
        ctx.restore();
      }

      // New Record Notification
      if (showNewRecord) {
        ctx.save();
        ctx.fillStyle = '#F5F3FF'; // Very Light Purple
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(251, 191, 36, 0.5)';
        const bounce = Math.sin(currentTime * 5) * 10;
        ctx.fillText(language === 'en' ? 'NEW RECORD!' : '新纪录！', canvas.width / 2, 80 + bounce);
        ctx.restore();
      }

      // Final Screen Flash Overlay (Softer)
      if (screenFlash.current > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${screenFlash.current * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      if (sourceRef.current) sourceRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isPlaying, beats, audioBuffer]);

  return (
    <canvas
      ref={canvasRef}
      width={1066}
      height={600}
      className="w-full h-full rounded-xl"
    />
  );
};
