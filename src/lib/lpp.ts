// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type LppPlan = {
  id: string;
  ref_no: string;
  event_id: string;
  tier_id: string;
  quantity: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  plan_key: string;
  plan_label: string;
  deposit_pct: number;
  installments_count: number;
  interval_days: number;
  subtotal_kes: number;
  buyer_fee_kes: number;
  total_kes: number;
  deposit_kes: number;
  paid_kes: number;
  balance_kes: number;
  status: "pending" | "reserved" | "completed" | "cancelled" | "expired";
  reserved_at: string | null;
  completed_at: string | null;
  event_starts_at: string;
  final_due_at: string;
};

export type LppInstallment = {
  id: string;
  plan_id: string;
  sequence: number;
  kind: "deposit" | "installment";
  amount_kes: number;
  due_at: string;
  status: "pending" | "paid" | "overdue" | "failed";
  paid_at: string | null;
  provider_receipt: string | null;
};

export type LppConfigPlan = {
  id: string;
  label: string;
  deposit_pct: number;
  installments: number;
  interval_days: number;
};

export async function lppGetPlan(refNo: string) {
  const { data, error } = await supabase.functions.invoke("lpp-get-plan", { body: { refNo } });
  if (error) throw error;
  if ((data as any)?.error) {
    if ((data as any).error === "No plan found for that ref no.") {
      return { plan: null, installments: [], event: null, tier: null, pendingDeposit: true } as { plan: LppPlan | null; installments: LppInstallment[]; event: any; tier: any; pendingDeposit: boolean };
    }
    throw new Error((data as any).error);
  }
  return data as { plan: LppPlan | null; installments: LppInstallment[]; event: any; tier: any; pendingDeposit: boolean };
}

export async function lppInitPlan(body: {
  eventId: string;
  tierId: string;
  quantity: number;
  planKey: string;
  name: string;
  email: string;
  phone: string;
  depositPhone: string;
  holders?: { name: string; email: string; phone: string }[];
}) {
  const { data, error } = await supabase.functions.invoke("lpp-init-plan", { body });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ref_no: string; plan: LppPlan; installments: LppInstallment[]; deposit_stk: { customerMessage: string } | null };
}

export async function lppPayInstallment(refNo: string, phone: string) {
  const { data, error } = await supabase.functions.invoke("lpp-pay-installment", { body: { refNo, phone } });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { installment_id: string; sequence: number; amount_kes: number; customer_message: string };
}
