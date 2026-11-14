import type { Database } from "@/lib/supabase/database.types";
import type { WaitlistEntry } from "@/modules/waitlist/types";
export type CalendarSlot = Pick<Database["public"]["Tables"]["gym_slots"]["Row"], "id" | "starts_at" | "ends_at" | "capacity" | "status"> & {
  availability?: { occupied: number; available: number; canBook: boolean; reason: string | null; opensAt: string; reservationId: string | null; observedAt: string };
  waitlist?: WaitlistEntry | null;
};
