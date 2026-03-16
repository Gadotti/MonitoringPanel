/**
 * jest.setup.js
 * 
 * Arquivo de setup global do Jest.
 * Adicione aqui configurações que devem ser executadas antes de todos os testes,
 * como mocks globais, variáveis de ambiente de teste, etc.
 */

// Garante que testes não poluam o console com logs do servidor
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});
