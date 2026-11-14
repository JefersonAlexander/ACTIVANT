export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export type Database = {
    "public": {
        Tables: {
            "absence_cases": {
                Row: {
                    "created_at": string;
                    "decision_reason": string | null;
                    "id": string;
                    "occurred_at": string;
                    "reservation_id": string;
                    "review_requested_at": string | null;
                    "reviewed_at": string | null;
                    "reviewed_by": string | null;
                    "rules_id": string;
                    "slot_id": string;
                    "status": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "decision_reason"?: string | null;
                    "id"?: string;
                    "occurred_at": string;
                    "reservation_id": string;
                    "review_requested_at"?: string | null;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "rules_id": string;
                    "slot_id": string;
                    "status"?: string;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "decision_reason"?: string | null;
                    "id"?: string;
                    "occurred_at"?: string;
                    "reservation_id"?: string;
                    "review_requested_at"?: string | null;
                    "reviewed_at"?: string | null;
                    "reviewed_by"?: string | null;
                    "rules_id"?: string;
                    "slot_id"?: string;
                    "status"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "absence_cases_reservation_id_user_id_slot_id_fkey";
                        columns: [
                            "reservation_id",
                            "user_id",
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id",
                            "user_id",
                            "slot_id"
                        ];
                    },
                    {
                        foreignKeyName: "absence_cases_reviewed_by_fkey";
                        columns: [
                            "reviewed_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "absence_cases_rules_id_fkey";
                        columns: [
                            "rules_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "point_program_rules";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "absence_cases_slot_id_fkey";
                        columns: [
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "gym_slot_closeouts";
                        referencedColumns: [
                            "slot_id"
                        ];
                    }
                ];
            };
            "absence_justifications": {
                Row: {
                    "case_id": string;
                    "reason": string;
                    "submitted_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "case_id": string;
                    "reason": string;
                    "submitted_at"?: string;
                    "user_id": string;
                };
                Update: {
                    "case_id"?: string;
                    "reason"?: string;
                    "submitted_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "absence_justifications_case_id_user_id_fkey";
                        columns: [
                            "case_id",
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "absence_cases";
                        referencedColumns: [
                            "id",
                            "user_id"
                        ];
                    }
                ];
            };
            "absence_sanctions": {
                Row: {
                    "business_days": number;
                    "case_id": string;
                    "created_at": string;
                    "created_by": string;
                    "id": string;
                    "kind": string;
                    "ordinal": number;
                    "restriction_id": string | null;
                    "revoked_at": string | null;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "business_days"?: number;
                    "case_id": string;
                    "created_at"?: string;
                    "created_by": string;
                    "id"?: string;
                    "kind": string;
                    "ordinal": number;
                    "restriction_id"?: string | null;
                    "revoked_at"?: string | null;
                    "user_id": string;
                };
                Update: {
                    "business_days"?: number;
                    "case_id"?: string;
                    "created_at"?: string;
                    "created_by"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "ordinal"?: number;
                    "restriction_id"?: string | null;
                    "revoked_at"?: string | null;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "absence_sanctions_case_id_user_id_fkey";
                        columns: [
                            "case_id",
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "absence_cases";
                        referencedColumns: [
                            "id",
                            "user_id"
                        ];
                    },
                    {
                        foreignKeyName: "absence_sanctions_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "absence_sanctions_restriction_id_fkey";
                        columns: [
                            "restriction_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "gym_access_restrictions";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "admin_invitation_requests": {
                Row: {
                    "completed_at": string | null;
                    "created_at": string;
                    "created_by": string;
                    "email": string;
                    "id": string;
                    "status": string;
                    "user_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "created_by": string;
                    "email": string;
                    "id": string;
                    "status"?: string;
                    "user_id"?: string | null;
                };
                Update: {
                    "completed_at"?: string | null;
                    "created_at"?: string;
                    "created_by"?: string;
                    "email"?: string;
                    "id"?: string;
                    "status"?: string;
                    "user_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "admin_invitation_requests_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "admin_invitation_requests_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "affiliation_types": {
                Row: {
                    "code": string;
                    "is_active": boolean;
                    "label": string;
                };
                ComputedFields: never;
                Insert: {
                    "code": string;
                    "is_active"?: boolean;
                    "label": string;
                };
                Update: {
                    "code"?: string;
                    "is_active"?: boolean;
                    "label"?: string;
                };
                Relationships: [
                ];
            };
            "app_settings": {
                Row: {
                    "booking_window_hours": number;
                    "default_slot_capacity": number;
                    "qr_ttl_seconds": number;
                    "reservation_reminder_minutes": number;
                    "reservation_reminders_enabled": boolean;
                    "reservations_enabled": boolean;
                    "singleton": boolean;
                    "updated_at": string;
                    "updated_by": string | null;
                    "waitlist_offer_minutes": number;
                };
                ComputedFields: never;
                Insert: {
                    "booking_window_hours"?: number;
                    "default_slot_capacity"?: number;
                    "qr_ttl_seconds"?: number;
                    "reservation_reminder_minutes"?: number;
                    "reservation_reminders_enabled"?: boolean;
                    "reservations_enabled"?: boolean;
                    "singleton"?: boolean;
                    "updated_at"?: string;
                    "updated_by"?: string | null;
                    "waitlist_offer_minutes"?: number;
                };
                Update: {
                    "booking_window_hours"?: number;
                    "default_slot_capacity"?: number;
                    "qr_ttl_seconds"?: number;
                    "reservation_reminder_minutes"?: number;
                    "reservation_reminders_enabled"?: boolean;
                    "reservations_enabled"?: boolean;
                    "singleton"?: boolean;
                    "updated_at"?: string;
                    "updated_by"?: string | null;
                    "waitlist_offer_minutes"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "app_settings_updated_by_fkey";
                        columns: [
                            "updated_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "attendance": {
                Row: {
                    "checked_in_at": string;
                    "display_challenge_id": string | null;
                    "manual_reason": string | null;
                    "method": Database["public"]['Enums']["attendance_method"];
                    "qr_challenge_id": string | null;
                    "recorded_by": string;
                    "reservation_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "checked_in_at"?: string;
                    "display_challenge_id"?: string | null;
                    "manual_reason"?: string | null;
                    "method": Database["public"]['Enums']["attendance_method"];
                    "qr_challenge_id"?: string | null;
                    "recorded_by": string;
                    "reservation_id": string;
                };
                Update: {
                    "checked_in_at"?: string;
                    "display_challenge_id"?: string | null;
                    "manual_reason"?: string | null;
                    "method"?: Database["public"]['Enums']["attendance_method"];
                    "qr_challenge_id"?: string | null;
                    "recorded_by"?: string;
                    "reservation_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_qr_challenge_id_reservation_id_fkey";
                        columns: [
                            "qr_challenge_id",
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "qr_challenges";
                        referencedColumns: [
                            "id",
                            "reservation_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_recorded_by_fkey";
                        columns: [
                            "recorded_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "attendance_invalidations": {
                Row: {
                    "invalidated_at": string;
                    "invalidated_by": string;
                    "reason": string;
                    "reservation_id": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "invalidated_at"?: string;
                    "invalidated_by": string;
                    "reason": string;
                    "reservation_id": string;
                    "user_id": string;
                };
                Update: {
                    "invalidated_at"?: string;
                    "invalidated_by"?: string;
                    "reason"?: string;
                    "reservation_id"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "attendance_invalidations_invalidated_by_fkey";
                        columns: [
                            "invalidated_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_invalidations_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "attendance";
                        referencedColumns: [
                            "reservation_id"
                        ];
                    },
                    {
                        foreignKeyName: "attendance_invalidations_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "audit_logs": {
                Row: {
                    "actor_id": string | null;
                    "database_actor": string;
                    "entity_key": NonNullable<Json>;
                    "entity_table": string;
                    "id": number;
                    "new_values": Json | null;
                    "occurred_at": string;
                    "old_values": Json | null;
                    "operation": string;
                };
                ComputedFields: never;
                Insert: {
                    "actor_id"?: string | null;
                    "database_actor": string;
                    "entity_key": NonNullable<Json>;
                    "entity_table": string;
                    "id"?: never;
                    "new_values"?: Json | null;
                    "occurred_at"?: string;
                    "old_values"?: Json | null;
                    "operation": string;
                };
                Update: {
                    "actor_id"?: string | null;
                    "database_actor"?: string;
                    "entity_key"?: NonNullable<Json>;
                    "entity_table"?: string;
                    "id"?: never;
                    "new_values"?: Json | null;
                    "occurred_at"?: string;
                    "old_values"?: Json | null;
                    "operation"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "audit_logs_actor_id_fkey";
                        columns: [
                            "actor_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "gym_access_restrictions": {
                Row: {
                    "created_at": string;
                    "created_by": string;
                    "ends_at": string;
                    "id": string;
                    "kind": string;
                    "revoked_at": string | null;
                    "starts_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "created_by": string;
                    "ends_at": string;
                    "id"?: string;
                    "kind"?: string;
                    "revoked_at"?: string | null;
                    "starts_at": string;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "created_by"?: string;
                    "ends_at"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "revoked_at"?: string | null;
                    "starts_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "gym_access_restrictions_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "gym_access_restrictions_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "gym_availability_signals": {
                Row: {
                    "changed_at": string;
                    "revision": number;
                    "slot_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "changed_at"?: string;
                    "revision"?: number;
                    "slot_id": string;
                };
                Update: {
                    "changed_at"?: string;
                    "revision"?: number;
                    "slot_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "gym_availability_signals_slot_id_fkey";
                        columns: [
                            "slot_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "gym_slots";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "gym_eligibility": {
                Row: {
                    "authorized_by": string | null;
                    "is_eligible": boolean;
                    "updated_at": string;
                    "user_id": string;
                    "valid_from": string;
                    "valid_until": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "authorized_by"?: string | null;
                    "is_eligible"?: boolean;
                    "updated_at"?: string;
                    "user_id": string;
                    "valid_from"?: string;
                    "valid_until"?: string | null;
                };
                Update: {
                    "authorized_by"?: string | null;
                    "is_eligible"?: boolean;
                    "updated_at"?: string;
                    "user_id"?: string;
                    "valid_from"?: string;
                    "valid_until"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "gym_eligibility_authorized_by_fkey";
                        columns: [
                            "authorized_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "gym_eligibility_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "gym_slot_closeouts": {
                Row: {
                    "closed_at": string;
                    "closed_by": string;
                    "evidence": string;
                    "slot_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "closed_at"?: string;
                    "closed_by": string;
                    "evidence": string;
                    "slot_id": string;
                };
                Update: {
                    "closed_at"?: string;
                    "closed_by"?: string;
                    "evidence"?: string;
                    "slot_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "gym_slot_closeouts_closed_by_fkey";
                        columns: [
                            "closed_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "gym_slot_closeouts_slot_id_fkey";
                        columns: [
                            "slot_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "gym_slots";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "gym_slots": {
                Row: {
                    "capacity": number;
                    "created_at": string;
                    "created_by": string | null;
                    "ends_at": string;
                    "id": string;
                    "starts_at": string;
                    "status": Database["public"]['Enums']["gym_slot_status"];
                };
                ComputedFields: never;
                Insert: {
                    "capacity"?: number;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "ends_at": string;
                    "id"?: string;
                    "starts_at": string;
                    "status"?: Database["public"]['Enums']["gym_slot_status"];
                };
                Update: {
                    "capacity"?: number;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "ends_at"?: string;
                    "id"?: string;
                    "starts_at"?: string;
                    "status"?: Database["public"]['Enums']["gym_slot_status"];
                };
                Relationships: [
                    {
                        foreignKeyName: "gym_slots_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "notifications": {
                Row: {
                    "created_at": string;
                    "event_key": string;
                    "id": string;
                    "kind": string;
                    "offer_id": string | null;
                    "read_at": string | null;
                    "reservation_id": string | null;
                    "slot_id": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "event_key": string;
                    "id"?: string;
                    "kind": string;
                    "offer_id"?: string | null;
                    "read_at"?: string | null;
                    "reservation_id"?: string | null;
                    "slot_id": string;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "event_key"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "offer_id"?: string | null;
                    "read_at"?: string | null;
                    "reservation_id"?: string | null;
                    "slot_id"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "notifications_offer_id_fkey";
                        columns: [
                            "offer_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "waitlist_offers";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "notifications_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "notifications_slot_id_fkey";
                        columns: [
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "gym_slots";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "point_periods": {
                Row: {
                    "bonus_revision": number;
                    "month_start": string;
                    "rules_id": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "bonus_revision"?: number;
                    "month_start": string;
                    "rules_id": string;
                    "user_id": string;
                };
                Update: {
                    "bonus_revision"?: number;
                    "month_start"?: string;
                    "rules_id"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "point_periods_rules_id_fkey";
                        columns: [
                            "rules_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "point_program_rules";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "point_periods_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "point_program_rules": {
                Row: {
                    "absence_period": string;
                    "absence_window_days": number;
                    "absences_enabled": boolean;
                    "attendance_points": number;
                    "cancellation_limit": number;
                    "cancellation_notice_minutes": number;
                    "cancellation_points": number;
                    "closeout_delay_minutes": number;
                    "created_at": string;
                    "created_by": string | null;
                    "effective_month": string;
                    "first_bonus_count": number;
                    "first_bonus_points": number;
                    "id": string;
                    "points_enabled": boolean;
                    "second_absence_days": number;
                    "second_bonus_count": number;
                    "second_bonus_points": number;
                    "third_absence_days": number;
                };
                ComputedFields: never;
                Insert: {
                    "absence_period"?: string;
                    "absence_window_days"?: number;
                    "absences_enabled"?: boolean;
                    "attendance_points"?: number;
                    "cancellation_limit"?: number;
                    "cancellation_notice_minutes"?: number;
                    "cancellation_points"?: number;
                    "closeout_delay_minutes"?: number;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "effective_month": string;
                    "first_bonus_count"?: number;
                    "first_bonus_points"?: number;
                    "id"?: string;
                    "points_enabled"?: boolean;
                    "second_absence_days"?: number;
                    "second_bonus_count"?: number;
                    "second_bonus_points"?: number;
                    "third_absence_days"?: number;
                };
                Update: {
                    "absence_period"?: string;
                    "absence_window_days"?: number;
                    "absences_enabled"?: boolean;
                    "attendance_points"?: number;
                    "cancellation_limit"?: number;
                    "cancellation_notice_minutes"?: number;
                    "cancellation_points"?: number;
                    "closeout_delay_minutes"?: number;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "effective_month"?: string;
                    "first_bonus_count"?: number;
                    "first_bonus_points"?: number;
                    "id"?: string;
                    "points_enabled"?: boolean;
                    "second_absence_days"?: number;
                    "second_bonus_count"?: number;
                    "second_bonus_points"?: number;
                    "third_absence_days"?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: "point_program_rules_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "point_transactions": {
                Row: {
                    "amount": number;
                    "attendance_id": string | null;
                    "created_at": string;
                    "created_by": string | null;
                    "event_key": string;
                    "id": string;
                    "kind": string;
                    "month_start": string;
                    "reason": string;
                    "reservation_id": string | null;
                    "reverses_id": string | null;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "amount": number;
                    "attendance_id"?: string | null;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "event_key": string;
                    "id"?: string;
                    "kind": string;
                    "month_start": string;
                    "reason": string;
                    "reservation_id"?: string | null;
                    "reverses_id"?: string | null;
                    "user_id": string;
                };
                Update: {
                    "amount"?: number;
                    "attendance_id"?: string | null;
                    "created_at"?: string;
                    "created_by"?: string | null;
                    "event_key"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "month_start"?: string;
                    "reason"?: string;
                    "reservation_id"?: string | null;
                    "reverses_id"?: string | null;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "point_transactions_attendance_id_fkey";
                        columns: [
                            "attendance_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "attendance";
                        referencedColumns: [
                            "reservation_id"
                        ];
                    },
                    {
                        foreignKeyName: "point_transactions_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "point_transactions_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "point_transactions_reverses_id_fkey";
                        columns: [
                            "reverses_id"
                        ];
                        isOneToOne: true;
                        referencedRelation: "point_transactions";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "point_transactions_user_id_month_start_fkey";
                        columns: [
                            "user_id",
                            "month_start"
                        ];
                        isOneToOne: false;
                        referencedRelation: "point_periods";
                        referencedColumns: [
                            "user_id",
                            "month_start"
                        ];
                    }
                ];
            };
            "profiles": {
                Row: {
                    "affiliation_type": string | null;
                    "created_at": string;
                    "id": string;
                    "is_active": boolean;
                };
                ComputedFields: never;
                Insert: {
                    "affiliation_type"?: string | null;
                    "created_at"?: string;
                    "id": string;
                    "is_active"?: boolean;
                };
                Update: {
                    "affiliation_type"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "is_active"?: boolean;
                };
                Relationships: [
                    {
                        foreignKeyName: "profiles_affiliation_type_fkey";
                        columns: [
                            "affiliation_type"
                        ];
                        isOneToOne: false;
                        referencedRelation: "affiliation_types";
                        referencedColumns: [
                            "code"
                        ];
                    }
                ];
            };
            "qr_challenges": {
                Row: {
                    "consumed_at": string | null;
                    "created_at": string;
                    "expires_at": string;
                    "id": string;
                    "issued_by": string;
                    "reservation_id": string;
                    "revoked_at": string | null;
                    "token_hash": string;
                };
                ComputedFields: never;
                Insert: {
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "expires_at": string;
                    "id"?: string;
                    "issued_by": string;
                    "reservation_id": string;
                    "revoked_at"?: string | null;
                    "token_hash": string;
                };
                Update: {
                    "consumed_at"?: string | null;
                    "created_at"?: string;
                    "expires_at"?: string;
                    "id"?: string;
                    "issued_by"?: string;
                    "reservation_id"?: string;
                    "revoked_at"?: string | null;
                    "token_hash"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "qr_challenges_issued_by_fkey";
                        columns: [
                            "issued_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "qr_challenges_reservation_id_fkey";
                        columns: [
                            "reservation_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "reservations": {
                Row: {
                    "cancelled_at": string | null;
                    "created_at": string;
                    "id": string;
                    "slot_id": string;
                    "status": Database["public"]['Enums']["reservation_status"];
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "cancelled_at"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "slot_id": string;
                    "status"?: Database["public"]['Enums']["reservation_status"];
                    "user_id": string;
                };
                Update: {
                    "cancelled_at"?: string | null;
                    "created_at"?: string;
                    "id"?: string;
                    "slot_id"?: string;
                    "status"?: Database["public"]['Enums']["reservation_status"];
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "reservations_slot_id_fkey";
                        columns: [
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "gym_slots";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "reservations_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "user_roles": {
                Row: {
                    "granted_at": string;
                    "granted_by": string | null;
                    "role": Database["public"]['Enums']["app_role"];
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "granted_at"?: string;
                    "granted_by"?: string | null;
                    "role"?: Database["public"]['Enums']["app_role"];
                    "user_id": string;
                };
                Update: {
                    "granted_at"?: string;
                    "granted_by"?: string | null;
                    "role"?: Database["public"]['Enums']["app_role"];
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "user_roles_granted_by_fkey";
                        columns: [
                            "granted_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "user_roles_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "waitlist": {
                Row: {
                    "created_at": string;
                    "id": string;
                    "reservation_id": string | null;
                    "slot_id": string;
                    "status": Database["public"]['Enums']["waitlist_status"];
                    "updated_at": string;
                    "user_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "id"?: string;
                    "reservation_id"?: string | null;
                    "slot_id": string;
                    "status"?: Database["public"]['Enums']["waitlist_status"];
                    "updated_at"?: string;
                    "user_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "id"?: string;
                    "reservation_id"?: string | null;
                    "slot_id"?: string;
                    "status"?: Database["public"]['Enums']["waitlist_status"];
                    "updated_at"?: string;
                    "user_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "waitlist_reservation_id_user_id_slot_id_fkey";
                        columns: [
                            "reservation_id",
                            "user_id",
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id",
                            "user_id",
                            "slot_id"
                        ];
                    },
                    {
                        foreignKeyName: "waitlist_slot_id_fkey";
                        columns: [
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "gym_slots";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "waitlist_user_id_fkey";
                        columns: [
                            "user_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "waitlist_offers": {
                Row: {
                    "created_at": string;
                    "expires_at": string;
                    "id": string;
                    "reason": string | null;
                    "reservation_id": string | null;
                    "responded_at": string | null;
                    "response_by": string | null;
                    "slot_id": string;
                    "status": string;
                    "user_id": string;
                    "waitlist_id": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "expires_at": string;
                    "id"?: string;
                    "reason"?: string | null;
                    "reservation_id"?: string | null;
                    "responded_at"?: string | null;
                    "response_by"?: string | null;
                    "slot_id": string;
                    "status"?: string;
                    "user_id": string;
                    "waitlist_id": string;
                };
                Update: {
                    "created_at"?: string;
                    "expires_at"?: string;
                    "id"?: string;
                    "reason"?: string | null;
                    "reservation_id"?: string | null;
                    "responded_at"?: string | null;
                    "response_by"?: string | null;
                    "slot_id"?: string;
                    "status"?: string;
                    "user_id"?: string;
                    "waitlist_id"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "waitlist_offers_reservation_id_user_id_slot_id_fkey";
                        columns: [
                            "reservation_id",
                            "user_id",
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "reservations";
                        referencedColumns: [
                            "id",
                            "user_id",
                            "slot_id"
                        ];
                    },
                    {
                        foreignKeyName: "waitlist_offers_waitlist_id_user_id_slot_id_fkey";
                        columns: [
                            "waitlist_id",
                            "user_id",
                            "slot_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "waitlist";
                        referencedColumns: [
                            "id",
                            "user_id",
                            "slot_id"
                        ];
                    }
                ];
            };
            "wellness_assets": {
                Row: {
                    "created_at": string;
                    "created_by": string;
                    "id": string;
                    "kind": string;
                    "mime_type": string;
                    "object_path": string;
                    "size_bytes": number;
                    "status": string;
                };
                ComputedFields: never;
                Insert: {
                    "created_at"?: string;
                    "created_by": string;
                    "id"?: string;
                    "kind": string;
                    "mime_type": string;
                    "object_path": string;
                    "size_bytes": number;
                    "status"?: string;
                };
                Update: {
                    "created_at"?: string;
                    "created_by"?: string;
                    "id"?: string;
                    "kind"?: string;
                    "mime_type"?: string;
                    "object_path"?: string;
                    "size_bytes"?: number;
                    "status"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "wellness_assets_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "wellness_categories": {
                Row: {
                    "code": string;
                    "label": string;
                };
                ComputedFields: never;
                Insert: {
                    "code": string;
                    "label": string;
                };
                Update: {
                    "code"?: string;
                    "label"?: string;
                };
                Relationships: [
                ];
            };
            "wellness_contents": {
                Row: {
                    "authorized_at": string | null;
                    "authorized_by": string | null;
                    "category": string;
                    "cover_asset_id": string | null;
                    "created_at": string;
                    "created_by": string;
                    "description": string;
                    "duration_minutes": number;
                    "external_url": string | null;
                    "id": string;
                    "published_at": string | null;
                    "revision": number;
                    "status": string;
                    "title": string;
                    "updated_at": string;
                    "video_asset_id": string | null;
                };
                ComputedFields: never;
                Insert: {
                    "authorized_at"?: string | null;
                    "authorized_by"?: string | null;
                    "category": string;
                    "cover_asset_id"?: string | null;
                    "created_at"?: string;
                    "created_by": string;
                    "description": string;
                    "duration_minutes": number;
                    "external_url"?: string | null;
                    "id"?: string;
                    "published_at"?: string | null;
                    "revision"?: number;
                    "status"?: string;
                    "title": string;
                    "updated_at"?: string;
                    "video_asset_id"?: string | null;
                };
                Update: {
                    "authorized_at"?: string | null;
                    "authorized_by"?: string | null;
                    "category"?: string;
                    "cover_asset_id"?: string | null;
                    "created_at"?: string;
                    "created_by"?: string;
                    "description"?: string;
                    "duration_minutes"?: number;
                    "external_url"?: string | null;
                    "id"?: string;
                    "published_at"?: string | null;
                    "revision"?: number;
                    "status"?: string;
                    "title"?: string;
                    "updated_at"?: string;
                    "video_asset_id"?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: "wellness_contents_authorized_by_fkey";
                        columns: [
                            "authorized_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "wellness_contents_category_fkey";
                        columns: [
                            "category"
                        ];
                        isOneToOne: false;
                        referencedRelation: "wellness_categories";
                        referencedColumns: [
                            "code"
                        ];
                    },
                    {
                        foreignKeyName: "wellness_contents_cover_asset_id_fkey";
                        columns: [
                            "cover_asset_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "wellness_assets";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "wellness_contents_created_by_fkey";
                        columns: [
                            "created_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    },
                    {
                        foreignKeyName: "wellness_contents_video_asset_id_fkey";
                        columns: [
                            "video_asset_id"
                        ];
                        isOneToOne: false;
                        referencedRelation: "wellness_assets";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
            "working_calendar": {
                Row: {
                    "day": string;
                    "is_working": boolean;
                    "verified_at": string;
                    "verified_by": string;
                };
                ComputedFields: never;
                Insert: {
                    "day": string;
                    "is_working": boolean;
                    "verified_at"?: string;
                    "verified_by": string;
                };
                Update: {
                    "day"?: string;
                    "is_working"?: boolean;
                    "verified_at"?: string;
                    "verified_by"?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: "working_calendar_verified_by_fkey";
                        columns: [
                            "verified_by"
                        ];
                        isOneToOne: false;
                        referencedRelation: "profiles";
                        referencedColumns: [
                            "id"
                        ];
                    }
                ];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            "admin_add_gym_access_restriction": {
                Args: {
                    "p_ends_at": string;
                    "p_kind"?: string;
                    "p_starts_at": string;
                    "p_user_id": string;
                };
                Returns: string;
            };
            "admin_adjust_points": {
                Args: {
                    "p_amount": number;
                    "p_reason": string;
                    "p_request_id": string;
                    "p_user_id": string;
                };
                Returns: string;
            };
            "admin_begin_invitation": {
                Args: {
                    "p_email": string;
                    "p_request_id": string;
                };
                Returns: boolean;
            };
            "admin_create_gym_slot": {
                Args: {
                    "p_capacity"?: number;
                    "p_ends_at": string;
                    "p_starts_at": string;
                };
                Returns: string;
            };
            "admin_create_point_rules": {
                Args: {
                    "p_effective_month": string;
                    "p_rules": Json;
                };
                Returns: string;
            };
            "admin_finalize_wellness_asset": {
                Args: {
                    "p_asset_id": string;
                };
                Returns: undefined;
            };
            "admin_finish_invitation": {
                Args: {
                    "p_request_id": string;
                    "p_status": string;
                    "p_user_id"?: string;
                };
                Returns: undefined;
            };
            "admin_get_gym_report": {
                Args: {
                    "p_end": string;
                    "p_slot_id"?: string;
                    "p_start": string;
                };
                Returns: Json;
            };
            "admin_invalidate_attendance": {
                Args: {
                    "p_reason": string;
                    "p_reservation_id": string;
                };
                Returns: undefined;
            };
            "admin_list_activant_users": {
                Args: {
                    "p_page"?: number;
                    "p_search"?: string;
                };
                Returns: {
                    "affiliation_type": string;
                    "email": string;
                    "id": string;
                    "is_active": boolean;
                    "is_eligible": boolean;
                    "roles": (Database["public"]['Enums']["app_role"])[];
                    "total_matches": number;
                    "valid_from": string;
                    "valid_until": string;
                }[];
            };
            "admin_prepare_wellness_asset": {
                Args: {
                    "p_kind": string;
                    "p_mime_type": string;
                    "p_size_bytes": number;
                };
                Returns: {
                    "id": string;
                    "object_path": string;
                }[];
            };
            "admin_read_audit": {
                Args: {
                    "p_end": string;
                    "p_limit"?: number;
                    "p_page"?: number;
                    "p_slot_id"?: string;
                    "p_start": string;
                };
                Returns: {
                    "actor_id": string;
                    "database_actor": string;
                    "entity_key": Json;
                    "entity_table": string;
                    "id": number;
                    "occurred_at": string;
                    "operation": string;
                    "total_matches": number;
                }[];
            };
            "admin_record_export": {
                Args: {
                    "p_end": string;
                    "p_kind": string;
                    "p_slot_id"?: string;
                    "p_start": string;
                };
                Returns: undefined;
            };
            "admin_review_absence": {
                Args: {
                    "p_case_id": string;
                    "p_evidence_confirmed": boolean;
                    "p_reason": string;
                    "p_status": string;
                };
                Returns: undefined;
            };
            "admin_revoke_gym_access_restriction": {
                Args: {
                    "p_restriction_id": string;
                };
                Returns: undefined;
            };
            "admin_save_wellness_content": {
                Args: {
                    "p_authorized": boolean;
                    "p_category": string;
                    "p_cover_asset_id": string;
                    "p_description": string;
                    "p_duration_minutes": number;
                    "p_external_url": string;
                    "p_id": string;
                    "p_revision": number;
                    "p_status": string;
                    "p_title": string;
                    "p_video_asset_id": string;
                };
                Returns: string;
            };
            "admin_set_gym_eligibility": {
                Args: {
                    "p_is_eligible": boolean;
                    "p_user_id": string;
                    "p_valid_from": string;
                    "p_valid_until"?: string;
                };
                Returns: undefined;
            };
            "admin_set_profile_access": {
                Args: {
                    "p_affiliation_type": string;
                    "p_is_active": boolean;
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "admin_set_user_role": {
                Args: {
                    "p_enabled": boolean;
                    "p_role": Database["public"]['Enums']["app_role"];
                    "p_user_id": string;
                };
                Returns: undefined;
            };
            "admin_set_working_calendar": {
                Args: {
                    "p_end": string;
                    "p_non_working": (string)[];
                    "p_start": string;
                    "p_verified": boolean;
                };
                Returns: undefined;
            };
            "admin_update_app_settings": {
                Args: {
                    "p_default_slot_capacity": number;
                    "p_qr_ttl_seconds": number;
                };
                Returns: undefined;
            };
            "admin_update_booking_rules": {
                Args: {
                    "p_default_capacity": number;
                    "p_enabled": boolean;
                    "p_window_hours": number;
                };
                Returns: undefined;
            };
            "admin_update_gym_slot": {
                Args: {
                    "p_capacity": number;
                    "p_ends_at": string;
                    "p_slot_id": string;
                    "p_starts_at": string;
                    "p_status": Database["public"]['Enums']["gym_slot_status"];
                };
                Returns: undefined;
            };
            "admin_update_notification_rules": {
                Args: {
                    "p_offer_minutes": number;
                    "p_reminder_minutes": number;
                    "p_reminders_enabled": boolean;
                };
                Returns: undefined;
            };
            "admin_upsert_affiliation_type": {
                Args: {
                    "p_code": string;
                    "p_is_active": boolean;
                    "p_label": string;
                };
                Returns: undefined;
            };
            "cancel_gym_reservation": {
                Args: {
                    "p_reservation_id": string;
                };
                Returns: undefined;
            };
            "check_in_gym_qr": {
                Args: {
                    "p_token": string;
                };
                Returns: {
                    "checked_in_at": string;
                    "outcome": string;
                    "reservation_id": string;
                }[];
            };
            "consume_gym_qr_challenge": {
                Args: {
                    "p_token": string;
                };
                Returns: string;
            };
            "get_gym_slot_availability": {
                Args: {
                    "p_end": string;
                    "p_start": string;
                };
                Returns: {
                    "available": number;
                    "blocking_reason": string;
                    "booking_opens_at": string;
                    "can_book": boolean;
                    "capacity": number;
                    "ends_at": string;
                    "observed_at": string;
                    "occupied": number;
                    "reservation_id": string;
                    "slot_id": string;
                    "starts_at": string;
                    "status": Database["public"]['Enums']["gym_slot_status"];
                    "total_matches": number;
                }[];
            };
            "get_my_gym_waitlist": {
                Args: Record<PropertyKey, never>;
                Returns: {
                    "ends_at": string;
                    "expires_at": string;
                    "id": string;
                    "joined_at": string;
                    "observed_at": string;
                    "offer_id": string;
                    "offer_status": string;
                    "queue_position": number;
                    "reservation_id": string;
                    "slot_id": string;
                    "starts_at": string;
                    "status": Database["public"]['Enums']["waitlist_status"];
                }[];
            };
            "get_my_point_summary": {
                Args: Record<PropertyKey, never>;
                Returns: {
                    "attendance_points": number;
                    "balance": number;
                    "cancellation_limit": number;
                    "cancellation_notice_minutes": number;
                    "cancellation_points": number;
                    "first_bonus_count": number;
                    "first_bonus_points": number;
                    "month_start": string;
                    "monthly_attendances": number;
                    "monthly_bonus": number;
                    "points_enabled": boolean;
                    "qualifying_attendances": number;
                    "second_bonus_count": number;
                    "second_bonus_points": number;
                }[];
            };
            "get_wellness_library_access": {
                Args: Record<PropertyKey, never>;
                Returns: boolean;
            };
            "issue_gym_display_qr": {
                Args: Record<PropertyKey, never>;
                Returns: {
                    "ends_at": string;
                    "expires_at": string;
                    "outcome": string;
                    "server_now": string;
                    "slot_id": string;
                    "starts_at": string;
                    "token": string;
                }[];
            };
            "issue_gym_qr_challenge": {
                Args: {
                    "p_reservation_id": string;
                };
                Returns: {
                    "challenge_id": string;
                    "expires_at": string;
                    "token": string;
                }[];
            };
            "join_gym_waitlist": {
                Args: {
                    "p_slot_id": string;
                };
                Returns: string;
            };
            "leave_gym_waitlist": {
                Args: {
                    "p_waitlist_id": string;
                };
                Returns: undefined;
            };
            "mark_notification_read": {
                Args: {
                    "p_notification_id": string;
                };
                Returns: undefined;
            };
            "record_gym_attendance": {
                Args: {
                    "p_reservation_id": string;
                };
                Returns: undefined;
            };
            "record_gym_manual_attendance": {
                Args: {
                    "p_reason": string;
                    "p_reservation_id": string;
                };
                Returns: {
                    "checked_in_at": string;
                    "outcome": string;
                    "reservation_id": string;
                }[];
            };
            "reserve_gym_slot": {
                Args: {
                    "p_slot_id": string;
                };
                Returns: string;
            };
            "respond_gym_waitlist_offer": {
                Args: {
                    "p_accept": boolean;
                    "p_offer_id": string;
                };
                Returns: {
                    "outcome": string;
                    "reservation_id": string;
                }[];
            };
            "staff_close_gym_slot": {
                Args: {
                    "p_evidence_confirmed": boolean;
                    "p_slot_id": string;
                };
                Returns: number;
            };
            "submit_absence_justification": {
                Args: {
                    "p_case_id": string;
                    "p_reason": string;
                };
                Returns: undefined;
            };
        };
        Enums: {
            "app_role": "user" | "gym_staff" | "admin";
            "attendance_method": "staff" | "qr";
            "gym_slot_status": "open" | "closed" | "cancelled";
            "reservation_status": "confirmed" | "cancelled";
            "waitlist_status": "waiting" | "promoted" | "cancelled" | "expired";
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};
type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
    Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
    Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
    schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
    schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
    schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
    "public": {
        Enums: {
            "app_role": ["user", "gym_staff", "admin"], "attendance_method": ["staff", "qr"], "gym_slot_status": ["open", "closed", "cancelled"], "reservation_status": ["confirmed", "cancelled"], "waitlist_status": ["waiting", "promoted", "cancelled", "expired"]
        }
    }
} as const;
