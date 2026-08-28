// src/pages/GraphPage.js
import { api } from '@utils/api.js';

export class GraphPage {
  constructor(options = {}) {
    this.app = options.app;
    this.element = null;
    this.network = null;
    this.nodes = [];
    this.edges = [];
  }

  async render() {
    this.element = document.createElement('div');
    this.element.className = 'graph-page fade-in';
    
    this.element.innerHTML = `
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h1>Mapa de Conhecimento</h1>
          <p>Visualize suas conexões de aprendizado e receba trilhas sugeridas para manter o foco.</p>
        </div>
        <button class="btn btn-primary" data-action="generate-trail">
          <i data-lucide="compass" class="w-5 h-5"></i>
          Sugerir Trilha
        </button>
      </div>

      <div class="graph-layout" style="display: flex; flex-wrap: wrap; gap: 24px; height: calc(100vh - 160px); margin-top: 24px;">
        <!-- Grafo interativo -->
        <div class="graph-container card" style="flex: 1; position: relative; background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-light);">
          <div id="vis-network-container" style="width: 100%; height: 100%;"></div>
          
          <div class="graph-controls" style="position: absolute; bottom: 16px; right: 16px; display: flex; gap: 8px; z-index: 10;">
            <button class="btn btn-icon" data-action="zoom-in" style="background: var(--bg-card); border: 1px solid var(--border-light);"><i data-lucide="zoom-in"></i></button>
            <button class="btn btn-icon" data-action="zoom-out" style="background: var(--bg-card); border: 1px solid var(--border-light);"><i data-lucide="zoom-out"></i></button>
            <button class="btn btn-icon" data-action="fit" style="background: var(--bg-card); border: 1px solid var(--border-light);"><i data-lucide="maximize"></i></button>
          </div>
        </div>

        <!-- Painel Lateral: Trilha Sugerida -->
        <div class="trail-sidebar card" style="flex: 1; min-width: 300px; max-width: 400px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-light); display: flex; flex-direction: column;">
          <div style="padding: 16px; border-bottom: 1px solid var(--border-light);">
            <h3 style="display: flex; align-items: center; gap: 8px;"><i data-lucide="map" class="w-5 h-5 text-primary"></i> Trilha Ativa</h3>
            <p class="text-secondary" style="font-size: 13px; margin-top: 4px;">O sistema sugere estes passos com base nas suas últimas anotações e cartões atrasados.</p>
          </div>
          <div class="trail-content" style="padding: 16px; flex: 1; overflow-y: auto;">
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
              <div style="text-align: center;">
                <i data-lucide="activity" class="w-8 h-8" style="margin: 0 auto 8px; opacity: 0.5;"></i>
                <p>Clique em "Sugerir Trilha" para gerar seu caminho de estudos.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    if (typeof lucide !== 'undefined') lucide.createIcons(this.element);

    // Initialize network next tick to ensure container is in DOM
    setTimeout(() => this.initGraph(), 100);

    return this.element;
  }

  bindEvents() {
    this.element.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;

      if (action === 'generate-trail') {
        this.generateTrail();
      } else if (action === 'zoom-in' && this.network) {
        this.network.moveTo({ scale: this.network.getScale() * 1.5 });
      } else if (action === 'zoom-out' && this.network) {
        this.network.moveTo({ scale: this.network.getScale() / 1.5 });
      } else if (action === 'fit' && this.network) {
        this.network.fit({ animation: true });
      }
    });
  }

  async initGraph() {
    const container = this.element.querySelector('#vis-network-container');
    if (!container || !window.vis) return;

    this.nodes = new vis.DataSet([
      { id: 1, label: 'Fisiologia do Exercício', group: 'subject', value: 30 },
      { id: 2, label: 'Educação Física', group: 'subject', value: 20 },
      { id: 3, label: 'UNIFATECIE', group: 'institution', value: 15 },
      { id: 4, label: 'Biologia', group: 'subject', value: 25 },
      { id: 5, label: 'Sistema Nervoso', group: 'topic', value: 10 },
      { id: 6, label: 'Contração Muscular', group: 'topic', value: 15 },
      { id: 7, label: 'Anotação: Potencial de Ação', group: 'note', value: 8 },
      { id: 8, label: 'Video: Fibras Musculares', group: 'video', value: 12 },
      { id: 9, label: 'Flashcard: Sarcômero', group: 'flashcard', value: 5 },
      { id: 10, label: 'ENEM / Vestibular', group: 'exam', value: 25 }
    ]);

    this.edges = new vis.DataSet([
      { from: 1, to: 2, title: 'ramo de' },
      { from: 1, to: 4, title: 'base biológica' },
      { from: 2, to: 3, title: 'estudado em' },
      { from: 4, to: 5, title: 'inclui' },
      { from: 1, to: 6, title: 'foco principal' },
      { from: 5, to: 7, title: 'anotação feita' },
      { from: 6, to: 8, title: 'visto no vídeo' },
      { from: 6, to: 9, title: 'revisão' },
      { from: 4, to: 10, title: 'cobrado no' }
    ]);

    const data = { nodes: this.nodes, edges: this.edges };
    
    const options = {
      nodes: {
        shape: 'dot',
        font: { color: '#a0a0a0', face: 'system-ui', size: 14 },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 2,
        color: { color: 'rgba(150,150,150,0.3)', highlight: '#ff6b1a' },
        smooth: { type: 'continuous' }
      },
      groups: {
        subject: { color: { background: '#3b82f6', border: '#2563eb' } },
        topic: { color: { background: '#10b981', border: '#059669' } },
        note: { color: { background: '#f59e0b', border: '#d97706' }, shape: 'box' },
        video: { color: { background: '#ef4444', border: '#dc2626' } }, 
        flashcard: { color: { background: '#8b5cf6', border: '#7c3aed' }, shape: 'box' },
        institution: { color: { background: '#64748b', border: '#475569' } },
        exam: { color: { background: '#ec4899', border: '#db2777' } }
      },
      physics: {
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springLength: 100,
          springConstant: 0.08
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200
      }
    };

    this.network = new vis.Network(container, data, options);
    
    this.network.on('click', (params) => {
      if (params.nodes.length > 0) {
        this.highlightNode(params.nodes[0]);
      } else {
        this.resetHighlight();
      }
    });
  }

  highlightNode(nodeId) {
    const allNodes = this.nodes.get({ returnType: "Object" });
    const allEdges = this.edges.get({ returnType: "Object" });
    
    for (let node in allNodes) {
      allNodes[node].color = undefined;
      allNodes[node].hidden = false;
    }
    for (let edge in allEdges) {
      allEdges[edge].color = undefined;
      allEdges[edge].hidden = false;
    }

    const connectedNodes = this.network.getConnectedNodes(nodeId);
    const connectedEdges = this.network.getConnectedEdges(nodeId);

    const updateNodes = [];
    for (let node in allNodes) {
      if (node != nodeId && !connectedNodes.includes(parseInt(node)) && !connectedNodes.includes(node)) {
        updateNodes.push({ id: node, color: 'rgba(200,200,200,0.1)' });
      }
    }
    this.nodes.update(updateNodes);

    const updateEdges = [];
    for (let edge in allEdges) {
      if (!connectedEdges.includes(edge)) {
        updateEdges.push({ id: edge, color: 'rgba(200,200,200,0.05)' });
      }
    }
    this.edges.update(updateEdges);
  }

  resetHighlight() {
    const allNodes = this.nodes.get();
    const updateNodes = allNodes.map(n => ({ id: n.id, color: undefined, hidden: false }));
    this.nodes.update(updateNodes);

    const allEdges = this.edges.get();
    const updateEdges = allEdges.map(e => ({ id: e.id, color: undefined, hidden: false }));
    this.edges.update(updateEdges);
  }

  generateTrail() {
    const content = this.element.querySelector('.trail-content');
    
    content.innerHTML = `
      <div class="trail-steps" style="display: flex; flex-direction: column; gap: 16px; position: relative;">
        <!-- Connecting line -->
        <div style="position: absolute; top: 24px; bottom: 24px; left: 19px; width: 2px; background: var(--border-light); z-index: 0;"></div>
        
        <!-- Step 1 -->
        <div class="trail-step animate-slide-up" style="position: relative; z-index: 1; display: flex; gap: 12px; animation-delay: 0.1s;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--orange-500); color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 0 4px var(--bg-card);">
            <i data-lucide="play" class="w-5 h-5"></i>
          </div>
          <div style="background: var(--bg-primary); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-md); flex: 1; cursor: pointer;" onclick="window.location.hash='#video'">
            <div style="font-size: 12px; font-weight: 600; color: var(--orange-500); text-transform: uppercase; margin-bottom: 4px;">Comece Aqui (15min)</div>
            <strong style="display: block; margin-bottom: 4px; font-size: 14px;">Vídeo: Fibras Musculares</strong>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Você pausou aos 10:24. Vamos terminar?</p>
            <button class="btn btn-primary" style="width: 100%; padding: 6px;">Retomar Aula</button>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="trail-step animate-slide-up" style="position: relative; z-index: 1; display: flex; gap: 12px; animation-delay: 0.2s;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #8b5cf6; color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 0 4px var(--bg-card);">
            <i data-lucide="layers" class="w-5 h-5"></i>
          </div>
          <div style="background: var(--bg-primary); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-md); flex: 1; cursor: pointer;" onclick="window.location.hash='#flashcards'">
            <div style="font-size: 12px; font-weight: 600; color: #8b5cf6; text-transform: uppercase; margin-bottom: 4px;">Revisão Rápida (5min)</div>
            <strong style="display: block; margin-bottom: 4px; font-size: 14px;">Flashcards: Contração</strong>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">2 cartões sobre Actina e Miosina estão na fila para não esquecer.</p>
            <button class="btn btn-outline" style="width: 100%; padding: 6px; border-color: #8b5cf6; color: #8b5cf6;">Revisar</button>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="trail-step animate-slide-up" style="position: relative; z-index: 1; display: flex; gap: 12px; animation-delay: 0.3s;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #f59e0b; color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 0 4px var(--bg-card);">
            <i data-lucide="edit-3" class="w-5 h-5"></i>
          </div>
          <div style="background: var(--bg-primary); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-md); flex: 1; cursor: pointer;" onclick="window.location.hash='#notes'">
            <div style="font-size: 12px; font-weight: 600; color: #f59e0b; text-transform: uppercase; margin-bottom: 4px;">Conexão (10min)</div>
            <strong style="display: block; margin-bottom: 4px; font-size: 14px;">Elaborar Anotação</strong>
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Revise seus 3 cortes sobre o Sistema Nervoso. Tente escrever um resumo usando a Técnica de Feynman.</p>
            <button class="btn btn-outline" style="width: 100%; padding: 6px; border-color: #f59e0b; color: #f59e0b;">Criar Resumo</button>
          </div>
        </div>
        
        <div class="trail-step animate-slide-up" style="text-align: center; margin-top: 8px; animation-delay: 0.4s;">
          <span style="font-size: 13px; color: var(--text-secondary);">Completar a trilha rende <b>+150 XP</b>! 🔥</span>
        </div>
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons(content);
    
    if (this.network) {
      const trailNodes = [8, 9, 7];
      this.network.selectNodes(trailNodes);
    }
  }

  destroy() {
    if (this.network) {
      this.network.destroy();
    }
    if (this.element?.parentNode) this.element.parentNode.removeChild(this.element);
  }
}



