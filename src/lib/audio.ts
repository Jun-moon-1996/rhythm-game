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
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const totalDuration = maxDuration ? Math.min(audioBuffer.duration, maxDuration) : audioBuffer.duration;

  const beats: Beat[] = [];
  
  // BPM settings
  const bpm = 102.5;
  const beatInterval = 60 / bpm;
  
  // Start after 10 seconds intro
  const startTime = 10;
  
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
    
    // Base wave for movement
    const wave = Math.sin(time * 0.8) * 0.3;
    
    // Calculate new amplitude
    let newAmp = 0.5 + wave + (intensity - 0.5) * 0.7;
    newAmp = Math.min(0.95, Math.max(0.05, newAmp));

    // Avoid 3+ consecutive same heights (within 0.1 range)
    if (Math.abs(newAmp - lastAmplitude) < 0.1) {
      consecutiveSameHeight++;
      if (consecutiveSameHeight >= 3) {
        // Force a jump
        newAmp = newAmp > 0.5 ? newAmp - 0.4 : newAmp + 0.4;
        consecutiveSameHeight = 0;
      }
    } else {
      consecutiveSameHeight = 0;
    }
    
    lastAmplitude = newAmp;
    return newAmp;
  };

  // Iterate through measures (8th note precision to allow for 3-beat patterns)
  const checkInterval = beatInterval / 2;
  for (let t = startTime; t < totalDuration - 2; t += checkInterval) {
    const beatIndex = Math.round((t - startTime) / checkInterval);
    const indexInMeasure = beatIndex % 8; // 0-7 (8th notes)
    
    const rawAmp = getAmplitudeAt(t);
    let shouldAddBeat = false;

    // We only add bubbles on quarter notes (even indices: 0, 2, 4, 6) 
    // to ensure they appear "one by one" with a clear gap.
    if (indexInMeasure % 2 === 0) {
      const quarterBeatIndex = indexInMeasure / 2; // 0, 1, 2, 3

      if (density === 4) {
        // Level 4: 4 bubbles per measure (every beat)
        shouldAddBeat = true;
      } else if (density === 3) {
        // Level 3: 3 bubbles per measure (beats 1, 2, 3)
        if (quarterBeatIndex === 0 || quarterBeatIndex === 1 || quarterBeatIndex === 2) {
          shouldAddBeat = true;
        }
      } else if (density === 2) {
        // Level 2: 2 bubbles per measure (beats 1, 3)
        if (quarterBeatIndex === 0 || quarterBeatIndex === 2) {
          shouldAddBeat = true;
        }
      } else if (density === 1) {
        // Level 1: 1 bubble per measure (beat 1)
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
}
