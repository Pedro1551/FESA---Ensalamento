# Ensalamento FESA - Protótipo

Protótipo em JavaScript para visualização e edição do horário acadêmico a partir do arquivo **Horario Azul - Faculdade - 2026.2.xls**.

## Versão atual

`v0.2.7`

## Funcionalidades atuais

- Importação do Excel no navegador.
- Identificação de cursos, turmas, dias, horários, disciplinas e professores.
- Grade semanal por turma com drag and drop.
- Validação inicial de conflitos de professor.
- Visualização de todas as turmas por dia e por semana.
- Padronização visual com cartões em tons pastéis por professor.
- Aulas alteradas destacadas em amarelo.
- Impressão de uma turma ou de todo o curso em A4 paisagem.
- Layout de impressão modernizado para ficar visualmente próximo da grade mostrada na tela.
- Geração de PDF através do diálogo nativo de impressão do navegador (`Salvar como PDF`).

## Executar

```powershell
npm install
npm run dev
```

## Impressão / PDF

1. Escolha a semana desejada.
2. Use `Imprimir semana / PDF` para montar o relatório de todas as turmas do curso.
3. Use `Imprimir turma / PDF` para somente a turma selecionada.
4. O navegador abrirá o diálogo de impressão.
5. Para gerar o arquivo, escolha `Salvar como PDF`.

Configuração recomendada:

```text
Papel: A4
Orientação: Paisagem
Escala: 100% / Padrão
Gráficos de plano de fundo: ativado
```

A impressão é construída com HTML e CSS, utilizando `@media print`, `@page` e CSS Grid para preservar corretamente blocos que ocupam múltiplos horários.

## Estrutura relevante

```text
src/
├── excelParser.js
├── main.js
├── pdfGenerator.js   # nome preservado por compatibilidade; agora gera a visualização de impressão
└── styles.css
```

## Versionamento sugerido

```powershell
git status
git add .
git commit -m "style: increase print typography for readability"
git push origin main

git tag -a v0.2.7 -m "Larger print typography"
git push origin v0.2.5
```
