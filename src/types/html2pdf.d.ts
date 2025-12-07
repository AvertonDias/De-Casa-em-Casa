// Adiciona uma declaração de módulo para a biblioteca html2pdf.js,
// que não possui tipos TypeScript nativos. Isso informa ao TypeScript
// para tratar a biblioteca como do tipo 'any', removendo erros de compilação.
declare module 'html2pdf.js';
