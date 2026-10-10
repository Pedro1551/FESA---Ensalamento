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
- `0.3.0`: edição dinâmica da grade, novas aulas, alteração de duração, cancelamento e histórico local.
- `0.4.0`: salas/laboratórios, conflitos de recursos e regras de ensalamento.
- `0.5.0`: persistência/backend e colaboração multiusuário.
- `1.0.0`: primeira versão estável para uso institucional.

## Publicar a v0.3.0

Depois de copiar os arquivos da nova versão e testar:

```powershell
git status
git add .
git commit -m "feat: add dynamic lesson creation and schedule editing"
git push origin main

git tag -a v0.3.0 -m "Dynamic schedule editing and lesson management"
git push origin v0.3.0
```
