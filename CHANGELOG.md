# Changelog

## [0.2.1] - 2026-10-09

### Adicionado
- Geração de um único PDF semanal contendo todas as turmas do curso selecionado.
- Organização do PDF geral em duas turmas por página quando a quantidade de horários permite.
- Botão principal `Gerar PDF semanal`, mantendo também a exportação individual por turma.

### Melhorado
- Visualização `Todas as turmas · semana` agora apresenta uma turma por linha.
- Removidas as barras horizontais individuais da visão semanal em telas desktop; a grade utiliza toda a largura disponível.

## [0.2.0] - 2026-10-09

### Adicionado
- Visualização da turma selecionada por semana.
- Visualização de todas as turmas do curso em um dia.
- Visualização semanal de todas as turmas do curso.
- Geração/download de PDF semanal para a turma selecionada.
- Botão de PDF em cada turma na visão semanal geral.
- Seleção da semana usada nas datas do PDF.
- Alternativa de movimentação por seletores de dia/horário.

### Corrigido
- Drag and drop sobre aulas já ocupadas: agora o card de destino também recebe o drop e permite troca.
- Validação de blocos que atravessariam o intervalo entre aulas.
- Normalização de metadados quando o fallback JSON é utilizado.
- Espaçamento/altura dos cards para reduzir sobreposição visual durante a movimentação.

## [0.1.0] - 2026-10-07

### Adicionado
- Importação do arquivo Excel base (.xls/.xlsx).
- Identificação automática de cursos/planilhas e turmas.
- Grade semanal por turma.
- Primeira implementação de drag and drop.
- Validação inicial de conflito de professor.
- Desfazer e restaurar turma.
