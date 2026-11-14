import type { Database } from "@/lib/supabase/database.types";
export type WaitlistEntry = Database["public"]["Functions"]["get_my_gym_waitlist"]["Returns"][number];
