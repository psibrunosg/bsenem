// jsdom não implementa a Object URL API. Sem esses stubs, qualquer
// vi.spyOn(URL, 'createObjectURL') falha com "createObjectURL does not exist".
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:stub';
}

if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
