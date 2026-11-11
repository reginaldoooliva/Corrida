import { PlanStatus } from "@prisma/client";
import Link from "next/link";

import { BottomNav } from "@/components/bottom-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubmitButton } from "@/components/submit-button";
import { FlagIcon } from "@/components/icons";
import { appToday } from "@/lib/domain/clock";
import { getSeededUserId } from "@/lib/domain/auth";
import { listPlans } from "@/lib/domain/plan-lifecycle";
import { deletePlanMessage, formatLongDay, RACE_LABEL, RACE_NAME } from "@/lib/format";

import { deletePlanAction, followPlanAction } from "./actions";

// Reads the plans on every request, archiving the ones whose race has passed (PLANS-10).
export const dynamic = "force-dynamic";

interface PlansPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function PlansPage({ searchParams }: PlansPageProps) {
  const { error } = await searchParams;
  const userId = await getSeededUserId();
  const plans = await listPlans(userId, appToday());

  return (
    <>
      <main className="page page--nav">
        <header className="page-header">
          <span className="eyebrow">Até 3 planos</span>
          <h1>Planos</h1>
        </header>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        {plans.length === 0 ? (
          <section className="card" style={{ justifyItems: "start" }}>
            <span className="icon-badge">
              <FlagIcon />
            </span>
            <p>Nenhum plano ainda.</p>
          </section>
        ) : (
          // Spec PLANS-05: each active or paused plan with its race, race date, weeks and status.
          <ul aria-label="Seus planos" className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {plans.map((plan) => {
              const following = plan.status === PlanStatus.ACTIVE;
              const title = `${RACE_NAME[plan.raceType]} (${RACE_LABEL[plan.raceType]})`;
              return (
                <li key={plan.id} aria-label={title} className={following ? "card card-accent" : "card"}>
                  <div className="row between">
                    <h2>{title}</h2>
                    <span className={following ? "chip chip-primary" : "chip chip-secondary"}>
                      {following ? "Seguindo" : "Pausado"}
                    </span>
                  </div>
                  <dl className="facts">
                    <div>
                      <dt>Data da prova</dt>
                      <dd>{formatLongDay(plan.raceDate)}</dd>
                    </div>
                    <div>
                      <dt>Semanas</dt>
                      <dd>{plan.weeks}</dd>
                    </div>
                  </dl>
                  {/* Spec PLANS-06: a paused plan can be followed again. */}
                  {!following && (
                    <form action={followPlanAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <SubmitButton pendingText="Trocando..." className="btn-block">
                        Seguir este plano
                      </SubmitButton>
                    </form>
                  )}
                  {/* Spec DEL-01/05: every plan here can be deleted, after confirmation. */}
                  <ConfirmDialog
                    label="Excluir plano"
                    message={deletePlanMessage(plan.raceType)}
                    action={deletePlanAction}
                    fields={{ planId: plan.id, from: "/plans" }}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/plan/new" className="btn btn-secondary btn-block">
          Novo plano
        </Link>
      </main>
      <BottomNav />
    </>
  );
}
