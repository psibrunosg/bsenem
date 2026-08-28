export class XPAnimation {
    constructor(container, amount, startXP) {
        this.container = container;
        this.amount = amount;
        this.startXP = startXP;
    }
    
    render() {
        const el = document.createElement('div');
        el.className = 'xp-animation';
        el.innerHTML = 
            <div class="xp-circle">
                <span class="xp-plus">+</span>
                <span class="xp-amount">\</span>
                <span class="xp-label">XP</span>
            </div>
        ;
        
        this.container.appendChild(el);
        
        // Simple animation
        setTimeout(() => {
            el.classList.add('animate-up');
        }, 100);
        
        return el;
    }
}
