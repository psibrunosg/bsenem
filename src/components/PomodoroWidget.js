export class PomodoroWidget {
  constructor(options = {}) {
    this.onComplete = options.onComplete || (() => {});
    this.element = null;
    this.timeLeft = 25 * 60; // 25 minutes
    this.isRunning = false;
    this.timer = null;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'pomodoro-widget';
    this.element.style.cssText = 
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-full);
      font-family: var(--font-mono);
      font-weight: 600;
      color: var(--orange-600);
      cursor: pointer;
      user-select: none;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s;
    ;

    this.element.innerHTML = 
      <i data-lucide="timer" class="w-4 h-4"></i>
      <span class="time-display">25:00</span>
      <i data-lucide="play" class="w-4 h-4 play-icon"></i>
    ;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
    return this.element;
  }

  bindEvents() {
    this.element.addEventListener('click', () => this.toggle());
  }

  toggle() {
    this.isRunning = !this.isRunning;
    const playIcon = this.element.querySelector('.play-icon');
    
    if (this.isRunning) {
      playIcon.setAttribute('data-lucide', 'pause');
      this.element.style.background = 'var(--orange-50)';
      this.timer = setInterval(() => this.tick(), 1000);
    } else {
      playIcon.setAttribute('data-lucide', 'play');
      this.element.style.background = 'var(--bg-card)';
      clearInterval(this.timer);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);
  }

  tick() {
    this.timeLeft--;
    if (this.timeLeft <= 0) {
      this.toggle(); // stop
      this.timeLeft = 25 * 60; // reset
      this.onComplete(); // Award XP and save!
    }
    this.updateDisplay();
  }

  updateDisplay() {
    const mins = Math.floor(this.timeLeft / 60).toString().padStart(2, '0');
    const secs = (this.timeLeft % 60).toString().padStart(2, '0');
    this.element.querySelector('.time-display').textContent = \:\;
  }
}
