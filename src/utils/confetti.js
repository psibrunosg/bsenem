// src/utils/confetti.js
export class Confetti {
  constructor(options = {}) {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationId = null;
    this.colors = options.colors || ['#ff6b1a', '#f59e0b', '#16a34a', '#2563eb', '#a855f7', '#ec4899'];
    this.particleCount = options.particleCount || 100;
    this.duration = options.duration || 1500;
    this.gravity = options.gravity || 0.5;
    this.startTime = 0;
  }

  init() {
    if (this.canvas) return;
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '9999';
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }

  createParticles(x, y) {
    const centerX = x ?? window.innerWidth / 2;
    const centerY = y ?? window.innerHeight / 2;
    
    for (let i = 0; i < this.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / this.particleCount;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        size: 4 + Math.random() * 8,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        opacity: 1
      });
    }
  }

  animate(timestamp) {
    if (!this.startTime) this.startTime = timestamp;
    const elapsed = timestamp - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => {
      p.vy += this.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.opacity = 1 - progress;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    });

    this.particles = this.particles.filter(p => p.opacity > 0 && p.y < this.canvas.height + 50);

    if (progress < 1 || this.particles.length > 0) {
      this.animationId = requestAnimationFrame(this.animate.bind(this));
    } else {
      this.cleanup();
    }
  }

  burst(x, y) {
    this.init();
    this.particles = [];
    this.startTime = 0;
    this.createParticles(x, y);
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animate(0);
  }

  cleanup() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }
  }

  destroy() {
    this.cleanup();
    window.removeEventListener('resize', this.resize);
  }
}

// Singleton
export const confetti = new Confetti();

// Helper function for quick use
export function triggerConfetti(x, y) {
  confetti.burst(x, y);
}

// Test function - call from console: window.testConfetti()
if (typeof window !== 'undefined') {
  window.testConfetti = () => confetti.burst();
}