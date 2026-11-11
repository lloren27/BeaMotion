type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type TrainingSessionStatus = 'pending' | 'completed' | 'not_completed';
type TrainingModelCode = 'A' | 'B' | 'C';

export type TrainingDatabase = {
  public: {
    Tables: {
      monthly_training_models: Table<
        { id: string; period_month: string; model_code: TrainingModelCode; draft: Json; revision: number; week_number: number; inherits_base: boolean },
        { id?: string; period_month: string; model_code: TrainingModelCode; draft?: Json; revision?: number; week_number?: number; inherits_base?: boolean },
        { draft?: Json; revision?: number; week_number?: number; inherits_base?: boolean }
      >;
      monthly_model_versions: Table<
        { id: string; model_id: string; version_number: number; snapshot: Json; published_at: string },
        { id?: string; model_id: string; version_number: number; snapshot: Json; published_at?: string },
        never
      >;
      exercise_catalog: Table<
        { id: string; name: string; description: string; patterns: string[]; laterality: string[]; positions: string[]; actions: string[]; band_color: string; weight_kg: number | null; action_time: string; notes: string; archived: boolean; created_at: string },
        { id?: string; name: string; description?: string; patterns?: string[]; laterality?: string[]; positions?: string[]; actions?: string[]; band_color?: string; weight_kg?: number | null; action_time?: string; notes?: string; archived?: boolean },
        { name?: string; description?: string; patterns?: string[]; laterality?: string[]; positions?: string[]; actions?: string[]; band_color?: string; weight_kg?: number | null; action_time?: string; notes?: string; archived?: boolean }
      >;
      training_monthly_plans: Table<
        { id: string; client_id: string; period_month: string; session_count: number; created_at: string },
        { id?: string; client_id: string; period_month: string; session_count: number; created_at?: string },
        { client_id?: string; period_month?: string; session_count?: number }
      >;
      training_sessions: Table<
        { id: string; plan_id: string; session_number: number; model_code: TrainingModelCode; status: TrainingSessionStatus; not_completed_reason: string | null; session_date: string | null; completed_at: string | null; created_at: string },
        { id?: string; plan_id: string; session_number: number; model_code: TrainingModelCode; status?: TrainingSessionStatus; not_completed_reason?: string | null; session_date?: string | null; completed_at?: string | null; created_at?: string },
        { status?: TrainingSessionStatus; not_completed_reason?: string | null; session_date?: string | null; completed_at?: string | null }
      >;
      training_exercises: Table<
        { id: string; session_id: string; position: number; name: string; notes: string | null; created_at: string },
        { id?: string; session_id: string; position: number; name: string; notes?: string | null; created_at?: string },
        { name?: string; notes?: string | null }
      >;
      training_sets: Table<
        { id: string; exercise_id: string; position: number; series_count: number | null; repetitions: string | null; rest: string | null; load: string | null; actual_series_count: string | null; actual_repetitions: string | null; actual_rest: string | null; actual_load: string | null; actual_notes: string | null; created_at: string },
        { id?: string; exercise_id: string; position: number; series_count?: number | null; repetitions?: string | null; rest?: string | null; load?: string | null; actual_series_count?: string | null; actual_repetitions?: string | null; actual_rest?: string | null; actual_load?: string | null; actual_notes?: string | null; created_at?: string },
        { series_count?: number | null; repetitions?: string | null; rest?: string | null; load?: string | null; actual_series_count?: string | null; actual_repetitions?: string | null; actual_rest?: string | null; actual_load?: string | null; actual_notes?: string | null }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      restore_week_from_base: { Args: { p_id: string; p_revision: number }; Returns: number };
      create_monthly_models: { Args: { p_month: string; p_copy_previous: boolean }; Returns: undefined };
      save_monthly_model_draft: { Args: { p_id: string; p_revision: number; p_draft: Json }; Returns: number };
      publish_monthly_model: { Args: { p_id: string; p_revision: number }; Returns: number };
      add_catalog_exercise_to_session: {
        Args: { p_session_id: string; p_position: number; p_catalog_id: string };
        Returns: string;
      };
      create_training_monthly_plan: {
        Args: { p_client_id: string; p_period_month: string; p_session_count: number };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
