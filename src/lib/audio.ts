/**
 * Audio analysis utility for rhythm game
 */

export interface Beat {
  time: number;
  amplitude: number;
  hit: boolean;
  id: string;
  type: 'normal';
}

export async function analyzeAudio(url: string, density: number = 4, maxDuration?: number): Promise<{ beats: Beat[], duration: number, audioBuffer: AudioBuffer }> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  console.log('Fetching audio from:', url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type');
  console.log('Audio content type:', contentType);
  if (contentType && !contentType.includes('audio') && !contentType.includes('application/octet-stream')) {
    console.warn('Unexpected content type for audio:', contentType);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  console.log('Audio data received, size:', arrayBuffer.byteLength, 'bytes');
  
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Audio data is empty (0 bytes)');
  }

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('Audio decoded successfully. Duration:', audioBuffer.duration, 's');
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const totalDuration = maxDuration ? Math.min(audioBuffer.duration, maxDuration) : audioBuffer.duration;

    const beats: Beat[] = [];
    
    // BPM settings
    const bpm = 102.5;
    const beatInterval = 60 / bpm;
    
    // Start after 10 seconds intro - adjusted slightly for better alignment
    const startTime = 10.05;
    
    let lastAmplitude = 0.5;
    let consecutiveSameHeight = 0;

    const getAmplitudeAt = (time: number, windowSize: number = 0.1) => {
      const startIdx = Math.floor(time * sampleRate);
      const endIdx = Math.floor((time + windowSize) * sampleRate);
      let max = 0;
      for (let i = startIdx; i < endIdx && i < channelData.length; i++) {
        const amp = Math.abs(channelData[i]);
        if (amp > max) max = amp;
      }
      return max;
    };

    const getVariedAmplitude = (rawAmp: number, time: number) => {
      // Normalize raw amplitude (0.1 to 0.8 range)
      let intensity = Math.min(1, rawAmp / 0.8);
      
      // Combine multiple waves for a more natural, less repetitive height curve
      const wave1 = Math.sin(time * 0.8) * 0.2;
      const wave2 = Math.sin(time * 1.5) * 0.15;
      const wave3 = Math.sin(time * 3.1) * 0.1;
      const combinedWave = wave1 + wave2 + wave3;
      
      // Calculate base amplitude
      let newAmp = 0.5 + combinedWave + (intensity - 0.5) * 0.35;
      
      // Add subtle jitter
      const jitter = (Math.sin(time * 17) * 0.04);
      newAmp += jitter;
      
      // Expand to a larger overall range (matching other modes)
      newAmp = Math.min(0.95, Math.max(0.05, newAmp));

      // ANTI-STAGNATION: Prevent 3+ bubbles at similar heights
      if (Math.abs(newAmp - lastAmplitude) < 0.12) {
        consecutiveSameHeight++;
        if (consecutiveSameHeight >= 2) {
          // Force a jump of at least 0.25
          newAmp += (newAmp > 0.5 ? -0.25 : 0.25);
          consecutiveSameHeight = 0;
        }
      } else {
        consecutiveSameHeight = 0;
      }

      // SMOOTHING: Limit the difference between adjacent bubbles
      // This prevents "one very high, one very low" jumps
      const maxDiff = 0.35; 
      const diff = newAmp - lastAmplitude;
      
      if (Math.abs(diff) > maxDiff) {
        // If the jump is too large, cap it
        newAmp = lastAmplitude + (diff > 0 ? maxDiff : -maxDiff);
      }
      
      // Final bounds check for the expanded range
      newAmp = Math.min(0.95, Math.max(0.05, newAmp));
      
      lastAmplitude = newAmp;
      return newAmp;
    };

    // Iterate through measures (8th note precision)
    const checkInterval = beatInterval / 2;
    
    // Calculate average amplitude for thresholding
    let sumAmp = 0;
    let countAmp = 0;
    for (let t = startTime; t < totalDuration; t += 0.5) {
      sumAmp += getAmplitudeAt(t);
      countAmp++;
    }
    const avgAmp = sumAmp / countAmp;
    const threshold = avgAmp * 0.85;

    for (let t = startTime; t < totalDuration - 2; t += checkInterval) {
      const beatIndex = Math.round((t - startTime) / checkInterval);
      const indexInMeasure = beatIndex % 8; // 0-7 (8th notes)
      
      const rawAmp = getAmplitudeAt(t);
      let shouldAddBeat = false;

      // Strictly follow the beat: only add on quarter notes (0, 2, 4, 6)
      if (indexInMeasure % 2 === 0) {
        const quarterBeatIndex = indexInMeasure / 2; // 0, 1, 2, 3

        if (density === 4) {
          // Hard: Every quarter note must have a bubble for consistent rhythm
          shouldAddBeat = true;
        } else if (density === 3 || density === 2) {
          // Normal/Normal+: 2-3 bubbles per measure
          if (quarterBeatIndex === 0 || quarterBeatIndex === 2) {
            shouldAddBeat = true;
          } else if (density === 3 && quarterBeatIndex === 1 && rawAmp > threshold) {
            shouldAddBeat = true;
          }
        } else if (density === 1) {
          // Easy: 1 bubble per measure (beat 1)
          if (quarterBeatIndex === 0) {
            shouldAddBeat = true;
          }
        }
      }

      if (shouldAddBeat) {
        beats.push({
          time: t,
          amplitude: getVariedAmplitude(rawAmp, t),
          hit: false,
          id: `beat-${t}`,
          type: 'normal'
        });
      }
    }

    return { beats, duration: totalDuration, audioBuffer };
  } catch (decodeError) {
    console.error('Audio decoding failed:', decodeError);
    throw new Error(`Unable to decode audio data: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`);
  }
}
