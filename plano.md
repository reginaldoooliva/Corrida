# Plano: Coach Virtual Adaptativo (app de treino de corrida)

## Contexto

O usuário hoje controla seus treinos de corrida em planilha e quer substituí-la por um
app que funcione como um "personal trainer" digital: gera um plano de treino
periodizado a partir de uma prova-alvo e do nível de fitness atual, e ajusta a carga
da semana seguinte com base no que foi realmente registrado. A ideia foi escolhida
entre 3 opções levantadas em pesquisa de mercado (apps como Runna, TrainingPeaks,
Paceflow, Kiprun Pacer) e todo o escopo foi definido numa sessão de perguntas
dirigidas (grilling) com o usuário — as respostas abaixo são decisões já confirmadas,
não suposições do planejador.

Objetivo da v1: validar a lógica de geração/ajuste de plano para uso pessoal (um único
usuário), antes de considerar evoluções como multiusuário ou integração com
Strava/Garmin.

## Decisões confirmadas (grilling)

- **Usuários**: single-user. Sem cadastro público; só uma conta protegida por
  login simples (usuário/senha).
- **Plataforma**: web app (funciona em desktop e celular via navegador).
- **Entrada de dados**: registro manual pós-treino (pace, distância, tempo, RPE
  1-10). Sem GPS nativo nem integração com Strava/Garmin na v1.
- **Metodologia**: VDOT / Jack Daniels — paces de treino derivados de um índice de
  fitness (VDOT) calculado a partir de um teste de esforço ou prova recente.
- **Provas suportadas**: 5km, 10km, 21km (meia maratona), 42km (maratona).
- **Arquitetura**: hospedado na nuvem com backend + banco de dados (não é um app
  só-no-navegador), para acessar o plano tanto do celular quanto do PC.
- **Stack**: Next.js (frontend + API routes num só projeto) + Postgres via Supabase
  + Prisma como ORM, deploy no Vercel.
- **Fallback de VDOT inicial**: teste de esforço guiado (5km ou 20min "time trial")
  como padrão, com opção de digitar manualmente um tempo de prova já conhecido.
- **Duração do plano**: calculada automaticamente a partir da data da prova-alvo
  (hoje → data da prova = N semanas), com fases base/build/peak/taper distribuídas
  proporcionalmente e aviso se N for menor que o mínimo recomendado para o tipo de
  prova.
- **Dias de treino**: definidos manualmente pelo usuário no cadastro do plano; o
  algoritmo distribui os tipos de treino dentro desses dias.
- **Tipos de treino no MVP**: Fácil, Longão, Tempo/Limiar, Intervalado (Repetição e
  treino no pace exato de prova ficam para uma v2).
- **Reajuste do plano**: semanal (não por treino individual), baseado numa regra
  composta de 3 sinais: (1) desvio de pace médio vs. alvo, (2) RPE médio alto,
  (3) treinos perdidos/não registrados. Se ≥2 de 3 sinais indicarem fadiga, reduz
  volume/intensidade da semana seguinte; caso contrário mantém ou progride a carga
  conforme a periodização.
- **Recalibração de VDOT**: reteste sugerido a cada ~4 semanas durante o plano.
- **Histórico de planos**: ao passar a data da prova, o plano é arquivado e um novo
  pode ser criado para a próxima prova-alvo; histórico de planos e VDOTs é mantido.
- **Resultado da prova**: ao fim do plano, o app pede o tempo final da prova, que
  se torna o VDOT de referência inicial do próximo plano.
- **Edição de plano em andamento**: mudar a data da prova ou os dias de treino
  recalcula o plano a partir da semana atual, preservando o que já foi registrado.
- **Telas do MVP** (5): Onboarding/novo plano, Dashboard da semana atual, Registro
  de treino, Histórico/progresso (gráficos de pace/VDOT/aderência), Configurações
  do plano ativo.

## Modelo de dados (Prisma / Postgres)

- `Plan`: raceType, raceDate, startDate, daysPerWeek (array de dias), status
  (active/completed/archived), initialVdot, currentVdot.
- `VdotHistory`: planId, date, vdot, source (test | manual | race | recalc).
- `Week`: planId, weekNumber, phase (base/build/peak/taper).
- `Session`: weekId, type (easy/long/tempo/interval), date, plannedPace,
  plannedDistanceOrDuration, status (pending/done/missed).
- `WorkoutLog`: sessionId, actualPace, actualDistance, actualDuration, rpe, notes,
  loggedAt.
- `WeeklyAdjustment`: weekId, sinais calculados (paceDeviation, rpeAvg,
  missedCount), decisão (reduce/maintain/progress), % de ajuste aplicado.
- `RaceResult`: planId, finishTime, date — alimenta o VDOT do próximo plano.

## Lógica central do algoritmo

1. **VDOT inicial**: teste de esforço guiado ou tempo de prova manual → fórmula
   VDOT (Jack Daniels) → paces por tipo de treino.
2. **Geração do plano**: N semanas = data da prova − hoje; fases distribuídas
   proporcionalmente com mínimos recomendados por prova (ex.: ~8 sem. para 5km,
   ~18 sem. para 42km — ajustável durante a implementação).
3. **Estrutura semanal**: dias definidos pelo usuário recebem os 4 tipos de treino
   conforme a fase atual (ex.: mais volume fácil na base, mais intensidade no
   build/peak, redução no taper).
4. **Paces**: calculados a partir do VDOT vigente para cada tipo de treino.
5. **Registro pós-treino**: pace, distância, tempo, RPE.
6. **Reavaliação semanal**: ao fim de cada semana, calcula os 3 sinais e decide
   reduzir, manter ou progredir a carga da semana seguinte.
7. **Reteste de VDOT**: prompt a cada 4 semanas para recalibrar os paces.
8. **Fim de plano**: registra resultado da prova → novo VDOT de referência → plano
   arquivado → pode iniciar um novo.
9. **Edição em andamento**: recalcula a partir da semana atual ao mudar data da
   prova ou dias de treino, preservando o histórico já registrado.

## Fases de construção

1. **Setup**: projeto Next.js, Prisma + Supabase (Postgres), pipeline de deploy no
   Vercel, login simples de uma conta.
2. **Núcleo do algoritmo** (sem UI polida): fórmulas VDOT, geração de plano para os
   4 tipos de prova, distribuição de fases e tipos de treino — validar com casos de
   teste manuais antes de construir telas.
3. **Telas principais**: Onboarding/novo plano, Dashboard da semana, Registro de
   treino.
4. **Reavaliação semanal + Histórico/progresso**: lógica dos 3 sinais e ajuste
   automático; gráficos de pace/VDOT/aderência ao longo do tempo.
5. **Ciclo de vida do plano**: fim de plano (resultado da prova → novo plano),
   edição de plano em andamento, tela de Configurações.
6. **Polimento e deploy final**: revisão de UX no celular, testes manuais
   end-to-end, deploy de produção.

## Verificação

- Rodar localmente (`npm run dev`) e percorrer o fluxo completo: login → teste de
  esforço → gerar plano de 10km em ~10 semanas → registrar treinos de uma semana
  com RPE alto e pace abaixo do alvo → confirmar que a semana seguinte reduz carga
  automaticamente → simular a passagem de 4 semanas → verificar prompt de reteste
  de VDOT → chegar à data da prova → registrar resultado final → confirmar que um
  novo plano pode ser criado já com o VDOT atualizado.
- Repetir o mesmo fluxo acessando a versão publicada (Vercel) a partir do navegador
  do celular, para validar a experiência mobile-web antes de considerar o MVP
  concluído.
