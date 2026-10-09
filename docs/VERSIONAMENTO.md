# Versionamento Git/GitHub

Para este projeto pequeno, a recomendação inicial é manter `main` sempre utilizável e criar branches curtas apenas para funcionalidades maiores.

## Primeira publicação

No terminal do VS Code, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "feat: create scheduling demo with Excel import and drag-and-drop"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

## Fluxo para próximas alterações

Exemplo para criar a exportação da grade:

```bash
git switch -c feature/export-schedule
```

Após concluir:

```bash
git add .
git commit -m "feat: add schedule export"
git switch main
git merge feature/export-schedule
git push origin main
```

## Padrão de commits

Use mensagens curtas no padrão Conventional Commits:

- `feat:` nova funcionalidade.
- `fix:` correção.
- `refactor:` reorganização sem alterar comportamento.
- `docs:` documentação.
- `chore:` configuração/manutenção.
- `test:` testes.

Exemplos:

```text
feat: add professor conflict validation
feat: add room schedule view
fix: preserve lesson duration after drag
refactor: isolate Excel parser
docs: document local setup
```

## Versões

O projeto começa em `0.1.0`.

Sugestão:

- `0.1.0`: importação do Excel + drag-and-drop.
- `0.2.0`: exportação e histórico local.
- `0.3.0`: salas e conflitos completos.
- `0.4.0`: backend/banco e colaboração.
- `1.0.0`: primeira versão estável para uso institucional.

Quando quiser marcar uma versão:

```bash
git tag -a v0.1.0 -m "Prototype: Excel import and drag-and-drop"
git push origin v0.1.0
```
