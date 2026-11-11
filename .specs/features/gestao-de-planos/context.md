# Gestão de Planos Context

**Gathered:** 2026-11-10
**Spec:** `.specs/features/gestao-de-planos/spec.md`
**Status:** Ready for design (spec awaiting approval)

---

## Feature Boundary

Até 3 planos (um seguido, os outros pausados), excluir um plano ou um treino planejado, refazer o
plano inteiro ao mudar a data da prova, e uma observação opcional no registro do treino.

---

## Implementation Decisions

### Vários planos

- User: "Até 3 salvos, 1 ativo (Recomendado)" - até 3 planos guardados, só o escolhido aparece no
  painel e recebe o ajuste semanal; os outros ficam parados até a troca (`AD-005`).

### Excluir treino

- User: "Remover o treino planejado (Recomendado)" - o treino some da semana com o registro, não
  conta como perdido no ajuste semanal, e pede confirmação.

### Excluir plano

- User: "Excluir de vez, com confirmação (Recomendado)" - apaga o plano com semanas, treinos,
  registros e histórico de VDOT; some do Histórico; não dá para desfazer.

### Data da prova

- User: "Recalcular o plano todo" - refazer desde a primeira semana (fases e treinos), não só da
  semana atual em diante; registros feitos são mantidos.

### Agent's Discretion

- Aprovações delegadas a um agente de execução (2026-11-10). User: "crie um agente que tem o
  objetivo de concluir o projeto. ele aprova todos os commit e push que forem perguntados".
- Lista de tarefas: User: "Sim, o agente aprova (Recomendado)" - o agente aprova `tasks.md` e
  registra a delegação na linha `**Approved**`.
- Banco de produção: User: "Sim, só a migração (Recomendado)" - o agente roda
  `prisma migrate deploy` em produção logo antes do push; nunca apaga nem altera dados de produção.

### Declined / Undiscussed Gray Areas → Assumptions

Ver as linhas `n` em `spec.md` → Assumptions & Open Questions.

---

## Specific References

No specific requirements - open to standard approaches, held to the Passo Ritmo design system
(`docs/design/design_system.md`).

---

## Deferred Ideas

None - discussion stayed within feature scope.
