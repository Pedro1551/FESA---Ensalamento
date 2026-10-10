# Changelog

## [0.3.0] - 2026-10-09

### Adicionado
- Cadastro manual de novas aulas na turma selecionada.
- Edição de disciplina, professor, sala/laboratório, dia, horário inicial e duração.
- Cancelamento lógico de aulas, preservando a grade-base importada.
- Histórico local das alterações realizadas durante a sessão.
- Desfazer para criação, edição, cancelamento e movimentação de aulas.
- Estado visual específico para aulas adicionadas manualmente.

### Melhorado
- A grade efetiva agora é calculada sobre a grade-base do Excel, permitindo alterações sem perder a referência original.
- Cards se redimensionam automaticamente de acordo com o início e fim escolhidos.
- Visões diária, semanal e impressão passam a refletir novas aulas, edições e cancelamentos automaticamente.
- Restauração da turma remove aulas manuais e recupera disciplina, professor, horário e duração originais.
- Validação de conflito da turma e de professor também é aplicada ao cadastro e à edição manual.

### Observação
- Nesta versão as alterações ainda vivem somente na sessão do navegador; persistência em banco será implementada posteriormente.

## [0.2.7] - 2026-10-09

### Melhorado
- Aumentada a tipografia da visualização de impressão/PDF.
- Disciplinas, professores, horários, dias e títulos das turmas ganharam maior legibilidade sem alterar o layout aprovado.

## [0.2.6] - 2026-10-09

### Melhorado
- Reformulado o layout de impressão para ficar visualmente mais próximo da grade exibida na página.
- Removido o aspecto de planilha/Excel no relatório impresso, com células mais suaves e cartões arredondados.
- Cartões de aula alinhados ao mesmo padrão visual do ensalamento exibido no navegador.

## [0.2.5] - 2026-10-09

### Corrigido
- Corrigida a impressão de aulas que ocupam dois ou mais horários.
- Substituído o uso de `rowspan` por CSS Grid na visualização de impressão, evitando deslocamento dos cards entre 11ª/12ª e 13ª/14ª aulas.
- Mantida a mesma composição visual e as cores por professor na impressão.

## [0.2.4] - 2026-10-09

### Alterado
- Substituída a geração programática com jsPDF pelo sistema nativo de impressão do navegador.
- `Imprimir semana / PDF` abre uma visualização dedicada para impressão contendo todas as turmas do curso.
- `Imprimir turma / PDF` gera a visualização de impressão somente da turma selecionada.
- O usuário pode selecionar `Salvar como PDF` no Chrome/Edge para gerar o arquivo.
- Layout de impressão em A4 paisagem com quebra controlada de páginas e duas turmas por página quando a quantidade de horários permite.
- O relatório impresso passa a usar HTML/CSS, mantendo maior consistência com a interface do sistema.
- Cores de professor e destaque amarelo de aulas alteradas permanecem no relatório.

### Removido
- Dependência `jspdf`.

## [0.2.3] - 2026-10-09

### Corrigido
- Refinamento do layout do PDF semanal.
- Numeração das aulas de acordo com o turno.

## [0.2.2] - 2026-10-09

### Melhorado
- Padronização visual de todas as grades com o mesmo sistema de cartões em tons pastéis usado na grade editável.
- Cores consistentes por professor nas diferentes visualizações.

## [0.2.1] - 2026-10-09

### Adicionado
- Geração de um único relatório semanal contendo todas as turmas do curso selecionado.
- Visualização semanal com uma turma por linha.

## [0.2.0] - 2026-10-09

### Adicionado
- Visões diária e semanal.
- Exportação semanal por turma.

### Corrigido
- Drag and drop sobre aulas ocupadas.

## [0.1.0] - 2026-10-07

### Adicionado
- Importação do Excel.
- Grade semanal e primeira implementação de drag and drop.
