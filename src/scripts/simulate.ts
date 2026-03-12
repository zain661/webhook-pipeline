const BASE_URL = "http://localhost:3000";

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(url: string) {
  const res = await fetch(url);
  return res.json();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function section(title: string) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(50));
}

async function simulate() {
  console.log("🌍 Starting Humanitarian Aid Pipeline Simulation\n");

  section("PIPELINE 1: Severity Classifier");

  const p1 = (await post(`${BASE_URL}/pipelines`, {
    name: "Medical Emergency Pipeline",
    action_type: "severity_classifier",
    action_config: {
      severity_field: "severity_score",
      drop_below: 3,
      levels: {
        critical: { operator: "gte", value: 8 },
        high: { operator: "gte", value: 5 },
      },
    },
    subscriber_urls: [
      "http://mock:3001/coordination",
      "http://mock:3001/emergency",
    ],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p1.id}`);

  console.log("\n🚨 CRITICAL report (score 9) → should deliver...");
  const j1 = (await post(`${BASE_URL}/webhooks/ingest/${p1.source_token}`, {
    event: "medical.request",
    location: "Al Shifa Hospital",
    severity_score: 9,
    needs: ["blood_bags", "oxygen", "surgical_kits"],
    patients_affected: 200,
    reporter: "Dr. Ahmad Khalil",
  })) as { job_id: string };
  console.log(`Job queued: ${j1.job_id}`);

  console.log("\n⚠️  HIGH report (score 6) → should deliver...");
  const j2 = (await post(`${BASE_URL}/webhooks/ingest/${p1.source_token}`, {
    event: "supply.request",
    location: "Rafah Crossing",
    severity_score: 6,
    needs: ["food_packages", "blankets"],
    families_affected: 500,
    reporter: "UNRWA Officer",
  })) as { job_id: string };
  console.log(`Job queued: ${j2.job_id}`);

  console.log("\n📝 LOW report (score 2) → should be DROPPED...");
  const j3 = (await post(`${BASE_URL}/webhooks/ingest/${p1.source_token}`, {
    event: "routine.update",
    location: "Khan Younis",
    severity_score: 2,
    notes: "Routine daily check",
    reporter: "Field Team C",
  })) as { job_id: string };
  console.log(`Job queued: ${j3.job_id} (will be dropped)`);

  section("PIPELINE 2: Field Normalizer");

  const p2 = (await post(`${BASE_URL}/pipelines`, {
    name: "UNRWA Field Reports Normalizer",
    action_type: "field_normalizer",
    action_config: {
      normalize: {
        location: ["area", "zone", "region", "place"],
        contact: ["submitted_by", "reporter", "officer", "filed_by"],
        urgency: ["priority", "severity_level", "level"],
      },
      remove_nulls: true,
    },
    subscriber_urls: ["http://mock:3001/coordination"],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p2.id}`);

  console.log(
    "\n📋 UNRWA format (area, submitted_by) → normalizes to standard fields...",
  );
  const j4 = (await post(`${BASE_URL}/webhooks/ingest/${p2.source_token}`, {
    event: "sitrep.update",
    area: "North Gaza",
    severity_score: 7,
    submitted_by: "UNRWA Officer",
    priority: "high",
    notes: null,
  })) as { job_id: string };
  console.log(`Job queued: ${j4.job_id}`);

  console.log(
    "\n📋 Red Crescent format (zone, reporter) → normalizes to standard fields...",
  );
  const j5 = (await post(`${BASE_URL}/webhooks/ingest/${p2.source_token}`, {
    event: "medical.request",
    zone: "Gaza City",
    severity_score: 9,
    reporter: "Dr. Sarah",
    level: "critical",
    notes: null,
  })) as { job_id: string };
  console.log(`Job queued: ${j5.job_id}`);

  section("PIPELINE 3: Keyword Alert");

  const p3 = (await post(`${BASE_URL}/pipelines`, {
    name: "Critical Keyword Scanner",
    action_type: "keyword_alert",
    action_config: {
      scan_field: "description",
      critical_keywords: [
        "airstrike",
        "casualty",
        "hospital hit",
        "evacuation",
        "siege",
      ],
      flag_field: "requires_immediate_action",
      drop_if_no_match: false,
    },
    subscriber_urls: [
      "http://mock:3001/emergency",
      "http://mock:3001/coordination",
    ],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p3.id}`);

  console.log("\n🔴 Report WITH critical keywords → flagged as true...");
  const j6 = (await post(`${BASE_URL}/webhooks/ingest/${p3.source_token}`, {
    event: "field.report",
    location: "North Gaza",
    description:
      "Airstrike hit near the hospital, multiple casualty reported, evacuation needed",
    reporter: "Field Team A",
    severity_score: 9,
  })) as { job_id: string };
  console.log(`Job queued: ${j6.job_id}`);

  console.log("\n🟢 Routine report WITHOUT keywords → flagged as false...");
  const j7 = (await post(`${BASE_URL}/webhooks/ingest/${p3.source_token}`, {
    event: "field.report",
    location: "Khan Younis",
    description: "Daily supply check completed, all teams accounted for",
    reporter: "Field Team D",
    severity_score: 3,
  })) as { job_id: string };
  console.log(`Job queued: ${j7.job_id}`);

  section("PIPELINE 4: Response Enricher");

  const p4 = (await post(`${BASE_URL}/pipelines`, {
    name: "Response Metadata Enricher",
    action_type: "response_enricher",
    action_config: {
      addTimestamp: true,
      addPipelineId: true,
      addField: {
        system: "humanitarian-aid-pipeline",
        region: "Gaza",
        version: "1.0",
      },
      priorityMap: {
        critical: "P1 - Respond within 1 hour",
        high: "P2 - Respond within 4 hours",
        low: "P3 - Respond within 24 hours",
      },
      prioritySource: "classification",
    },
    subscriber_urls: [
      "http://mock:3001/coordination",
      "http://mock:3001/donors",
    ],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p4.id}`);

  console.log(
    "\n📦 Supply shipment → enriched with metadata and response window...",
  );
  const j8 = (await post(`${BASE_URL}/webhooks/ingest/${p4.source_token}`, {
    event: "supply.arrived",
    location: "Kerem Shalom Crossing",
    classification: "critical",
    shipment_id: "SHIP-2026-441",
    contents: ["medicine", "food", "blankets"],
    quantity: 5000,
    donor: "Qatar Red Crescent",
  })) as { job_id: string };
  console.log(`Job queued: ${j8.job_id}`);

  section("Waiting for worker to process all jobs...");
  console.log("⏳ Waiting 6 seconds...");
  await sleep(6000);

  section("Checking Job Results");

  const jobIds = [
    { id: j1.job_id, label: "CRITICAL medical (should be completed)" },
    { id: j2.job_id, label: "HIGH supply (should be completed)" },
    {
      id: j3.job_id,
      label: "LOW routine (should be dropped/completed, 0 deliveries)",
    },
    { id: j4.job_id, label: "UNRWA format normalized" },
    { id: j6.job_id, label: "Keyword match flagged" },
    { id: j8.job_id, label: "Enriched with metadata" },
  ];

  for (const { id, label } of jobIds) {
    const status = await get(`${BASE_URL}/jobs/${id}/status`);
    console.log(`\n📌 ${label}`);
    console.log(`   status: ${status.status}`);

    const history = await get(`${BASE_URL}/jobs/${id}/history`);
    console.log(
      `   input keys:  ${Object.keys(history.input || {}).join(", ")}`,
    );
    console.log(
      `   output keys: ${Object.keys(history.output || {}).join(", ")}`,
    );

    const attempts = await get(`${BASE_URL}/jobs/${id}/attempts`);
    console.log(`   deliveries:  ${attempts.total_attempts} attempt(s)`);
    if (attempts.attempts?.length > 0) {
      attempts.attempts.forEach(
        (a: {
          subscriber_url: string;
          status: string;
          response_code: number;
        }) => {
          console.log(
            `     → ${a.subscriber_url} [${a.status}] ${a.response_code}`,
          );
        },
      );
    }
  }

  section("Simulation Complete ✅");
  console.log("Check docker compose logs mock for full delivery details\n");
}

simulate().catch(console.error);
