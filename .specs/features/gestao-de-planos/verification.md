# Gestão de Planos verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 89e9591
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `plan-lifecycle.test.ts` `createNewPlan counts only active and paused plans toward the limit of 3` | yes - 2 mantidos + 2 arquivados + 1 de outro usuário deixam criar; com 3 mantidos recusa com o texto exato e `db` intacto (limite fixado nos dois lados) |
| C2 | `plan-lifecycle.test.ts` `createPlan pauses the active plan so at most one stays active` | yes - só o novo plano fica `ACTIVE` para o user-1; o `ACTIVE` de outro usuário não muda |
| C3 | `plans.spec.ts` `a fourth plan is refused with the 3-plan message` | yes - alerta com o texto exato pela UI e nenhum plano criado ou alterado no banco |
| C4 | `plan-lifecycle.test.ts` `createNewPlan makes the new plan active and the previous one paused` | yes - compara os pares `[id, status]` exatos |
| C5 | `plans.spec.ts` `the plans screen lists each active and paused plan with race, date, weeks and status` | yes - prova, data, semanas e "Seguindo"/"Pausado" por item; arquivado fora da lista |
| C6 | `plans.spec.ts` `following a paused plan makes it active and pauses the other` | yes - confere a UI e o status de cada plano no banco |
| C7 | `plans.spec.ts` `the dashboard shows the current week of the plan just followed` | yes - "Semana 1" antes, "Semana 2" e prova 10K depois da troca |
| C8 | `plans.spec.ts` `the dashboard never reassesses or prompts a retest for a paused plan` | yes - plano pausado com semana vencida e VDOT de 30 dias: sem `reassessedAt`, sem `WeeklyAdjustment`, sem aviso de reteste |
| C9 | `plan-lifecycle.test.ts` `followPlan marks the plan's ended weeks reassessed without a WeeklyAdjustment` | yes - semanas 1-2 marcadas, a semana que termina hoje não (limite fixado), nenhum ajuste, sessões intactas |
| C10 | `plans.spec.ts` `opening the plans screen or the dashboard archives a paused plan whose race has passed` | yes - prova ontem arquivada pela tela "Planos" e pelo painel; o outro pausado não muda |
| C11 | `plans.spec.ts` `with only paused plans the dashboard shows the empty state linking to the plans screen` | yes - estado vazio com link `href="/plans"` |
| C12 | `plans.spec.ts` `settings links to the plans screen` | yes - com e sem plano ativo, e o link navega para "Planos" |
| C13 | `plan-lifecycle.test.ts` `followPlan refuses a concurrent second activation without changing anything` | yes - P2002 vira `PlanConflictError` e `db` fica igual; o índice parcial `Plan_userId_active_key` existe na migration inicial |
| C14 | `plan-lifecycle.test.ts` `followPlan, deletePlan and deleteSession refuse an id that is not the user's or does not exist` | yes - plano de outro usuário, inexistente e arquivado; sessão de outro usuário, de plano pausado e inexistente; `db` intacto |
| C15 | `delete.spec.ts` `deleting a plan asks for confirmation with the spec text` | yes - texto exato com o nome da prova |
| C16 | `delete.spec.ts` `confirming deletes the plan and every row it owns` | yes - zero linhas de cada tabela do plano excluído, o outro plano intacto |
| C17 | `delete.spec.ts` `cancelling the plan deletion keeps the plan and everything in it` | yes - contagem de cada tabela igual depois de cancelar e recarregar |
| C18 | `plan-lifecycle.test.ts` `deletePlan of the active plan leaves every other plan's status as it was` | yes - pausado continua pausado, arquivado continua arquivado, nenhum promovido |
| C19 | `delete.spec.ts` `every plan on the plans screen and every archived plan in history offers Excluir plano` | yes - botão em cada item da tela "Planos" e em cada arquivado do Histórico |
| C20 | `delete.spec.ts` `a deleted archived plan is no longer listed in history` | yes - a aba some e o plano não existe no banco |
| C21 | `delete.spec.ts` `deleting a session asks for confirmation with the spec text` | yes - texto exato com `formatSessionDay` |
| C22 | `delete.spec.ts` `confirming deletes the session and its log and the dashboard no longer shows it` | yes - um card a menos, link da sessão ausente, sessão e log apagados |
| C23 | `plan-lifecycle.test.ts` `a deleted session does not count as missed when its week is reassessed` | yes - 3 de 3 restantes registradas: `missedTriggered: false`, `PROGRESS`; com a sessão presente 1 de 4 dispararia o sinal |
| C24 | `delete.spec.ts` `deleting the last session of a week is refused` | yes - alerta com o texto exato e a sessão continua no banco |
| C25 | `recalc.spec.ts` `postponing the race from settings rebuilds every week from the first` | yes - fase e início de cada semana iguais ao split de 9 semanas a partir do início original, e uma semana passada mudou de fase |
| C26 | `plan-lifecycle.test.ts` `editPlan keeps every logged session with its log on its date and adds no session on that day` | yes - as 7 sessões registradas idênticas com seus logs, cada uma sozinha no seu dia |
| C27 | `plan-lifecycle.test.ts` `editPlan derives the regenerated paces from currentVdot` | yes - cada sessão regenerada tem o pace de `currentVdot` 52 e não o de `initialVdot` |
| C28 | `plan-lifecycle.test.ts` `editPlan keeps every reassessed week reassessed` | yes - mesma linha, mesmo `reassessedAt`, ajuste mantido, `reassessIfDue` devolve null |
| C29 | `plan-lifecycle.test.ts` `editPlan refuses a race date that leaves fewer weeks than the current one` | no - um caso só, longe do limite (prova antes de hoje, 1 semana contra a semana 3); `totalWeeks <= currentWeek` ou `< currentWeek - 1` também passariam |
| C30 | `notes.spec.ts` `a note typed when logging is saved to the log` | yes - texto salvo em `WorkoutLog.notes` (já sem os espaços das pontas) |
| C31 | `notes.spec.ts` `a note over 500 characters is refused with the spec message` | yes - 501 recusado com o texto exato e nada salvo; 500 aceito no unit `parseNotes trims the note and accepts up to 500 characters` |
| C32 | `workout-log.test.ts` `parseNotes turns an empty or blank note into null` | yes - `""`, espaços, `\n\t`, null e undefined viram null |
| C33 | `notes.spec.ts` `editing a log shows its saved note in the field` | yes - `toHaveValue` com o texto salvo |
| C34 | `notes.spec.ts` `the dashboard card shows the note of a logged session` | yes - o card da sessão contém o texto |
| C35 | `delete.spec.ts` `the delete confirmation sits centered and whole on a phone screen` | yes - as duas confirmações dentro de 390x844, centradas em ±1px nos dois eixos, botões dentro da caixa |
| C36 | `plans.spec.ts` `with three plans the history fits a phone screen and its plan tabs scroll` | no - exclui os `li` das abas da checagem de borda e não confere `document.scrollWidth`, nem que a linha `.plan-tabs` rola (`scrollWidth > clientWidth`) ou fica numa linha só: sem `overflow-x: auto` as abas vazariam a página e `scrollIntoViewIfNeeded` rolaria a página, e o teste passaria; com `flex-wrap: wrap` também passaria |
| C37 | `plan-lifecycle.test.ts` `editPlan never brings back a deleted session, with a new race date or new days` | yes - adicionada ao fechar o achado; falha sem fd25924 e sem cef83b9 (verificado pelo autor) |
| C38 | `weekly-adjustment.test.ts` `maintain matches sessions by weekday when either week has a deleted session` | yes - adicionada ao fechar o achado; o código anterior devolvia as datas da semana avaliada + 7, não as da semana seguinte |
| C39 | `workout-log.test.ts` `parseNotes counts characters, not UTF-16 units: emoji and decomposed accents count as one` | yes - adicionada ao fechar o achado; 500 emojis eram recusados antes de 8a22031 |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| C29 não fixa o limite de `RECALC-05`: um limite deslocado em um não faria o teste falhar | `plan-lifecycle.test.ts` `editPlan refuses a race date...` usa só a prova 2026-11-06 (1 semana) com a semana atual 3. Exemplo próprio em HEAD: prova 2026-11-13 (2 semanas, dentro da semana atual) é recusada e 2026-11-14 (3 semanas) é aceita - o código está certo, o teste não prova isso | acrescentar ao teste os dois lados do limite: uma data que deixa `currentWeek - 1` semanas (recusada, `db` intacto) e uma que deixa exatamente `currentWeek` semanas (aceita) || f6c47b9 - o teste agora recusa 2026-11-13 (2 semanas, `db` intacto) e aceita 2026-11-14 (3 semanas); C29 |
| C36 não prova que as abas rolam na própria linha (`PLANS-15`) | `plans.spec.ts:195` - o filtro `!el.closest(".plan-tabs li")` tira as abas da checagem; não há `document.documentElement.scrollWidth <= 390` nem medida da `ul.plan-tabs`; o teste passa se as abas vazarem a página ou quebrarem em várias linhas | assertar `document.documentElement.scrollWidth <= 390`, `ul.scrollWidth > ul.clientWidth`, `ul.scrollLeft > 0` depois de `scrollIntoViewIfNeeded` na última aba, e o mesmo `top` para todas as abas || bceda1f - asserta `scrollWidth` da página ≤ 390, a linha de abas mais larga que sua área, `scrollLeft > 0` após rolar até a última e o mesmo `top` para todas; falha sem `overflow-x: auto`; C36 |
| Um treino excluído volta depois de mudar a data da prova e passa a contar como perdido - nenhuma check cobre a combinação `DEL-08`/`DEL-09` com `RECALC-01` | Exemplo próprio em HEAD (`editPlan`, plano 10K seg/qua/sáb iniciado 2026-10-24, hoje 2026-11-08): `deleteSession` da sessão de 2026-11-09 da semana 3, depois nova data da prova 2027-02-06 - a semana 3 volta a ter 2026-11-07, 2026-11-09, 2026-11-11. `rebuildWeeks` regenera toda sessão não registrada, sem saber quais foram excluídas; se o corredor não correr o treino recriado, a reavaliação o conta como perdido, o que `DEL-09` proíbe | decidir com o usuário se a exclusão sobrevive ao recálculo; se sim, guardar a exclusão (p.ex. dias excluídos por semana) e não regenerar esses dias, com novo requisito e check (o mesmo vale para o caminho de `EDIT-01` só com dias) || cef83b9 (DEL-13, C38: o `maintain` casava treinos por posição e movia o treino de dia) + fd25924 (DEL-12, C37: `rebuildWeeks` não recria um treino excluído; AD-006). O teste de C37 falha sem cada uma das duas correções |
| `NOTE-02` conta unidades UTF-16, não caracteres: uma observação com menos de 500 caracteres é recusada | `workout-log.ts` `parseNotes` usa `notes.length`. Exemplo próprio em HEAD: 251 emojis "🏃" (251 caracteres, 502 unidades) recusados com "Observação inválida: no máximo 500 caracteres."; 260 "é" em NFD (260 caracteres visíveis) também | contar com `Array.from(notes.normalize("NFC")).length` (ou `Intl.Segmenter`) e testar 500 emojis aceitos e 501 recusados || 8a22031 - `parseNotes` conta grafemas (`Intl.Segmenter`) após NFC; 500 emojis/"é" decompostos aceitos, 501 recusados; C39 |
