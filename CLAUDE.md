# Corrida - Coach Virtual Adaptativo

App web single-user que gera um plano de treino de corrida periodizado (VDOT/Jack Daniels) a
partir de uma prova-alvo, e ajusta a carga da semana seguinte com base no que foi realmente
registrado. Contexto completo do produto: [`plano.md`](plano.md).

## Estado do projeto

Greenfield - nenhum código foi escrito ainda. Spec, design e tasks da primeira (e por ora única)
feature estão aprovados; a implementação ainda não começou.

- **Spec**: `.specs/features/coach-virtual/spec.md` - requisitos EARS, IDs rastreáveis
- **Design**: `.specs/features/coach-virtual/design.md` - arquitetura, modelo de dados, diagramas
- **Tasks**: `.specs/features/coach-virtual/tasks.md` - 43 tarefas atômicas em 12 fases, aprovadas
- **Decisões de projeto**: `.specs/STATE.md` (`AD-001`..`AD-004`)

## Como implementar

Este projeto segue o workflow da skill `tlc-spec-driven`. Para qualquer trabalho de implementação,
ative a skill por nome e siga `tasks.md` tarefa por tarefa (um commit atômico por tarefa, gate
antes de marcar como concluída) - não implemente ad hoc fora desse fluxo.

**T40 (deploy no Vercel/Supabase) exige confirmação explícita do usuário antes de executar** -
criar recursos na nuvem e tocar o banco de produção estão fora da autorização padrão de
implementar tarefas localmente.

## Convenções de arquitetura (vinculantes - ver `.specs/STATE.md` para o raciocínio completo)

- **Stack**: Next.js (App Router) + Prisma + Postgres (Supabase) + NextAuth.js, deploy no Vercel.
- **Toda regra de negócio vive em `lib/domain/*`** (funções puras/TS, testadas com Vitest). Server
  Actions (`app/**/actions.ts`) são adaptadoras finas: validam com zod e chamam `lib/domain/*` -
  nunca contêm lógica própria.
- **Autenticação**: NextAuth Credentials Provider contra uma única conta semeada via variáveis de
  ambiente (`prisma/seed.ts`). Não existe tela de cadastro.
- **Prisma + Supabase**: `DATABASE_URL` (porta 6543, pooled, PgBouncer transaction mode) para
  runtime; `DIRECT_URL` (porta 5432) só para `prisma migrate` - o pooler não suporta o engine de
  migration.
- **Testes**: Vitest para `lib/domain/*` (unit, co-localizado com o código); Playwright para e2e
  (`e2e/**`). Comandos exatos em `tasks.md`.

## Idioma

Conversar e documentar em português do Brasil. Em artefatos `.specs/*`, títulos de seção e
palavras-chave EARS (`WHEN`/`THEN`/`SHALL`/`IF`/`WHILE`) ficam em inglês por convenção da skill;
identificadores de código nunca são traduzidos.
