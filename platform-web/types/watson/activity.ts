// Types for Activity Logs / History

export type ActionType =
  | "import_excel"
  | "import_pricelist"
  | "edit_cell"
  | "delete_row"
  | "shift_row_left"
  | "shift_row_right"
  | "shift_column_left"
  | "shift_column_right"
  | "clear_cell"
  | "auto_fix"
  | "validate"
  | "export_excel"
  | "export_report"
  | "save_cloud"
  | "undo"
  | "redo";

export interface ActivityLog {
  id: string;
  timestamp: Date;
  action: ActionType;
  description: string;
  details: ActivityDetails;
  canUndo: boolean;
  undone: boolean;
  user?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

export interface ActivityDetails {
  // For file imports
  fileName?: string;
  rowCount?: number;

  // For cloud save
  exportId?: string;

  // For cell edits
  rowIndex?: number;
  columnName?: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;

  // For shift operations
  colIndex?: number;
  affectedRows?: number;

  // For validation
  errorCount?: number;
  warningCount?: number;

  // For auto-fix
  fixedCount?: number;

  // Snapshot for undo (stores previous data state)
  dataSnapshot?: unknown;
}

export interface HistorySummary {
  totalActions: number;
  edits: number;
  imports: number;
  shifts: number;
  undoable: number;
}
