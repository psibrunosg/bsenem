// src/services/SimulatorApiService.js
const GENERIC_ERROR = 'Não foi possível atualizar os simulados.';

export class SimulatorApiService {
  constructor(apiClient) {
    this.api = apiClient;
  }

  catalog() {
    return this.unwrap(this.api.get('/simulators/catalog'));
  }

  overview() {
    return this.unwrap(this.api.get('/simulators/overview'));
  }

  activeSessions() {
    return this.unwrap(this.api.get('/simulators/sessions?status=active'));
  }

  createSession(payload) {
    return this.unwrap(this.api.post('/simulators/sessions', payload));
  }

  session(id) {
    return this.unwrap(this.api.get(`/simulators/sessions/${id}`));
  }

  saveProgress(id, payload, requestOptions) {
    const url = `/simulators/sessions/${id}/progress`;
    return this.unwrap(requestOptions ? this.api.patch(url, payload, requestOptions) : this.api.patch(url, payload));
  }

  complete(id) {
    return this.unwrap(this.api.post(`/simulators/sessions/${id}/complete`));
  }

  async unwrap(requestPromise) {
    const response = await requestPromise;
    if (!response?.success) {
      throw new Error(response?.message || GENERIC_ERROR);
    }
    return response.data;
  }
}
