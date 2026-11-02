export type Team = "chauf" | "prep";
export type LeaveType = "CP" | "RTT" | "REC" | "MAL" | "FOR" | "EVT" | "CSS" | "AUI" | "RDV" | "ABS";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type AssetKind = "VEH" | "TRP" | "DIA" | "MAN";
export type RepairStatus = "A" | "T" | "V" | "R" | "F" | "X";
export type Urgency = "Bloquant" | "Urgent" | "Normal";

interface Row {
  id: string;
  created_at: string;
  updated_at: string | null;
  deleted_at?: string | null;
}

export interface Employee extends Row {
  legacy_id: string | null;
  name: string;
  job_title: string | null;
  team: Team;
  freelance: boolean;
  cp_annual: number;
  cp_carryover: number;
  rtt_annual: number;
  rec_due: number;
  sort_order: number;
  phone: string | null;
  email: string | null;
  hired_on: string | null;
  notes: string | null;
  active: boolean;
}

export interface LeaveRequest extends Row {
  employee_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  comment: string | null;
}

export interface DayMark {
  id: string;
  employee_id: string;
  date: string;
  type: LeaveType | "PRES";
}

export interface FreelanceCall {
  id: string;
  employee_id: string;
  date: string;
  triggered: boolean;
}

export interface Settings {
  id: number;
  max_abs: number;
  max_abs_prep: number;
  conformity_target: number;
  repair_contact_name: string;
  repair_contact_email: string | null;
  signature: string;
}

export interface Asset extends Row {
  kind: AssetKind;
  name: string;
  ref: string | null;
  designation: string | null;
  brand: string | null;
  model: string | null;
  tonnage: string | null;
  pallets: number | null;
  assigned_to: string | null;
  mileage: number | null;
  ct_due: string | null;
  service_due: string | null;
  insurance_due: string | null;
  note: string | null;
  active: boolean;
}

export interface Repair extends Row {
  asset_id: string | null;
  kind: AssetKind;
  label: string;
  category: string;
  urgency: Urgency;
  immobilized: boolean;
  status: RepairStatus;
  observed_on: string;
  expected_back: string | null;
  mileage: string | null;
  description: string | null;
  note: string | null;
  cost: number | null;
  closed_on: string | null;
}

export interface Client extends Row {
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  route: string | null;
  notes: string | null;
}

export interface DeliveryError extends Row {
  import_key: string | null;
  date: string;
  client_id: string | null;
  client_name: string;
  route: string | null;
  driver: string | null;
  goods: string | null;
  qty: number | null;
  packaging: string | null;
  error_type: string | null;
  origin: string | null;
  picker: string | null;
  other_resp: string | null;
  comment: string | null;
  source: string | null;
}

export interface Justification {
  id: string;
  error_id: string;
  q_ordre: string | null;
  q_accord: string | null;
  q_double: string | null;
  q_bon: string | null;
  q_rupture: string | null;
  q_consigne: string | null;
  employee_account: string | null;
  evidence: string | null;
  manager_notes: string | null;
  conclusion: string | null;
  collected_on: string | null;
}

export interface JournalEntry extends Row {
  entry_date: string;
  category: "evt" | "rem" | "note" | "inc";
  body: string;
  author: string | null;
}

export interface Announcement extends Row {
  kind: "prio" | "new" | "info";
  tool: string | null;
  body: string;
  expires_on: string | null;
}

export interface Member {
  id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  created_at: string;
  last_seen_at: string | null;
  password_set: boolean;
  invited_by: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor_email: string | null;
  table_name: string;
  row_id: string;
  action: "create" | "update" | "trash" | "restore" | "delete";
  label: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}
