# Ensalamento FESA - Protótipo

Protótipo em JavaScript para visualização e edição do horário acadêmico a partir do arquivo **Horario Azul - Faculdade - 2026.2.xls**.

## Versão atual

`v0.2.0`

## Funcionalidades

- Lê o Excel original diretamente no navegador.
- Detecta cursos/planilhas, turmas, dias, horários, disciplinas e professores.
- Permite selecionar curso e turma.
- Visualização **Turma · semana** com drag and drop.
- Troca de duas aulas de mesma duração ao soltar um card sobre outro.
- Bloqueio de movimentos que atravessam o intervalo entre horários.
- Validação inicial de conflito de professor em todas as turmas importadas.
- Visualização **Todas as turmas · dia**.
- Visualização **Todas as turmas · semana**.
- Geração de PDF semanal de uma turma, inspirado nos relatórios institucionais de ensalamento.
- Desfazer a última movimentação e restaurar a turma.
- Opção de movimentação sem drag and drop no painel de detalhes.

> Nesta etapa as alterações ficam somente na sessão do navegador. Banco de dados e sincronização multiusuário ficam para versões posteriores.

## Executar

```powershell
npm install
npm run dev
```

Abra o endereço informado pelo Vite, normalmente:

```text
http://localhost:5173
```

## Atualizando da v0.1.0

A v0.2.0 adiciona a dependência `jspdf`. Depois de substituir os arquivos, execute novamente:

```powershell
npm install
```

Isso também atualizará/criará o `package-lock.json` no seu computador.

## Uso

### Editar uma turma

1. Escolha o curso.
2. Escolha a turma.
3. Mantenha `Visualização = Turma · semana`.
4. Arraste um card para um horário vazio ou para outra aula de duração equivalente.
5. Caso o arraste do navegador esteja indisponível, clique na aula e utilize `Mover aula selecionada`.

### Ver todas as aulas de um dia

1. Escolha o curso.
2. Mude `Visualização` para `Todas as turmas · dia`.
3. Escolha o dia.

### Ver todas as turmas da semana

Mude `Visualização` para `Todas as turmas · semana`.

### Gerar PDF

1. Selecione a turma.
2. Informe uma data na semana desejada.
3. Clique em `Gerar PDF da turma`.

Na visão semanal geral também existe um botão `PDF` em cada turma.

O PDF usa os dados disponíveis no Excel atual. Campos de sala/laboratório serão exibidos automaticamente quando esse dado fizer parte do modelo de cada aula em uma etapa futura.

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
│   ├── pdfGenerator.js
│   └── styles.css
├── docs/
│   └── VERSIONAMENTO.md
├── CHANGELOG.md
├── README.md
├── package.json
└── index.html
```

## Versionamento sugerido

```powershell
git status
git add .
git commit -m "feat: add day/week views, fix drag-and-drop and export weekly PDF"
git push origin main

git tag -a v0.2.0 -m "Day/week views, drag-and-drop fix and weekly PDF"
git push origin v0.2.0
```
