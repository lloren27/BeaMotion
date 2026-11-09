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
      create_training_monthly_plan: {
        Args: { p_client_id: string; p_period_month: string; p_session_count: number };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
