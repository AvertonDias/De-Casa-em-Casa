export const territories = [
  { id: 'T01', name: 'Centro Histórico', blocks: 12, status: 'Disponível', lastCovered: '2023-03-15', assignee: '' },
  { id: 'T02', name: 'Jardim das Flores', blocks: 8, status: 'Em andamento', lastCovered: '2023-01-20', assignee: 'Maria Souza' },
  { id: 'T03', name: 'Vila Operária', blocks: 15, status: 'Concluído', lastCovered: '2024-05-10', assignee: 'João Silva' },
  { id: 'T04', name: 'Bairro Alto', blocks: 10, status: 'Disponível', lastCovered: '2022-11-30', assignee: '' },
  { id: 'T05', name: 'Parque Industrial', blocks: 22, status: 'Em andamento', lastCovered: '2024-06-01', assignee: 'Ana Costa' },
  { id: 'T06', name: 'Residencial Sol Nascente', blocks: 7, status: 'Precisa Revisar', lastCovered: '2023-08-25', assignee: 'Pedro Martins' },
];

export const users = [
  { id: 'U01', name: 'Carlos Pereira (Você)', permission: 'Administrador', active: true },
  { id: 'U02', name: 'Maria Souza', permission: 'Publicador', active: true },
  { id: 'U03', name: 'João Silva', permission: 'Publicador', active: true },
  { id: 'U04', name: 'Ana Costa', permission: 'Publicador', active: true },
  { id: 'U05', name: 'Pedro Martins', permission: 'Publicador', active: false },
  { id: 'U06', name: 'Lúcia Ferreira', permission: 'Publicador', active: true },
];

export const recentActivity = [
  { user: 'João Silva', action: 'concluiu o território', subject: 'T03 - Vila Operária', time: '2h atrás' },
  { user: 'Ana Costa', action: 'iniciou o território', subject: 'T05 - Parque Industrial', time: '8h atrás' },
  { user: 'Maria Souza', action: 'adicionou uma anotação em', subject: 'T02, Quadra 3, Casa 15', time: '1 dia atrás' },
  { user: 'Carlos Pereira', action: 'adicionou o usuário', subject: 'Lúcia Ferreira', time: '3 dias atrás' },
  { user: 'Pedro Martins', action: 'solicitou revisão do território', subject: 'T06 - Residencial Sol Nascente', time: '5 dias atrás' },
];

export const territoryDetails = {
  id: 'T02',
  name: 'Jardim das Flores',
  blocks: [
    {
      id: 'Q01',
      name: 'Quadra 1 - Rua das Rosas',
      houses: [
        { id: 10, status: 'visitado' },
        { id: 12, status: 'nao-em-casa' },
        { id: 14, status: 'revisita' },
        { id: 16, status: 'nao-visitar' },
        { id: 18, status: 'novo' },
      ],
    },
    {
      id: 'Q02',
      name: 'Quadra 2 - Av. dos Cravos',
      houses: [
        { id: 100, status: 'visitado' },
        { id: 102, status: 'visitado' },
        { id: 104, status: 'novo' },
        { id: 106, status: 'novo' },
      ],
    },
  ],
  doNotWork: [
    { address: 'Rua das Rosas, 16', reason: 'Solicitou não ser visitado.' },
    { address: 'Av. dos Cravos, 210', reason: 'Morador trabalha em turnos.' },
  ],
};
