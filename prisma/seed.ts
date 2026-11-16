/**
 * npm run db:seed              -> creates the first Super Admin only (from env or defaults)
 * SEED_DEMO=1 npm run db:seed  -> also adds demo users + ~150 demo leads (for showing the school)
 */
import { PrismaClient, type LeadSource, type LeadStatus, type CallOutcome } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || "superadmin@bps.local").toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD || "ChangeMe@123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({ data: { name: "Super Admin", email, role: "SUPER_ADMIN", autoAssign: false, passwordHash: await bcrypt.hash(password, 10) } });
    console.log(`Super Admin created: ${email} / ${password}  (change this password after first login!)`);
  } else console.log(`Super Admin exists: ${email}`);

  if (process.env.SEED_DEMO !== "1") return;
  if (await prisma.lead.count()) {
    console.log("Leads already exist, skipping demo data.");
    return;
  }
  const pw = await bcrypt.hash("Demo@1234", 10);
  const mk = (name: string, email: string, role: "ADMIN" | "COUNSELOR" | "VIEWER") =>
    prisma.user.upsert({ where: { email }, update: {}, create: { name, email, role, passwordHash: pw, autoAssign: role === "COUNSELOR" } });
  await mk("Admission Head", "admin@bps.local", "ADMIN");
  await mk("Management (Viewer)", "viewer@bps.local", "VIEWER");
  const counselors = await Promise.all([
    mk("Neha Sharma", "neha@bps.local", "COUNSELOR"),
    mk("Rakesh Jain", "rakesh@bps.local", "COUNSELOR"),
    mk("Pooja Agarwal", "pooja@bps.local", "COUNSELOR"),
  ]);

  const first = ["Ramesh", "Suresh", "Mahesh", "Anil", "Sunita", "Kavita", "Vikram", "Deepak", "Manoj", "Priya", "Rajendra", "Sanjay", "Meena", "Arvind", "Lokesh", "Geeta", "Naresh", "Pankaj", "Rekha", "Ashok"];
  const last = ["Sharma", "Jain", "Agarwal", "Choudhary", "Gupta", "Rathore", "Meena", "Khandelwal", "Sen", "Saini", "Kumawat", "Jat", "Soni", "Mathur"];
  const kids = ["Aarav", "Vivaan", "Anaya", "Diya", "Kabir", "Ishaan", "Myra", "Aditi", "Reyansh", "Saanvi", "Arjun", "Kiara", "Shaurya", "Navya"];
  const areas = ["Madanganj", "Kishangarh City", "Ajmer Road", "Roopangarh", "Arain", "Harmara", "Ajmer", "Bandar Sindri", "Gegal", "Silora", "Tilonia"];
  const classes = ["Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3", "Class 5", "Class 6", "Class 9", "Class 11 - Science", "Class 11 - Commerce"];
  const sources: LeadSource[] = ["FACEBOOK", "FACEBOOK", "INSTAGRAM", "INSTAGRAM", "GOOGLE_ADS", "WEBSITE", "WEBSITE", "WALK_IN", "PHONE", "REFERRAL"];
  const campaigns: Partial<Record<LeadSource, string[]>> = {
    FACEBOOK: ["Admissions Open 2027-28 | Leads", "Pre-Primary Admissions | Leads"],
    INSTAGRAM: ["Admissions Open 2027-28 | Leads", "Campus Tour Reels | Leads"],
    GOOGLE_ADS: ["Search - Best CBSE School Kishangarh"],
    WEBSITE: ["search-cbse-school", "meta-retargeting"],
  };
  const flow: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "VISIT_SCHEDULED", "VISIT_DONE", "FORM_FILLED", "INTERACTION_DONE", "ADMISSION_CONFIRMED"];
  const lostReasons = ["Fees too high", "Distance / location", "Chose another school", "Not reachable", "Fake / junk lead"];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

  for (let i = 0; i < 150; i++) {
    const daysAgo = Math.floor(Math.random() * 60);
    const createdAt = new Date(Date.now() - daysAgo * 86400_000 - Math.random() * 36e6);
    const source = pick(sources);
    const r = Math.random();
    const stageIdx = daysAgo < 2 ? 0 : Math.min(7, Math.floor(Math.pow(Math.random(), 1.6) * 8));
    const lost = daysAgo > 5 && r < 0.18;
    const status: LeadStatus = lost ? "LOST" : flow[stageIdx];
    const counselor = pick(counselors);
    const calls = status === "NEW" ? 0 : 1 + Math.floor(Math.random() * 4);
    const firstContact = calls ? new Date(createdAt.getTime() + (5 + Math.random() * 600) * 60000) : null;
    const lead = await prisma.lead.create({
      data: {
        parentName: `${pick(first)} ${pick(last)}`,
        phone: String(9000000000 + Math.floor(Math.random() * 999999999)),
        childName: pick(kids),
        classApplying: pick(classes),
        area: pick(areas),
        transportNeeded: Math.random() < 0.6,
        session: "2027-28",
        source,
        status,
        lostReason: lost ? pick(lostReasons) : null,
        campaignName: campaigns[source] ? pick(campaigns[source]!) : null,
        adName: source === "FACEBOOK" || source === "INSTAGRAM" ? pick(["Video - Campus Tour", "Carousel - Facilities", "Static - Admissions Open"]) : null,
        utmSource: source === "WEBSITE" ? pick(["google", "facebook", null]) : null,
        gclid: source === "WEBSITE" && Math.random() < 0.4 ? `demo-gclid-${i}` : null,
        assignedToId: counselor.id,
        callAttempts: calls,
        firstContactedAt: firstContact,
        lastContactedAt: firstContact,
        convertedAt: status === "ADMISSION_CONFIRMED" ? new Date(createdAt.getTime() + 10 * 86400_000) : null,
        nextFollowUpAt: status !== "ADMISSION_CONFIRMED" && status !== "LOST" && Math.random() < 0.7 ? new Date(Date.now() + (Math.random() * 6 - 2) * 86400_000) : null,
        createdAt,
      },
    });
    const acts: { type: "SYSTEM" | "CALL" | "STATUS_CHANGE"; content: string; userId?: string; callOutcome?: CallOutcome; fromStatus?: LeadStatus; toStatus?: LeadStatus; createdAt: Date }[] = [
      { type: "SYSTEM", content: `Lead created (demo data).`, createdAt },
    ];
    for (let c = 0; c < calls; c++)
      acts.push({
        type: "CALL",
        userId: counselor.id,
        callOutcome: c === calls - 1 ? "CONNECTED" : pick(["NOT_ANSWERED", "BUSY", "CONNECTED"] as CallOutcome[]),
        content: pick(["Discussed fees and transport.", "Asked to call after 6 pm.", "Interested, will discuss with family.", "Wants campus visit on Sunday."]),
        createdAt: new Date(createdAt.getTime() + (c + 1) * 3600_000),
      });
    const reachedIdx = lost ? Math.floor(Math.random() * 4) : stageIdx;
    for (let s = 1; s <= reachedIdx; s++)
      acts.push({ type: "STATUS_CHANGE", userId: counselor.id, fromStatus: flow[s - 1], toStatus: flow[s], content: `${flow[s - 1]} → ${flow[s]}`, createdAt: new Date(createdAt.getTime() + s * 86400_000) });
    if (lost) acts.push({ type: "STATUS_CHANGE", userId: counselor.id, fromStatus: flow[reachedIdx], toStatus: "LOST", content: "Marked lost", createdAt: new Date() });
    await prisma.activity.createMany({ data: acts.map((a) => ({ ...a, leadId: lead.id })) });
    if (lead.nextFollowUpAt) await prisma.followUp.create({ data: { leadId: lead.id, userId: counselor.id, dueAt: lead.nextFollowUpAt, note: "Call back" } });
  }
  const m = new Date().toISOString().slice(0, 7);
  const prev = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  for (const month of [m, prev]) {
    await prisma.campaignSpend.create({ data: { month, platform: "FACEBOOK", campaignName: "", amount: 18000 } });
    await prisma.campaignSpend.create({ data: { month, platform: "GOOGLE_ADS", campaignName: "", amount: 9000 } });
  }
  console.log("Demo data added. Demo logins (password Demo@1234): admin@bps.local, neha@bps.local, rakesh@bps.local, pooja@bps.local, viewer@bps.local");
}

main().finally(() => prisma.$disconnect());
