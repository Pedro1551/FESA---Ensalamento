# Ensalamento — protótipo de grade acadêmica

Versão atual: **0.1.0**

Protótipo em JavaScript para validar a edição visual de uma grade acadêmica por **arrastar e soltar**. A aplicação lê diretamente a planilha `Horario Azul - Faculdade - 2026.2.xls`, identifica automaticamente cursos, turmas, dias, horários, disciplinas e professores e monta a grade no navegador.

## O que já funciona

- Leitura automática de `.xls` e `.xlsx` com SheetJS.
- Detecção das planilhas visíveis que possuem blocos `Turma` + `Horário`.
- Seleção de curso e turma.
- Grade semanal construída a partir dos horários reais do Excel.
- Drag-and-drop das aulas.
- Troca automática quando o destino contém um bloco de mesma duração.
- Bloqueio de destinos incompatíveis.
- Detecção de conflito de professor entre todas as turmas importadas.
- Destaque visual das aulas alteradas.
- Botão para desfazer a última alteração.
- Restauração da turma para a posição original da planilha.
- Carregamento de outro arquivo Excel pelo navegador.

> Nesta versão as mudanças existem somente na memória do navegador. O Excel original não é alterado.

## Dados da planilha fornecida

A leitura inicial considera as planilhas visíveis do arquivo de 2026.2. No arquivo atual foram identificadas:

- Administração: 8 turmas / 80 blocos de aula.
- Engenharia de Alimentos: 10 turmas / 116 blocos de aula.
- Engenharia de Computação: 10 turmas / 100 blocos de aula.
- Engenharia de Controle e Automação: 10 turmas / 102 blocos de aula.

Total: **38 turmas e 398 blocos de aula**.

Observações longas de disciplinas eletivas são preservadas separadamente e não viram cards arrastáveis.

## Rodar no VS Code

Requisitos: Node.js 18+ e npm.

```bash
npm install
npm run dev
```

O Vite exibirá um endereço local, normalmente `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Estrutura

```text
ensalamento-demo/
├── public/
│   └── data/
│       ├── Horario Azul - Faculdade - 2026.2.xls
│       └── horario-fallback.json
├── src/
│   ├── excelParser.js
│   ├── main.js
│   └── styles.css
├── docs/
│   └── VERSIONAMENTO.md
├── CHANGELOG.md
├── package.json
└── README.md
```

## Próximos passos sugeridos

1. Exportar as alterações para JSON/Excel.
2. Criar visualização por professor, além da visualização por turma.
3. Adicionar salas e conflitos de sala.
4. Persistir alterações em banco.
5. Adicionar atualização em tempo real entre usuários.
6. Introduzir autenticação e permissões.
7. Adicionar motor de otimização automática em uma etapa posterior.
