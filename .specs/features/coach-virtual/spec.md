# Coach Virtual Adaptativo Specification

**Approved**: 2026-11-05 - user: "spec aprovada"

## Problem Statement

Hoje o usuário planeja e registra seus treinos de corrida numa planilha. A planilha não tem noção
de um índice de fitness baseado em VDOT, não tem lógica de periodização, e não tem um ciclo de
retroalimentação: nada ajusta automaticamente o treino da semana seguinte com base no que
realmente aconteceu. Esta feature substitui a planilha por um web app single-user que gera um
plano periodizado a partir de uma prova-alvo e do fitness atual, e ajusta a carga da semana
seguinte a partir do que foi de fato registrado.

A v1 valida a lógica de geração/ajuste para uso pessoal (um usuário, entrada manual de dados). Os
limites de escopo, a metodologia e a maior parte do comportamento do produto já foram decididos
numa sessão de grilling dedicada com o usuário (ver `plano.md`) e são tratados como decisões
fechadas, não voltam a ser discutidos aqui. Esta spec transforma essas decisões em requisitos
testáveis e fecha as lacunas que o documento-fonte deixou implícitas (limiares exatos, transições
de status, regras de edição/exclusão).

## Goals

- [ ] O usuário consegue ir de "tenho uma prova e um teste de esforço recente" a um plano
  periodizado completo (base → build → peak → taper) em menos de 5 minutos.
- [ ] Depois de registrar uma semana de treinos, o plano da semana seguinte reflete
  automaticamente a regra dos 3 sinais (reduce/maintain/progress), sem intervenção manual.
- [ ] Um ciclo de vida completo do plano (criar → registrar semanas → retestar VDOT → finalizar
  prova → iniciar próximo plano) é percorrível de ponta a ponta sem perda de dados e sem edição
  manual no banco.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Multiusuário / cadastro público | A v1 é explicitamente single-user; decidido no grilling. |
| Integração com Strava/Garmin ou qualquer GPS/dispositivo | A v1 usa só entrada manual pós-treino; decidido no grilling. |
| Tipo de treino Repetição e treino no pace exato de prova | Adiados para a v2; decidido no grilling. |
| Provas além de 5km/10km/21km/42km | Só essas 4 distâncias são suportadas na v1; decidido no grilling. |
| Fluxo de "esqueci minha senha" | A conta única é provisionada via variável de ambiente no deploy; sem recuperação self-service na v1. |
| Apagar um plano, uma entrada do histórico de VDOT, ou um resultado de prova | O histórico é permanente/append-only na v1; sem edições destrutivas de histórico. |
| Notificações push / lembretes por e-mail (reteste de VDOT, sessões perdidas) | A v1 só mostra lembretes passivamente na UI; não existe canal de notificação. |
| Cronômetro/timer no app para o teste de esforço guiado | O usuário faz o teste com o próprio relógio e digita o resultado num formulário depois. |
| Jobs agendados/em background (cron) | A reavaliação semanal e os prompts de reteste são calculados de forma lazy ao carregar a página, não por um agendador. |

---

## Assumptions & Open Questions

Toda ambiguidade foi resolvida ou registrada aqui. Itens marcados `y` foram confirmados
explicitamente pelo usuário; itens marcados `y - delegated` são defaults de implementação dentro
de limites que o usuário explicitamente delegou ao assistente (ex.: "ajustável durante a
implementação").

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Trigger da reavaliação semanal | Calculado de forma lazy na primeira vez que o usuário abre o dashboard na/depois da data de fim da semana; sem cron. | Usuário confirmou; evita infraestrutura de agendador para um app single-user. | y |
| UX do teste de esforço guiado | Tela de instruções + formulário para digitar o resultado depois (sem cronômetro no app). | Usuário confirmou; consistente com a decisão de "sem GPS nativo". | y |
| Editar/apagar um `WorkoutLog` | Livremente editável e apagável em qualquer momento. | Usuário confirmou; dado pessoal, não auditado. | y |
| Detecção de `Session.status = missed` | Automática: uma sessão fica `missed` quando `date < hoje` e não existe `WorkoutLog` referenciando-a; recalculado na leitura, não armazenado como flag unidirecional. | Usuário confirmou. | y |
| Dias de treino por semana | Precisa ser entre 3 e 6 dias; o app rejeita a criação/edição do plano fora dessa faixa, com uma mensagem explicativa. | Usuário confirmou; <3 não permite rotacionar fácil/longo/tempo/intervalado, 7 não deixa nenhum dia de descanso. | y |
| Entrada do `RaceResult` ao fim do plano | Opcional. O app avisa no dashboard assim que o plano fica `archived`; o usuário pode ignorar e começar um plano novo mesmo assim, que então usa o último `currentVdot` conhecido. | Usuário confirmou. | y |
| Provisionamento da conta | Conta única semeada via variáveis de ambiente (usuário + hash da senha) no deploy/build; não existe tela de cadastro em nenhum lugar do app. | Usuário confirmou. | y |
| Limiares dos sinais de fadiga | Pace: pace médio real da semana ≥5% mais lento que o pace médio planejado da semana. RPE: RPE médio registrado na semana ≥8 (escala 1–10). Perdidos: proporção de sessões perdidas ≥25% das sessões planejadas daquela semana. | Usuário confirmou ("Moderado"). | y |
| Manter vs. progredir quando <2 sinais disparam | 0 de 3 sinais → progride (avança para a semana seguinte exatamente como originalmente gerada). Exatamente 1 de 3 → mantém (repete o plano da semana atual sem alteração, sem avançar). 2 ou 3 → reduz. | Usuário confirmou. | y |
| Magnitude do "reduce" | Corta a distância/duração planejada de cada sessão restante em 20%; rebaixa as sessões de Tempo daquela semana para pace Fácil e as sessões de Intervalado para pace de Tempo (um degrau de intensidade abaixo). | Usuário delegou o ajuste fino exato ("ajustável durante a implementação" se aplica aos parâmetros numéricos do algoritmo); baixo risco de produto, fácil de reajustar depois do MVP. | y - delegated |
| Durações mínimas de plano por tipo de prova | 5km: 8 semanas. 10km: 10 semanas. 21km: 12 semanas. 42km: 16 semanas. Se o número de semanas até a prova ficar abaixo do mínimo, o plano é gerado mesmo assim (comprimido), com um aviso visível. | O plano.md deu 5km/42km como exemplos e disse explicitamente "ajustável durante a implementação"; 10km/21km foram interpolados usando referências padrão de periodização. | y - delegated |
| Proporções das fases dentro do plano | Taper = `ceil(10% de N)` semanas, limitado a [1,3]. Das semanas restantes: Base 40%, Build 35%, Peak 25%, resto do arredondamento somado à Base. | O plano.md confirmou a distribuição proporcional de fases, mas deixou as proporções exatas para a implementação. | y - delegated |
| Ciclo de vida de `Plan.status` | Apenas dois estados: `active` (data da prova ≥ hoje) e `archived` (data da prova < hoje). O esboço de modelo de dados no plano.md citava também `completed`; isso foi colapsado aqui porque a prosa só descreve uma transição (active → archived), e a presença/ausência de `RaceResult` é rastreada como uma relação opcional própria, não como um terceiro status. | Simplifica a máquina de estados sem alterar nenhum comportamento descrito; é um detalhe de modelagem, não uma mudança de comportamento de produto. | y - delegated |
| Fórmula de VDOT e tabelas de pace por zona | Fórmula padrão de VDOT de Jack Daniels e as tabelas de pace de treino associadas (publicadas, não rederivadas aqui). | Fato a ser buscado durante Design/Execute, não uma decisão de produto. | n/a - fact, not decision |
| Limites de entrada | Distância: 0 < km ≤ 200 por sessão. Duração: 0 < minutos ≤ 600. Pace: precisa ser interpretável como `mm:ss/km` e > 0. RPE: inteiro entre 1 e 10 inclusive. | Guard-rails razoáveis contra erro de digitação; não é uma decisão de comportamento de produto. | y - delegated |
| Baseline de segurança da autenticação | Senha armazenada com hash (bcrypt ou equivalente); cookie de sessão, HTTPS obrigatório em produção. Sem rate-limiting/lockout na v1. | Segurança mínima viável para um "login simples"; rate-limiting está explicitamente fora de escopo — usuário único, app não divulgado publicamente. | y - delegated |
| Concorrência | N/A — usuário único, nenhuma escrita simultânea esperada. | Dimensão fora de escopo para a escala deste app. | n/a |
| Observabilidade | N/A — depende dos logs padrão de request/erro da plataforma de hospedagem; sem métricas/tracing customizados. | App de uso pessoal, não operado numa escala que precise de observabilidade customizada. | n/a |
| Falha de dependência externa | N/A — a v1 não tem integrações externas (Strava/Garmin explicitamente fora de escopo). | Não existe dependência externa para falhar. | n/a |
| Ciclo de vida / expiração de dados | N/A além do arquivamento — `Plan`, `VdotHistory`, `Session`, `WorkoutLog`, `RaceResult` são retidos indefinidamente; sem TTL/expiração/exclusão na v1. | Confirmado: "histórico de planos e VDOTs é mantido." | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

Todas as histórias abaixo são **P1 (MVP)** — o plano.md já definiu isso como um MVP atômico em
que cada parte é necessária para validar o algoritmo; não existe tier P2/P3 para a v1. Os itens
adiados estão em *Out of Scope*.

### P1-A: Login ⭐ MVP

**User Story**: Como o único usuário, eu quero entrar na minha própria conta protegida para que
meus dados de treino fiquem privados e persistentes entre dispositivos.

**Why P1**: Nada mais é acessível sem autenticação; o app precisa funcionar tanto no navegador do
celular quanto no do computador, contra a mesma conta.

**Acceptance Criteria**:

1. WHEN o usuário envia usuário e senha corretos THEN the system SHALL criar uma sessão
   autenticada e redirecionar para o dashboard. `AUTH-01`
2. IF o usuário envia usuário ou senha incorretos THEN the system SHALL rejeitar o login e
   mostrar uma mensagem genérica de "credenciais inválidas", sem revelar qual campo estava
   errado. `AUTH-02`
3. WHILE nenhuma sessão está ativa the system SHALL redirecionar qualquer requisição a uma
   página protegida para a tela de login. `AUTH-03`
4. The system SHALL armazenar a senha da conta apenas como hash salgado, nunca em texto puro.
   `AUTH-04`
5. The system SHALL provisionar exatamente uma conta, a partir de variáveis de ambiente no
   deploy; nenhum caminho de UI para criar, listar ou registrar uma conta adicional SHALL existir.
   `AUTH-05`

**Independent Test**: Semear uma conta via variáveis de ambiente, iniciar o app, confirmar que o
login funciona com credenciais corretas e falha com as incorretas, e que `/dashboard` redireciona
para `/login` quando deslogado.

---

### P1-B: VDOT inicial e criação do plano ⭐ MVP

**User Story**: Como usuário, eu quero criar um novo plano de treino a partir de uma prova-alvo e
do meu fitness atual para obter paces prontos para a prova sem fazer as contas de periodização eu
mesmo.

**Why P1**: É o ponto de entrada de todo o sistema — nenhum plano existe até esse fluxo rodar.

**Acceptance Criteria**:

1. WHEN o usuário inicia um plano novo e não tem VDOT prévio registrado THEN the system SHALL
   oferecer duas formas de estabelecer um VDOT inicial: um teste de esforço guiado (5km ou 20
   minutos) ou a entrada manual de um tempo de prova recente conhecido. `VDOT-01`
2. WHEN o usuário escolhe o teste de esforço guiado THEN the system SHALL mostrar instruções do
   tipo de teste escolhido e apresentar um formulário para digitar o tempo/distância resultante
   depois de o usuário tê-lo corrido por conta própria. `VDOT-02`
3. WHEN um resultado que estabelece o VDOT (teste ou tempo manual) é enviado THEN the system
   SHALL calcular um valor de VDOT usando a fórmula de VDOT de Jack Daniels e registrá-lo como
   uma entrada de `VdotHistory` com `source` = `test` ou `manual` conforme o caso. `VDOT-03`
4. WHEN o usuário escolhe um tipo de prova (5km/10km/21km/42km) e uma data de prova THEN the
   system SHALL calcular a duração do plano em semanas como `raceDate − hoje`. `PLAN-01`
5. IF a duração calculada do plano estiver abaixo do mínimo recomendado para aquele tipo de prova
   (5km: 8, 10km: 10, 21km: 12, 42km: 16 semanas) THEN the system SHALL gerar o plano mesmo assim
   (comprimido) e SHALL mostrar um aviso visível nomeando o déficit. `PLAN-02`
6. WHEN o usuário escolhe os dias de treino (3 a 6 dias por semana) THEN the system SHALL aceitar
   a seleção e distribuir os tipos de treino exatamente nesses dias em todas as semanas. `PLAN-03`
7. IF o usuário escolhe menos de 3 ou mais de 6 dias de treino THEN the system SHALL rejeitar a
   seleção e explicar a faixa permitida (3–6). `PLAN-04`
8. WHEN um plano é gerado THEN the system SHALL criar uma linha `Week` por semana com uma `phase`
   (base/build/peak/taper) atribuída por divisão proporcional: taper = `ceil(10% de N)` semanas
   limitado a [1,3]; das semanas restantes, base 40% / build 35% / peak 25% (resto do
   arredondamento somado à base). `PLAN-05`
9. WHEN as sessões de uma `Week` são geradas THEN the system SHALL atribuir a cada dia de treino
   um tipo de treino (Fácil, Longão, Tempo/Limiar, Intervalado) com peso maior para Fácil/Longão
   durante a base e para Tempo/Intervalado durante build/peak, com volume e intensidade reduzidos
   durante o taper. `PLAN-06`
10. WHEN uma `Session` é gerada THEN the system SHALL calcular seu pace planejado e sua
    distância/duração planejada a partir do VDOT vigente do plano e do tipo de treino da sessão.
    `PLAN-07`
11. The system SHALL suportar a geração de um plano para exatamente uma destas provas: 5km, 10km,
    21km, 42km. `PLAN-08`

**Independent Test**: Criar um plano para uma prova de 10km a ~10 semanas de distância usando um
tempo de 5km digitado manualmente; confirmar que o plano tem ~10 linhas `Week` com as fases nas
proporções esperadas e que toda `Session` tem um pace planejado não nulo.

---

### P1-C: Dashboard semanal ⭐ MVP

**User Story**: Como usuário, eu quero ver as sessões planejadas desta semana e seus paces-alvo
para saber exatamente o que correr a seguir.

**Why P1**: É a tela que o usuário abre antes de cada corrida.

**Acceptance Criteria**:

1. WHEN o usuário abre o dashboard THEN the system SHALL mostrar as sessões da semana atual em
   ordem de data, cada uma com tipo de treino, pace planejado e distância/duração planejada.
   `DASH-01`
2. WHEN a data planejada de uma sessão já passou e não existe `WorkoutLog` para ela THEN the
   dashboard SHALL exibir essa sessão como `missed`. `DASH-02`
3. WHEN uma sessão tem um `WorkoutLog` associado THEN the dashboard SHALL exibir essa sessão como
   `done`, mostrando o pace real registrado ao lado do pace planejado. `DASH-03`
4. WHILE a data de hoje está na/depois da data de fim de uma semana e essa semana ainda não foi
   reavaliada THEN abrir o dashboard SHALL disparar a reavaliação semanal (ver `ADJ-*`) antes de
   renderizar as sessões da semana seguinte. `DASH-04`
5. WHILE o `currentVdot` do plano ativo está devido para reteste (≥4 semanas desde a última
   entrada de `VdotHistory`) THEN the dashboard SHALL mostrar um aviso visível de reteste.
   `VDOT-04`

**Independent Test**: Com um plano que tenha pelo menos 2 semanas geradas, abrir o dashboard antes
e depois de avançar artificialmente a data de fim da semana 1; confirmar que os estados
missed/done renderizam corretamente e que a semana 2 reflete a decisão de ajuste correta.

---

### P1-D: Registro de treino ⭐ MVP

**User Story**: Como usuário, eu quero registrar o que eu de fato fiz depois de uma corrida para
que o sistema possa comparar com o plano.

**Why P1**: Sem dados registrados não há nada para o algoritmo de ajuste reagir.

**Acceptance Criteria**:

1. WHEN o usuário envia um registro de treino para uma sessão com pace, distância, duração e RPE
   THEN the system SHALL salvar um `WorkoutLog` vinculado a essa sessão e marcar a sessão como
   `done`. `LOG-01`
2. IF a distância não estiver em `(0, 200]` km, a duração não estiver em `(0, 600]` minutos, o
   pace não puder ser interpretado como um valor positivo em `mm:ss/km`, ou o RPE não for um
   inteiro em `[1, 10]` THEN the system SHALL rejeitar o envio e mostrar qual campo é inválido.
   `LOG-02`
3. WHEN o usuário edita um `WorkoutLog` existente THEN the system SHALL sobrescrever os valores
   armazenados com os novos. `LOG-03`
4. WHEN o usuário apaga um `WorkoutLog` existente THEN the system SHALL removê-lo e recalcular o
   status da sessão correspondente (`missed` se a data já passou, `pending` caso contrário).
   `LOG-04`
5. The system SHALL permitir registrar, editar ou apagar um `WorkoutLog` para qualquer sessão,
   independente de a semana dessa sessão já ter sido reavaliada. `LOG-05`

**Independent Test**: Registrar um treino para a sessão de hoje, confirmar que aparece como `done`
no dashboard; editar o RPE, confirmar que o novo valor persiste; apagá-lo, confirmar que a sessão
volta corretamente para `pending`/`missed`.

---

### P1-E: Reavaliação e ajuste semanal ⭐ MVP

**User Story**: Como usuário, eu quero que o plano da semana seguinte fique mais leve
automaticamente quando eu estiver sobrecarregado, e progrida normalmente quando não estiver, para
que o plano se adapte ao meu estado real de treino sem eu precisar pensar nisso.

**Why P1**: É o comportamento adaptativo central que todo o app existe para validar.

**Acceptance Criteria**:

1. WHEN uma semana termina (hoje ≥ data de fim da semana) e ainda não foi reavaliada THEN the
   system SHALL calcular três sinais para essa semana: (a) desvio de pace = pace médio registrado
   ≥5% mais lento que o pace médio planejado das sessões registradas daquela semana, (b) RPE = RPE
   médio registrado ≥8, (c) proporção perdida = sessões perdidas / sessões planejadas daquela
   semana ≥25%. `ADJ-01`
2. WHEN 2 ou 3 dos sinais em `ADJ-01` são verdadeiros THEN the system SHALL definir o
   `WeeklyAdjustment.decision` dessa semana como `reduce`, cortar a distância/duração planejada
   restante de cada sessão da semana seguinte em 20%, e rebaixar as sessões de Tempo dessa semana
   para pace Fácil e as sessões de Intervalado para pace de Tempo. `ADJ-02`
3. WHEN exatamente 1 dos sinais em `ADJ-01` é verdadeiro THEN the system SHALL definir a decisão
   como `maintain` e regerar as sessões da semana seguinte idênticas às sessões planejadas da
   semana atual (mesmos tipos, paces, distâncias), sem avançar a periodização. `ADJ-03`
4. WHEN 0 dos sinais em `ADJ-01` é verdadeiro THEN the system SHALL definir a decisão como
   `progress` e deixar a semana seguinte exatamente como originalmente gerada por
   `PLAN-05`–`PLAN-07`. `ADJ-04`
5. WHEN uma reavaliação roda THEN the system SHALL persistir uma linha `WeeklyAdjustment`
   registrando os 3 valores de sinal calculados, a decisão, e o % de ajuste aplicado. `ADJ-05`
6. The system SHALL reavaliar cada semana no máximo uma vez; reabrir o dashboard depois de uma
   semana já ter sido reavaliada SHALL NOT recalcular nem reaplicar o ajuste. `ADJ-06`

**Independent Test**: Registrar uma semana de sessões com RPE ≥8 e pace ≥5% mais lento que o alvo
em pelo menos 2 das 3 dimensões de sinal; confirmar que as sessões da semana seguinte mostram
distância reduzida e intensidade rebaixada, e que existe uma linha `WeeklyAdjustment` com
`decision = reduce`.

---

### P1-F: Reteste de VDOT ⭐ MVP

**User Story**: Como usuário, eu quero ser avisado para retestar meu VDOT periodicamente para que
meus paces continuem precisos conforme meu fitness muda.

**Why P1**: Confirmado no grilling como obrigatório para a v1; paces desatualizados tornariam todo
o plano errado.

**Acceptance Criteria**:

1. WHILE a entrada mais recente de `VdotHistory` do plano ativo tem ≥4 semanas THEN the system
   SHALL mostrar um aviso de reteste no dashboard, reaproveitando o mesmo fluxo de teste guiado de
   `VDOT-01`/`VDOT-02`. `VDOT-05`
2. WHEN o usuário envia um novo resultado de teste pelo aviso de reteste THEN the system SHALL
   adicionar uma nova entrada de `VdotHistory` com `source = recalc`, atualizar o
   `Plan.currentVdot`, e recalcular os paces planejados de todas as sessões ainda não feitas na
   semana atual e nas futuras. `VDOT-06`
3. WHEN o usuário descarta o aviso de reteste sem enviar um resultado THEN the system SHALL
   esconder o aviso por aquele dia e mostrá-lo de novo na próxima visita ao dashboard. `VDOT-07`

**Independent Test**: Ajustar a última entrada de `VdotHistory` de um plano para 5 semanas atrás,
abrir o dashboard, confirmar que o aviso aparece; enviar um novo resultado de teste e confirmar que
os paces planejados das sessões futuras mudam de acordo.

---

### P1-G: Histórico e progresso ⭐ MVP

**User Story**: Como usuário, eu quero ver como meu pace, VDOT e aderência evoluíram ao longo do
plano para saber se o plano está funcionando.

**Why P1**: Citada explicitamente como uma das 5 telas do MVP no grilling.

**Acceptance Criteria**:

1. WHEN o usuário abre a tela de histórico/progresso THEN the system SHALL mostrar um gráfico de
   VDOT ao longo do tempo, construído a partir de todas as entradas de `VdotHistory` do plano
   atual (e, se o usuário navegar para um plano anterior, as entradas desse plano). `HIST-01`
2. WHEN o usuário abre a tela de histórico/progresso THEN the system SHALL mostrar um gráfico de
   pace real vs. planejado por sessão registrada, e uma métrica de aderência (sessões done /
   sessões planejadas) por semana, para o plano selecionado. `HIST-02`
3. WHEN o usuário seleciona um plano passado (archived) na tela de histórico THEN the system
   SHALL mostrar os gráficos daquele plano e seu `RaceResult`, se houver um registrado. `HIST-03`
4. IF um plano ainda não tem sessões registradas THEN the history screen SHALL mostrar um estado
   vazio explícito em vez de um gráfico vazio. `HIST-04`

**Independent Test**: Com pelo menos 2 semanas de dados registrados, abrir a tela de histórico e
confirmar que o gráfico de VDOT, o gráfico de pace e os números de aderência semanal correspondem
às linhas de `WorkoutLog` e `VdotHistory` subjacentes.

---

### P1-H: Ciclo de vida do plano — finalizar um plano e iniciar o próximo ⭐ MVP

**User Story**: Como usuário, eu quero que o app carregue meu fitness de uma prova para a próxima
para que eu não precise redigitar meu VDOT toda vez.

**Why P1**: Confirmado no grilling como o mecanismo que liga os planos ao longo do tempo.

**Acceptance Criteria**:

1. WHEN a data de hoje passa a `raceDate` do plano ativo THEN the system SHALL definir o `status`
   desse plano como `archived` e parar de gerar ou editar suas sessões. `LIFE-01`
2. WHEN um plano fica `archived` e ainda não tem `RaceResult` THEN the dashboard SHALL mostrar um
   aviso pedindo o tempo final da prova. `LIFE-02`
3. WHEN o usuário envia um tempo final por esse aviso THEN the system SHALL salvar um
   `RaceResult` vinculado a esse plano, calcular um VDOT a partir dele, e adicionar uma entrada de
   `VdotHistory` com `source = race`. `LIFE-03`
4. WHEN o usuário inicia um plano novo enquanto um plano `archived` não tem `RaceResult` THEN the
   system SHALL permitir, usando o último `currentVdot` do plano arquivado como o VDOT inicial do
   novo plano. `LIFE-04`
5. WHEN o usuário inicia um plano novo e o plano arquivado mais recente tem um `RaceResult` THEN
   the system SHALL preencher por padrão o VDOT inicial do novo plano com o VDOT calculado a
   partir desse `RaceResult`, editável antes de confirmar. `LIFE-05`
6. The system SHALL permitir no máximo um plano `active` por vez. `LIFE-06`

**Independent Test**: Ajustar a `raceDate` de um plano para ontem, abrir o dashboard, confirmar
que o aviso de resultado aparece e que o plano está `archived`; enviar um tempo final, iniciar um
plano novo, e confirmar que seu VDOT inicial corresponde ao calculado a partir desse resultado.

---

### P1-I: Editar um plano em andamento ⭐ MVP

**User Story**: Como usuário, eu quero mudar a data da minha prova ou meus dias de treino no meio
do plano sem perder o que já registrei.

**Why P1**: Confirmado no grilling; imprevistos acontecem no meio de um ciclo de treino.

**Acceptance Criteria**:

1. WHEN o usuário muda a data da prova ou os dias de treino do plano ativo THEN the system SHALL
   recalcular as linhas `Week` e `Session` a partir da semana atual em diante, deixando todas as
   semanas passadas e seus `WorkoutLog`s intocados. `EDIT-01`
2. IF a nova data da prova ou o novo número de dias por semana violar as restrições de
   `PLAN-02`/`PLAN-04` THEN the system SHALL rejeitar a edição com a mesma mensagem de validação
   usada na criação do plano. `EDIT-02`
3. WHEN um plano é recalculado via `EDIT-01` THEN the system SHALL rederivar as fases e sessões
   das semanas futuras a partir do `currentVdot` do plano no momento da edição, não do seu
   `initialVdot` original. `EDIT-03`

**Independent Test**: No meio de um plano, mudar a data da prova para adicionar 3 semanas;
confirmar que as semanas já registradas ficam inalteradas e que as semanas novas aparecem com as
fases corretamente reproporcionadas.

---

### P1-J: Configurações ⭐ MVP

**User Story**: Como usuário, eu quero um lugar único para ver e mudar a configuração do plano
ativo.

**Why P1**: Citada explicitamente como uma das 5 telas do MVP no grilling.

**Acceptance Criteria**:

1. WHEN o usuário abre as configurações THEN the system SHALL mostrar o tipo de prova, a data da
   prova, os dias de treino e o VDOT atual do plano ativo. `SET-01`
2. WHEN o usuário muda a data da prova ou os dias de treino a partir das configurações THEN the
   system SHALL aplicar o mesmo comportamento de recálculo de `EDIT-01`–`EDIT-03`. `SET-02`
3. IF não existe plano ativo THEN the settings screen SHALL dizer isso e linkar para a criação de
   plano em vez de mostrar campos vazios. `SET-03`

**Independent Test**: Abrir as configurações com um plano ativo, mudar os dias de treino,
confirmar que ocorre o mesmo recálculo de `P1-I` e que os novos dias aparecem imediatamente nas
configurações.

---

## Edge Cases

- IF o usuário tenta criar um segundo plano `active` enquanto já existe um THEN the system SHALL
  rejeitar, conforme `LIFE-06`.
- IF um `WorkoutLog` é registrado para uma sessão cuja data está no futuro THEN the system SHALL
  aceitar (sem restrição para registrar adiantado) e marcar a sessão como `done`.
- IF a reavaliação semanal roda para uma semana com zero sessões registradas THEN os três sinais
  resolvem só com os dados disponíveis: desvio de pace e RPE são tratados como não disparados (sem
  dado para comparar), e a proporção perdida é 100% — então uma semana totalmente não registrada
  sempre dispara pelo menos o sinal de perdidos.
- IF o usuário envia o fluxo de VDOT (teste guiado ou tempo manual) com um tempo fisicamente
  implausível para a distância informada (ex.: 5km em menos de 2 minutos) THEN the system SHALL
  rejeitar como entrada inválida (mesma classe de validação de `LOG-02`).
- WHEN a última semana de um plano (taper) termina e a data da prova ainda não chegou
  (arredondamento de borda) THEN the dashboard SHALL mostrar de novo as sessões da semana de taper
  existente, em vez de gerar uma semana vazia.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| AUTH-01 | P1-A: Login | Tasks | In Tasks |
| AUTH-02 | P1-A: Login | Tasks | In Tasks |
| AUTH-03 | P1-A: Login | Tasks | In Tasks |
| AUTH-04 | P1-A: Login | Tasks | In Tasks |
| AUTH-05 | P1-A: Login | Tasks | In Tasks |
| VDOT-01 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| VDOT-02 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| VDOT-03 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| VDOT-04 | P1-C: Dashboard semanal | Tasks | In Tasks |
| VDOT-05 | P1-F: Reteste de VDOT | Tasks | In Tasks |
| VDOT-06 | P1-F: Reteste de VDOT | Tasks | In Tasks |
| VDOT-07 | P1-F: Reteste de VDOT | Tasks | In Tasks |
| PLAN-01 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-02 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-03 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-04 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-05 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-06 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-07 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| PLAN-08 | P1-B: VDOT inicial e criação do plano | Tasks | In Tasks |
| DASH-01 | P1-C: Dashboard semanal | Tasks | In Tasks |
| DASH-02 | P1-C: Dashboard semanal | Tasks | In Tasks |
| DASH-03 | P1-C: Dashboard semanal | Tasks | In Tasks |
| DASH-04 | P1-C: Dashboard semanal | Tasks | In Tasks |
| LOG-01 | P1-D: Registro de treino | Tasks | In Tasks |
| LOG-02 | P1-D: Registro de treino | Tasks | In Tasks |
| LOG-03 | P1-D: Registro de treino | Tasks | In Tasks |
| LOG-04 | P1-D: Registro de treino | Tasks | In Tasks |
| LOG-05 | P1-D: Registro de treino | Tasks | In Tasks |
| ADJ-01 | P1-E: Reavaliação e ajuste semanal | Tasks | In Tasks |
| ADJ-02 | P1-E: Reavaliação e ajuste semanal | Tasks | In Tasks |
| ADJ-03 | P1-E: Reavaliação e ajuste semanal | Tasks | In Tasks |
| ADJ-04 | P1-E: Reavaliação e ajuste semanal | Tasks | In Tasks |
| ADJ-05 | P1-E: Reavaliação e ajuste semanal | Tasks | In Tasks |
| ADJ-06 | P1-E: Reavaliação e ajuste semanal | Tasks | In Tasks |
| HIST-01 | P1-G: Histórico e progresso | Tasks | In Tasks |
| HIST-02 | P1-G: Histórico e progresso | Tasks | In Tasks |
| HIST-03 | P1-G: Histórico e progresso | Tasks | In Tasks |
| HIST-04 | P1-G: Histórico e progresso | Tasks | In Tasks |
| LIFE-01 | P1-H: Ciclo de vida do plano | Tasks | In Tasks |
| LIFE-02 | P1-H: Ciclo de vida do plano | Tasks | In Tasks |
| LIFE-03 | P1-H: Ciclo de vida do plano | Tasks | In Tasks |
| LIFE-04 | P1-H: Ciclo de vida do plano | Tasks | In Tasks |
| LIFE-05 | P1-H: Ciclo de vida do plano | Tasks | In Tasks |
| LIFE-06 | P1-H: Ciclo de vida do plano | Tasks | In Tasks |
| EDIT-01 | P1-I: Editar um plano em andamento | Tasks | In Tasks |
| EDIT-02 | P1-I: Editar um plano em andamento | Tasks | In Tasks |
| EDIT-03 | P1-I: Editar um plano em andamento | Tasks | In Tasks |
| SET-01 | P1-J: Configurações | Tasks | In Tasks |
| SET-02 | P1-J: Configurações | Tasks | In Tasks |
| SET-03 | P1-J: Configurações | Tasks | In Tasks |

**ID format:** `[CATEGORY]-[NUMBER]`.

**Status values:** Pending → In Design → In Tasks → Implementing → Verified.

**Coverage:** 51 total, 51 mapped to tasks, 0 unmapped.

---

## Sources

- `plano.md` - as decisões da sessão de grilling que esta spec formaliza: metodologia
  (VDOT/Jack Daniels), stack (Next.js + Prisma + Supabase/Postgres + Vercel), provas suportadas,
  esboço de modelo de dados, passos do algoritmo central, e fases de construção. Tratado como
  decisões de produto fechadas, não como inspiração.

---

## Success Criteria

- [ ] O usuário consegue criar um plano de 10km a partir de um tempo de 5km digitado manualmente e
  ver o plano completo semana a semana, com a distribuição de fases correta, em menos de 5
  minutos.
- [ ] Registrar uma semana com RPE ≥8 e pace ≥5% fora do alvo em ≥2 sinais produz uma decisão
  `reduce` e uma semana seguinte visivelmente mais leve, sem nenhuma intervenção manual.
- [ ] Um plano completo pode ser conduzido da criação até a entrada do resultado no dia da prova e
  até um plano novo, sem tocar diretamente no banco de dados.
