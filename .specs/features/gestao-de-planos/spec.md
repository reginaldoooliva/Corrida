# Gestão de Planos Specification

**Approved**: 2026-11-10 - user: "aprovada a spec."

## Problem Statement

O app guarda um único plano ativo por vez (`LIFE-06`), então o corredor não consegue montar
alternativas para provas diferentes e escolher qual seguir. Também não dá para excluir um plano ou
um treino planejado que não vai acontecer. Mudar a data da prova só refaz o plano da semana atual em
diante, e o registro de um treino não aceita uma observação livre, embora a tabela já tenha o campo
`notes`.

## Goals

- [ ] O corredor mantém até 3 planos e troca o plano que segue com um toque, sem perder os outros.
- [ ] O corredor exclui um plano inteiro ou um treino planejado, sempre depois de confirmar.
- [ ] Mudar a data da prova refaz o plano inteiro, da primeira semana à última, sem perder registros.
- [ ] Cada registro de treino aceita uma observação de até 500 caracteres.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Mais de 3 planos não arquivados | Limite pedido pelo usuário. |
| Mais de um plano seguido (ajustado) ao mesmo tempo | Usuário escolheu "Até 3 salvos, 1 ativo". |
| Desfazer uma exclusão (lixeira) | Usuário escolheu "Excluir de vez, com confirmação". |
| Comparar planos lado a lado ou duplicar um plano | Não foi pedido. |
| Editar data, tipo ou distância de um treino planejado | Não foi pedido; só a exclusão. |
| Recalcular o plano todo ao mudar os dias de treino | O pedido cita só a data da prova; mudar os dias segue `EDIT-01` (da semana atual em diante). |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Como funcionam os 3 planos | Até 3 planos não arquivados; um `active` (seguido), os outros `paused` | User: "Até 3 salvos, 1 ativo (Recomendado)" | y |
| O que "excluir treino" faz | Remove a sessão planejada e o registro dela; não conta como perdida | User: "Remover o treino planejado (Recomendado)" | y |
| O que "excluir plano" faz | Apaga de vez, depois de confirmação, com tudo que pertence ao plano | User: "Excluir de vez, com confirmação (Recomendado)" | y |
| O que muda ao alterar a data da prova | Refaz o plano todo desde a primeira semana, mantendo os registros | User: "Recalcular o plano todo" | y |
| Planos arquivados contam no limite de 3? | Não: o limite vale só para `active` + `paused`; arquivados ficam no Histórico sem limite | Um plano arquivado já terminou; contá-lo travaria a criação de planos novos para sempre | y - approved with the spec |
| Criar um plano quando já existe um `active` | O novo vira `active` e o anterior vira `paused` | Quem acabou de criar um plano quer segui-lo; o anterior não se perde | y - approved with the spec |
| Semanas que terminam enquanto um plano está pausado | Ao voltar a seguir o plano, essas semanas ficam marcadas como reavaliadas, sem ajuste | Sem isso, retomar um plano reduziria a carga por treinos que não deviam ser feitos | y - approved with the spec |
| Plano pausado cuja prova já passou | Arquiva como o ativo (`LIFE-01`) | Mesma regra de ciclo de vida para todo plano | y - approved with the spec |
| Excluir o plano `active` | Nenhum outro é promovido sozinho; o painel mostra o estado vazio com link para a tela de planos | Trocar de plano é escolha do usuário, não do app | y - approved with the spec |
| Excluir o último treino de uma semana | Recusado: "A semana precisa de pelo menos um treino." | Uma semana vazia não tem como ser reavaliada | y - approved with the spec |
| Onde gerenciar os planos | Uma tela "Planos", aberta a partir das Configurações e do estado vazio do painel | A barra inferior já tem 3 seções; planos são configuração | y - approved with the spec |
| Onde excluir um treino | Na tela do treino (a mesma de "Registrar treino") | É a tela que já abre um treino específico | y - approved with the spec |
| Onde aparece a observação | No formulário de registro e no card do treino no painel | São os lugares onde o registro aparece hoje | y - approved with the spec |
| Semanas passadas no recálculo do plano todo | São refeitas no lugar: treinos registrados ficam, os não registrados são gerados de novo, e a semana continua marcada como reavaliada se já era | Refazer não pode apagar registros nem reavaliar de novo uma semana já julgada (`ADJ-06`) | y - approved with the spec |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Até 3 planos, um seguido ⭐ MVP

**User Story**: Como corredor, quero guardar até 3 planos e escolher qual sigo, para preparar
provas diferentes sem perder nenhum plano.

**Why P1**: É o pedido principal e muda a regra de um plano só (`LIFE-06`, ver `AD-005`).

**Acceptance Criteria**:

1. The system SHALL permitir no máximo 3 planos com status `active` ou `paused` ao mesmo tempo. `PLANS-01`
2. The system SHALL manter no máximo um plano `active` por vez. `PLANS-02`
3. IF o usuário tenta criar um plano quando já existem 3 planos `active` ou `paused` THEN the system
   SHALL recusar a criação e mostrar "Você já tem 3 planos. Exclua um para criar outro." `PLANS-03`
4. WHEN o usuário cria um plano enquanto outro está `active` THEN the system SHALL deixar o novo
   plano `active` e o anterior `paused`. `PLANS-04`
5. WHEN o usuário abre a tela "Planos" THEN the system SHALL listar cada plano `active` ou `paused`
   com a prova, a data da prova, o número de semanas e o status "Seguindo" ou "Pausado". `PLANS-05`
6. WHEN o usuário usa "Seguir este plano" num plano `paused` THEN the system SHALL deixá-lo
   `active` e o plano que estava `active` `paused`. `PLANS-06`
7. WHEN o usuário abre o painel depois de trocar de plano THEN the system SHALL mostrar a semana
   atual do plano `active`. `PLANS-07`
8. WHILE um plano está `paused` the system SHALL NOT reavaliar as semanas dele nem mostrar o aviso
   de reteste dele. `PLANS-08`
9. WHEN um plano `paused` volta a ser `active` THEN the system SHALL marcar como reavaliadas, sem
   criar `WeeklyAdjustment`, as semanas dele que terminaram antes desse dia. `PLANS-09`
10. WHEN o usuário abre o painel ou a tela "Planos" depois da data da prova de um plano `paused`
    THEN the system SHALL arquivar esse plano. `PLANS-10`
11. WHILE nenhum plano está `active` e existe um plano `paused` the system SHALL mostrar no painel
    o estado vazio com um link para a tela "Planos". `PLANS-11`
12. WHEN o usuário abre as Configurações THEN the system SHALL mostrar um link para a tela
    "Planos". `PLANS-12`

**Independent Test**: Criar dois planos (o segundo pausa o primeiro), abrir "Planos", seguir o
primeiro e ver o painel mostrar a semana dele; tentar um quarto plano com 3 existentes e ver a
recusa.

---

### P1: Excluir um plano ⭐ MVP

**User Story**: Como corredor, quero excluir um plano que não vou mais usar, para manter só o que
importa.

**Why P1**: Com o limite de 3 planos, excluir é o único jeito de abrir espaço.

**Acceptance Criteria**:

1. WHEN o usuário usa "Excluir plano" THEN the system SHALL pedir confirmação com o texto "Excluir o
   plano de <prova>? Todas as semanas, treinos e registros dele serão apagados. Isso não pode ser
   desfeito." `DEL-01`
2. WHEN o usuário confirma a exclusão de um plano THEN the system SHALL apagar o plano e todas as
   suas semanas, sessões, registros, ajustes semanais, histórico de VDOT e resultado de prova.
   `DEL-02`
3. WHEN o usuário cancela a exclusão de um plano THEN the system SHALL manter o plano e tudo que
   pertence a ele. `DEL-03`
4. WHEN o plano excluído era o `active` THEN the system SHALL deixar todos os outros planos com o
   status que já tinham. `DEL-04`
5. The system SHALL oferecer "Excluir plano" para cada plano na tela "Planos" e para cada plano
   arquivado no Histórico. `DEL-05`
6. WHEN um plano arquivado é excluído THEN the system SHALL deixar de listá-lo no Histórico. `DEL-06`

**Independent Test**: Excluir um plano pausado com treinos registrados e ver que ele some da tela
"Planos" e que nenhuma semana, sessão ou registro dele resta no banco.

---

### P1: Excluir um treino ⭐ MVP

**User Story**: Como corredor, quero tirar da semana um treino que não vou fazer, para que ele não
conte contra mim no ajuste semanal.

**Why P1**: Pedido direto do usuário.

**Acceptance Criteria**:

1. WHEN o usuário usa "Excluir treino" na tela de um treino do plano `active` THEN the system SHALL
   pedir confirmação com o texto "Excluir o treino de <dia>? O registro dele, se houver, também
   será apagado." `DEL-07`
2. WHEN o usuário confirma a exclusão de um treino THEN the system SHALL apagar a sessão e o
   `WorkoutLog` dela, e mostrar o painel sem essa sessão. `DEL-08`
3. WHEN uma semana com um treino excluído é reavaliada THEN the system SHALL calcular os sinais de
   `ADJ-01` só com as sessões que restam, sem contar a excluída como perdida. `DEL-09`
4. IF o usuário tenta excluir o único treino que resta numa semana THEN the system SHALL recusar e
   mostrar "A semana precisa de pelo menos um treino." `DEL-10`

**Independent Test**: Numa semana com 4 treinos, excluir um não registrado, deixar a semana
terminar com os outros 3 registrados, e ver que o sinal de treinos perdidos fica falso.

---

### P1: Recalcular o plano todo ao mudar a data da prova ⭐ MVP

**User Story**: Como corredor, quero que mudar a data da prova refaça o plano inteiro, para que as
fases fiquem certas para a nova data.

**Why P1**: Pedido direto do usuário; muda o alcance de `EDIT-01` só para a data da prova.

**Acceptance Criteria**:

1. WHEN o usuário muda a data da prova do plano `active` THEN the system SHALL refazer as fases e as
   sessões de todas as semanas, da primeira à última, contadas a partir da data de início original
   do plano. `RECALC-01`
2. WHEN o plano é refeito por `RECALC-01` THEN the system SHALL manter cada sessão registrada, com
   seu `WorkoutLog`, na sua data, sem gerar outra sessão no mesmo dia da mesma semana. `RECALC-02`
3. WHEN o plano é refeito por `RECALC-01` THEN the system SHALL derivar os paces das sessões geradas
   do `currentVdot` do plano. `RECALC-03`
4. WHEN o plano é refeito por `RECALC-01` THEN the system SHALL manter como reavaliada cada semana
   que já tinha sido reavaliada. `RECALC-04`
5. IF a nova data da prova deixa o plano com menos semanas do que a semana atual THEN the system
   SHALL recusar a mudança e mostrar "A data da prova precisa ser depois da semana de treino atual."
   `RECALC-05`

**Independent Test**: Num plano na semana 4 com treinos registrados nas semanas 1-3, adiar a prova
em 3 semanas e ver que a semana 1 muda de fase quando a divisão de fases muda, e que os registros
das semanas 1-3 continuam nas mesmas datas.

---

### P1: Observação no registro do treino ⭐ MVP

**User Story**: Como corredor, quero anotar uma observação ao registrar um treino, para lembrar
como foi.

**Why P1**: Pedido direto do usuário.

**Acceptance Criteria**:

1. WHEN o usuário registra ou edita um treino THEN the system SHALL oferecer um campo opcional
   "Observação" e salvar o texto em `WorkoutLog.notes`. `NOTE-01`
2. IF a observação tem mais de 500 caracteres THEN the system SHALL recusar o registro e mostrar
   "Observação inválida: no máximo 500 caracteres." `NOTE-02`
3. WHEN a observação enviada está vazia ou só tem espaços THEN the system SHALL salvar
   `WorkoutLog.notes` como nulo. `NOTE-03`
4. WHEN o usuário abre um registro com observação para editar THEN the system SHALL mostrar a
   observação salva no campo. `NOTE-04`
5. WHEN um treino registrado tem observação THEN the system SHALL mostrar o texto da observação no
   card desse treino no painel. `NOTE-05`

**Independent Test**: Registrar um treino com "Dor leve no joelho", ver o texto no card do painel e
no campo ao editar; apagar o texto e ver o campo vazio de novo.

---

## Edge Cases

- IF dois pedidos tentam deixar planos diferentes `active` ao mesmo tempo THEN the system SHALL
  manter só um `active`, recusando o segundo pela mesma regra de `PLANS-02`. `PLANS-13`
- IF um pedido de "Seguir este plano", "Excluir plano" ou "Excluir treino" cita um plano ou sessão
  que não pertence ao usuário ou não existe THEN the system SHALL recusar sem alterar nada. `PLANS-14`
- WHEN o usuário segue um plano `paused` cuja prova já passou THEN the system SHALL arquivá-lo em vez
  de deixá-lo `active` (`PLANS-10`).

---

## Implicit-requirement sweep

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | `PLANS-03`, `NOTE-02`, `NOTE-03`, `DEL-10`, `RECALC-05` |
| Failure / partial-failure states | Exclusões e recálculo rodam numa transação: ou tudo muda, ou nada (`DEL-02`, `RECALC-01`) |
| Idempotency / retry / duplicate handling | `PLANS-13`; excluir algo já excluído cai em `PLANS-14` |
| Auth boundaries & rate limits | `PLANS-14`; rate limit N/A because o app tem uma conta só, atrás de login |
| Concurrency / ordering | `PLANS-13` |
| Data lifecycle / expiry | `DEL-02`, `DEL-08`, `PLANS-10` |
| Observability | N/A because o app não tem logs nem métricas além dos já existentes |
| External-dependency failure | N/A because a feature não chama serviço externo novo |
| State-transition integrity | `PLANS-04`, `PLANS-06`, `PLANS-09`, `PLANS-10`; transições: `active` ↔ `paused`, ambos → `archived` |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PLANS-01 | P1: Até 3 planos | T3 | Done |
| PLANS-02 | P1: Até 3 planos | T3 | Done |
| PLANS-03 | P1: Até 3 planos | T13 | Done |
| PLANS-04 | P1: Até 3 planos | T3 | Done |
| PLANS-05 | P1: Até 3 planos | T10 | Done |
| PLANS-06 | P1: Até 3 planos | T11 | Done |
| PLANS-07 | P1: Até 3 planos | T11 | Done |
| PLANS-08 | P1: Até 3 planos | T14 | Done |
| PLANS-09 | P1: Até 3 planos | T4 | Done |
| PLANS-10 | P1: Até 3 planos | T14 | Done |
| PLANS-11 | P1: Até 3 planos | T14 | Done |
| PLANS-12 | P1: Até 3 planos | T15 | Done |
| PLANS-13 | Edge Cases | T4 | Done |
| PLANS-14 | Edge Cases | Design | Pending |
| DEL-01 | P1: Excluir um plano | T12 | Done |
| DEL-02 | P1: Excluir um plano | T12 | Done |
| DEL-03 | P1: Excluir um plano | T12 | Done |
| DEL-04 | P1: Excluir um plano | T6 | Done |
| DEL-05 | P1: Excluir um plano | T16 | Done |
| DEL-06 | P1: Excluir um plano | T16 | Done |
| DEL-07 | P1: Excluir um treino | T17 | Done |
| DEL-08 | P1: Excluir um treino | T17 | Done |
| DEL-09 | P1: Excluir um treino | T7 | Done |
| DEL-10 | P1: Excluir um treino | T17 | Done |
| RECALC-01 | P1: Recalcular o plano todo | T15 | Done |
| RECALC-02 | P1: Recalcular o plano todo | T8 | Done |
| RECALC-03 | P1: Recalcular o plano todo | T8 | Done |
| RECALC-04 | P1: Recalcular o plano todo | T8 | Done |
| RECALC-05 | P1: Recalcular o plano todo | T8 | Done |
| NOTE-01 | P1: Observação | T18 | Done |
| NOTE-02 | P1: Observação | T18 | Done |
| NOTE-03 | P1: Observação | T9 | Done |
| NOTE-04 | P1: Observação | T18 | Done |
| NOTE-05 | P1: Observação | T19 | Done |

**Coverage:** 34 total, 0 mapped to tasks, 34 unmapped ⚠️ (tasks not written yet)

---

## Sources

- Pedido do usuário (2026-11-10): "quero ter a opção de fazer 3 planos de corrida e optar por um
  deles. quero poder excluir um plano ou treino. quando eu alterar a data da prova eu quero
  recalcular os treinos. quando eu registrar um treino que colocar uma observação"
- Respostas às perguntas de produto (2026-11-10), citadas na tabela de suposições.
- `.specs/features/coach-virtual/spec.md` - `LIFE-01`, `LIFE-06`, `EDIT-01`..`EDIT-03`, `ADJ-01`,
  `ADJ-06`, que esta feature estende ou substitui (`AD-005`).

---

## Success Criteria

- [ ] Trocar o plano seguido leva um toque na tela "Planos" e o painel mostra o plano escolhido.
- [ ] Nenhuma exclusão acontece sem confirmação, e uma exclusão confirmada não deixa dado órfão.
- [ ] Mudar a data da prova nunca apaga um registro de treino.
