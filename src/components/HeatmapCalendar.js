// src/components/HeatmapCalendar.js
export class HeatmapCalendar {
  constructor(options = {}) {
    this.data = options.data ?? {};
    this.startDate = options.startDate ?? this.getDefaultStartDate();
    this.endDate = options.endDate ?? new Date();
    this.intensityLevels = options.intensityLevels ?? [0, 1, 2, 3, 4];
    this.dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    this.monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    this.onDayClick = options.onDayClick ?? (() => {});
    
    this.element = null;
  }

  getDefaultStartDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date;
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'heatmap-calendar';
    
    const weeks = this.generateWeeks();
    const totalDays = weeks.reduce((sum, week) => sum + week.filter(d => d.date).length, 0);
    const totalValue = Object.values(this.data).reduce((sum, val) => sum + val, 0);

    this.element.innerHTML = `
      <div class="heatmap-header">
        <div class="heatmap-stats">
          <span class="heatmap-stat">${totalDays} dias de atividade</span>
          <span class="heatmap-stat">${totalValue} pontos totais</span>
        </div>
        <div class="heatmap-legend">
          <span class="heatmap-legend-label">Menos</span>
          ${this.intensityLevels.map(level => `
            <div class="heatmap-legend-cell" data-level="${level}"></div>
          `).join('')}
          <span class="heatmap-legend-label">Mais</span>
        </div>
      </div>
      
      <div class="heatmap-container">
        <div class="heatmap-months">
          ${this.renderMonthLabels(weeks)}
        </div>
        <div class="heatmap-grid">
          <div class="heatmap-day-labels">
            ${this.dayLabels.map((label, i) => `
              <span class="heatmap-day-label" style="visibility: ${i % 2 === 1 ? 'visible' : 'hidden'}">${label}</span>
            `).join('')}
          </div>
          <div class="heatmap-cells">
            ${weeks.map(week => `
              <div class="heatmap-week">
                ${week.map(day => this.renderDayCell(day)).join('')}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    return this.element;
  }

  generateWeeks() {
    const weeks = [];
    let currentDate = new Date(this.startDate);
    
    // Start from the previous Sunday
    currentDate.setDate(currentDate.getDate() - currentDate.getDay());
    
    while (currentDate <= this.endDate) {
      const week = [];
      
      for (let i = 0; i < 7; i++) {
        const dateStr = this.formatDate(currentDate);
        const value = this.data[dateStr] || 0;
        const isInRange = currentDate >= this.startDate && currentDate <= this.endDate;
        const isToday = this.isToday(currentDate);
        
        week.push({
          date: isInRange ? new Date(currentDate) : null,
          dateStr,
          value,
          level: this.getLevel(value),
          isToday
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeks.push(week);
    }
    
    return weeks;
  }

  renderDayCell(day) {
    if (!day.date) {
      return '<div class="heatmap-cell empty"></div>';
    }

    const dateFormatted = day.date.toLocaleDateString('pt-BR');
    const tooltip = `${dateFormatted}: ${day.value} pontos`;

    return `
      <div class="heatmap-cell level-${day.level} ${day.isToday ? 'today' : ''}" 
           data-date="${day.dateStr}" 
           data-value="${day.value}"
           title="${tooltip}">
      </div>
    `;
  }

  renderMonthLabels(weeks) {
    const months = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIndex) => {
      const firstDay = week.find(d => d.date);
      if (firstDay) {
        const month = firstDay.date.getMonth();
        if (month !== lastMonth) {
          months.push({
            label: this.monthLabels[month],
            position: weekIndex
          });
          lastMonth = month;
        }
      }
    });

    return months.map(month => `
      <span class="heatmap-month" style="left: ${month.position * 14}px">${month.label}</span>
    `).join('');
  }

  getLevel(value) {
    if (value === 0) return 0;
    if (value <= 2) return 1;
    if (value <= 5) return 2;
    if (value <= 10) return 3;
    return 4;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const cell = e.target.closest('.heatmap-cell[data-date]');
      if (cell) {
        this.onDayClick(cell.dataset.date, parseInt(cell.dataset.value));
      }
    });
  }

  updateData(data) {
    this.data = data;
    const newElement = this.render();
    this.element.replaceWith(newElement);
    this.element = newElement;
  }

  destroy() {
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}
