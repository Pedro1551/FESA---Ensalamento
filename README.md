# Ensalamento FESA

Aplicação web em JavaScript para visualização, edição e planejamento do horário acadêmico, com suporte à importação do arquivo **Horario Azul - Faculdade - 2026.2.xls**.

## Versão atual

`v0.3.7`

## Funcionalidades atuais

- Importação do Excel no navegador.
- Identificação de cursos, turmas, dias, horários, disciplinas e professores.
- Grade semanal por turma com drag and drop.
- Validação inicial de conflitos de professor.
- Visualização de todas as turmas por dia e por semana.
- Padronização visual com cartões em tons pastéis por professor.
- Aulas alteradas destacadas em amarelo.
- Impressão de uma turma ou de todo o curso em A4 paisagem pelo diálogo nativo do navegador.
- Cadastro manual de novas aulas sobre a grade importada.
- Edição de disciplina, professor, sala/laboratório, dia, início e duração de uma aula.
- Cancelamento de aulas sem destruir a grade-base importada.
- Grade adaptativa: ao alterar início/fim ou inserir uma nova aula, o card ocupa automaticamente os horários correspondentes.
- Histórico local das alterações feitas durante a sessão.
- Desfazer para movimentações, novas aulas, edições e cancelamentos.
- Restauração da turma para a grade-base original do Excel.
- Impressão/PDF reflete automaticamente novas aulas, alterações e cancelamentos.
- A visualização selecionada é preservada ao consultar aulas nas visões diária e semanal.
- Interface compacta e orientada ao fluxo de trabalho, com detalhes e atividade em painéis secundários.

## Modelo atual da grade

O Excel é tratado como **grade-base**. A aplicação mantém a grade importada como referência e aplica alterações sobre ela:

```text
Excel / grade-base
       ↓
Alterações da sessão
├── mover aula
├── editar aula
├── adicionar aula
└── cancelar aula
       ↓
Grade efetiva
├── tela semanal
├── visão diária
├── visão geral
└── impressão / PDF
```

As alterações ainda são mantidas somente na sessão do navegador. Persistência em banco de dados será uma etapa posterior.

## Nova aula / edição

Na visão da turma, use **Nova aula** para cadastrar um novo bloco.

Ao selecionar uma aula existente, use **Editar aula** para alterar:

- disciplina;
- professor;
- sala/laboratório;
- dia;
- início;
- fim/duração.

O horário final é limitado aos slots contíguos da própria grade para evitar atravessar intervalos. Antes de salvar, o sistema verifica conflito da turma e conflito de professor nas demais turmas importadas.

## Executar

```powershell
npm install
npm run dev
```

## Impressão / PDF

1. Escolha a semana desejada.
2. Use `Exportar semana` para montar o relatório de todas as turmas do curso.
3. Use `Exportar turma` para somente a turma selecionada.
4. O navegador abrirá o diálogo de impressão.
5. Para gerar o arquivo, escolha `Salvar como PDF`.

Configuração recomendada:

```text
Papel: A4
Orientação: Paisagem
Escala: 100% / Padrão
Gráficos de plano de fundo: ativado
```

## Estrutura relevante

```text
src/
├── excelParser.js
├── main.js
├── pdfGenerator.js
└── styles.css
```

## Versionamento sugerido

```powershell
git status
git add .
git commit -m "fix: restore baseline moves and dark changed-card state"
git push origin main

git tag -a v0.3.6 -m "Baseline conflict and dark card fixes"
git push origin v0.3.0
```
