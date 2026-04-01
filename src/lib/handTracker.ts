import { Hands, Results } from '@mediapipe/hands';

export class HandTracker {
  private hands: Hands;
  private videoElement: HTMLVideoElement;
  private onResults: (results: Results) => void;

  constructor(videoElement: HTMLVideoElement, onResults: (results: Results) => void) {
    this.videoElement = videoElement;
    this.onResults = onResults;

    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      selfieMode: true,
    });

    this.hands.onResults((results) => {
      console.log('Hand results received:', results.multiHandLandmarks?.length || 0);
      this.onResults(results);
    });
  }

  async start() {
    console.log('Starting HandTracker...');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('navigator.mediaDevices.getUserMedia is not supported in this browser.');
      throw new Error('Camera access is not supported in this browser. Please try a different browser.');
    }

    try {
      console.log('Requesting camera stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
      });
      console.log('Camera stream obtained');
      this.videoElement.srcObject = stream;
      
      return new Promise<void>((resolve) => {
        this.videoElement.onloadedmetadata = async () => {
          console.log('Video metadata loaded');
          await this.videoElement.play();
          console.log('Video playing');
          
          const sendFrame = async () => {
            if (this.videoElement.paused || this.videoElement.ended) return;
            try {
              await this.hands.send({ image: this.videoElement });
            } catch (err) {
              console.error('Error sending frame to MediaPipe:', err);
            }
            requestAnimationFrame(sendFrame);
          };

          sendFrame();
          resolve();
        };
      });
    } catch (err) {
      console.error('Error starting camera:', err);
      throw err;
    }
  }

  stop() {
    const stream = this.videoElement.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.videoElement.pause();
  }
}
