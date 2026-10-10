# Versionamento Git/GitHub

Para este projeto, a recomendação inicial é manter `main` sempre utilizável e criar branches curtas apenas para funcionalidades maiores.

## Fluxo de trabalho

Antes de alterar uma funcionalidade maior:

```powershell
git switch -c feature/nome-da-funcionalidade
```

Depois de testar:

```powershell
git add .
git commit -m "feat: describe the implemented feature"
git switch main
git merge feature/nome-da-funcionalidade
git push origin main
```

Para correções pequenas, também é aceitável trabalhar diretamente na `main` neste estágio de protótipo, desde que cada mudança seja registrada em um commit claro.

## Padrão de commits

- `feat:` nova funcionalidade.
- `fix:` correção.
- `refactor:` reorganização sem alterar comportamento.
- `docs:` documentação.
- `chore:` configuração/manutenção.
- `test:` testes.

Exemplos:

```text
feat: add daily course overview
feat: export class weekly schedule to PDF
fix: allow drop over occupied lesson cards
fix: prevent lesson block from crossing break
refactor: isolate PDF generation module
```

## Versões

- `0.1.0`: importação do Excel + primeira grade com drag-and-drop.
- `0.2.0`: correção do drag-and-drop + visões diária/semanal + PDF semanal por turma.
- `0.2.1`: visão semanal com uma turma por linha + PDF semanal geral do curso.
- `0.2.2`: padronização UI/UX das grades e aplicação das cores por professor também nos PDFs.
- `0.2.4`: relatórios semanais via impressão nativa do navegador, com opção Salvar como PDF.
- `0.3.0`: salas/laboratórios, conflitos de recursos e filtros mais completos.
- `0.4.0`: persistência/backend e colaboração multiusuário.
- `1.0.0`: primeira versão estável para uso institucional.

## Publicar a v0.2.5

Depois de copiar os arquivos da nova versão:

```powershell
npm install
git status
git add .
git commit -m "refactor: use browser printing for weekly PDF reports"
git push origin main

git tag -a v0.2.5 -m "Browser print based weekly reports"
git push origin v0.2.5
```
