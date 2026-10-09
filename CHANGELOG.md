# Changelog

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
