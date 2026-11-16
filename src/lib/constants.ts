import type { LeadSource, LeadStatus, Role, CallOutcome } from "@prisma/client";

export const SCHOOL_NAME = "Birla Public School, Kishangarh";

export const STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "VISIT_SCHEDULED",
  "VISIT_DONE",
  "FORM_FILLED",
  "INTERACTION_DONE",
  "ADMISSION_CONFIRMED",
  "LOST",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  VISIT_SCHEDULED: "Visit Scheduled",
  VISIT_DONE: "Visit Done",
  FORM_FILLED: "Form Filled",
  INTERACTION_DONE: "Interaction / Test Done",
  ADMISSION_CONFIRMED: "Admission Confirmed",
  LOST: "Lost",
};

export const STATUS_COLOR: Record<LeadStatus, string> = {
  NEW: "bg-sky-100 text-sky-800 ring-sky-200",
  CONTACTED: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  INTERESTED: "bg-violet-100 text-violet-800 ring-violet-200",
  VISIT_SCHEDULED: "bg-amber-100 text-amber-800 ring-amber-200",
  VISIT_DONE: "bg-orange-100 text-orange-800 ring-orange-200",
  FORM_FILLED: "bg-teal-100 text-teal-800 ring-teal-200",
  INTERACTION_DONE: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  ADMISSION_CONFIRMED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  LOST: "bg-rose-100 text-rose-800 ring-rose-200",
};

export const SOURCES: LeadSource[] = [
  "FACEBOOK",
  "INSTAGRAM",
  "GOOGLE_ADS",
  "WEBSITE",
  "WALK_IN",
  "PHONE",
  "REFERRAL",
  "OTHER",
];

export const SOURCE_LABEL: Record<LeadSource, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  GOOGLE_ADS: "Google Ads",
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  PHONE: "Phone Enquiry",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  COUNSELOR: "Counselor / Teacher",
  VIEWER: "Viewer (Management)",
};

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  CONNECTED: "Connected - talked",
  NOT_ANSWERED: "Not answered",
  BUSY: "Busy",
  SWITCHED_OFF: "Switched off / Not reachable",
  WRONG_NUMBER: "Wrong number",
  CALL_BACK_LATER: "Asked to call back later",
};

export const CLASSES = [
  "Pre-Nursery",
  "Nursery",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11 - Science",
  "Class 11 - Commerce",
  "Class 11 - Arts",
  "Class 12",
];

export const LOST_REASONS = [
  "Fees too high",
  "Distance / location",
  "Chose another school",
  "Not reachable",
  "Not interested",
  "Fake / junk lead",
  "Seat not available",
  "Will apply next year",
  "Other",
];

export function currentSession(d = new Date()) {
  // Admissions for the next academic session start around October.
  const y = d.getFullYear();
  const start = d.getMonth() >= 8 ? y + 1 : y;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}
