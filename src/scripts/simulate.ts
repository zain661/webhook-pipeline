const BASE_URL = 'http://localhost:3000';

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

async function simulate() {
  console.log('🌍 Starting Humanitarian Aid Pipeline Simulation\n');

  // ─────────────────────────────────────────
  section('PIPELINE 1: Severity Classifier');
  // ─────────────────────────────────────────

  const p1 = (await post(`${BASE_URL}/pipelines`, {
    name: 'Medical Emergency Pipeline',
    action_type: 'severity_classifier',
    action_config: {
      severity_field: 'severity_score',
      drop_below: 3,
      levels: {
        critical: { operator: 'gte', value: 8 },
        high: { operator: 'gte', value: 5 },
      },
    },
    subscriber_urls: ['http://mock:3001/coordination', 'http://mock:3001/emergency'],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p1.id}`);

  console.log('\n🚨 CRITICAL report (score 9) → should deliver...');
  const j1 = (await post(`${BASE_URL}/webhooks/ingest/${p1.source_token}`, {
    event: 'medical.request',
    location: 'Al Shifa Hospital',
    severity_score: 9,
    needs: ['blood_bags', 'oxygen', 'surgical_kits'],
    patients_affected: 200,
    reporter: 'Dr. Ahmad Khalil',
  })) as { job_id: string };
  console.log(`Job queued: ${j1.job_id}`);

  console.log('\n⚠️  HIGH report (score 6) → should deliver...');
  const j2 = (await post(`${BASE_URL}/webhooks/ingest/${p1.source_token}`, {
    event: 'supply.request',
    location: 'Rafah Crossing',
    severity_score: 6,
    needs: ['food_packages', 'blankets'],
    families_affected: 500,
    reporter: 'UNRWA Officer',
  })) as { job_id: string };
  console.log(`Job queued: ${j2.job_id}`);

  console.log('\n📝 LOW report (score 2) → should be DROPPED...');
  const j3 = (await post(`${BASE_URL}/webhooks/ingest/${p1.source_token}`, {
    event: 'routine.update',
    location: 'Khan Younis',
    severity_score: 2,
    notes: 'Routine daily check',
    reporter: 'Field Team C',
  })) as { job_id: string };
  console.log(`Job queued: ${j3.job_id} (will be dropped)`);

  // ─────────────────────────────────────────
  section('PIPELINE 2: Field Normalizer');
  // ─────────────────────────────────────────

  const p2 = (await post(`${BASE_URL}/pipelines`, {
    name: 'UNRWA Field Reports Normalizer',
    action_type: 'field_normalizer',
    action_config: {
      normalize: {
        location: ['area', 'zone', 'region', 'place'],
        contact: ['submitted_by', 'reporter', 'officer', 'filed_by'],
        urgency: ['priority', 'severity_level', 'level'],
      },
      remove_nulls: true,
    },
    subscriber_urls: ['http://mock:3001/coordination'],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p2.id}`);

  console.log('\n📋 UNRWA format (area, submitted_by) → normalizes to standard fields...');
  const j4 = (await post(`${BASE_URL}/webhooks/ingest/${p2.source_token}`, {
    event: 'sitrep.update',
    area: 'North Gaza',
    severity_score: 7,
    submitted_by: 'UNRWA Officer',
    priority: 'high',
    notes: null,
  })) as { job_id: string };
  console.log(`Job queued: ${j4.job_id}`);

  console.log('\n📋 Red Crescent format (zone, reporter) → normalizes to standard fields...');
  const j5 = (await post(`${BASE_URL}/webhooks/ingest/${p2.source_token}`, {
    event: 'medical.request',
    zone: 'Gaza City',
    severity_score: 9,
    reporter: 'Dr. Sarah',
    level: 'critical',
    notes: null,
  })) as { job_id: string };
  console.log(`Job queued: ${j5.job_id}`);

  // ─────────────────────────────────────────
  section('PIPELINE 3: Keyword Alert');
  // ─────────────────────────────────────────

  const p3 = (await post(`${BASE_URL}/pipelines`, {
    name: 'Critical Keyword Scanner',
    action_type: 'keyword_alert',
    action_config: {
      scan_field: 'description',
      critical_keywords: ['airstrike', 'casualty', 'hospital hit', 'evacuation', 'siege'],
      flag_field: 'requires_immediate_action',
      drop_if_no_match: false,
    },
    subscriber_urls: ['http://mock:3001/emergency', 'http://mock:3001/coordination'],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p3.id}`);

  console.log('\n🔴 Report WITH critical keywords → flagged as true...');
  const j6 = (await post(`${BASE_URL}/webhooks/ingest/${p3.source_token}`, {
    event: 'field.report',
    location: 'North Gaza',
    description: 'Airstrike hit near the hospital, multiple casualty reported, evacuation needed',
    reporter: 'Field Team A',
    severity_score: 9,
  })) as { job_id: string };
  console.log(`Job queued: ${j6.job_id}`);

  console.log('\n🟢 Routine report WITHOUT keywords → flagged as false...');
  const j7 = (await post(`${BASE_URL}/webhooks/ingest/${p3.source_token}`, {
    event: 'field.report',
    location: 'Khan Younis',
    description: 'Daily supply check completed, all teams accounted for',
    reporter: 'Field Team D',
    severity_score: 3,
  })) as { job_id: string };
  console.log(`Job queued: ${j7.job_id}`);

  // ─────────────────────────────────────────
  section('PIPELINE 4: Response Enricher');
  // ─────────────────────────────────────────

  const p4 = (await post(`${BASE_URL}/pipelines`, {
    name: 'Response Metadata Enricher',
    action_type: 'response_enricher',
    action_config: {
      addTimestamp: true,
      addPipelineId: true,
      addField: {
        system: 'humanitarian-aid-pipeline',
        region: 'Gaza',
        version: '1.0',
      },
      priorityMap: {
        critical: 'P1 - Respond within 1 hour',
        high: 'P2 - Respond within 4 hours',
        low: 'P3 - Respond within 24 hours',
      },
      prioritySource: 'classification',
    },
    subscriber_urls: ['http://mock:3001/coordination', 'http://mock:3001/donors'],
  })) as { id: string; source_token: string };
  console.log(`Pipeline created: ${p4.id}`);

  console.log('\n📦 Supply shipment → enriched with metadata and response window...');
  const j8 = (await post(`${BASE_URL}/webhooks/ingest/${p4.source_token}`, {
    event: 'supply.arrived',
    location: 'Kerem Shalom Crossing',
    classification: 'critical',
    shipment_id: 'SHIP-2026-441',
    contents: ['medicine', 'food', 'blankets'],
    quantity: 5000,
    donor: 'Qatar Red Crescent',
  })) as { job_id: string };
  console.log(`Job queued: ${j8.job_id}`);

  // ─────────────────────────────────────────
  section('Waiting for worker to process all jobs...');
  // ─────────────────────────────────────────

  console.log('⏳ Waiting 6 seconds...');
  await sleep(6000);

  // ─────────────────────────────────────────
  section('Checking Job Results');
  // ─────────────────────────────────────────

  const jobIds = [
    { id: j1.job_id, label: 'CRITICAL medical (should be completed)' },
    { id: j2.job_id, label: 'HIGH supply (should be completed)' },
    { id: j3.job_id, label: 'LOW routine (should be dropped/completed, 0 deliveries)' },
    { id: j4.job_id, label: 'UNRWA format normalized' },
    { id: j6.job_id, label: 'Keyword match flagged' },
    { id: j8.job_id, label: 'Enriched with metadata' },
  ];

  for (const { id, label } of jobIds) {
    const status = await get(`${BASE_URL}/jobs/${id}/status`);
    console.log(`\n📌 ${label}`);
    console.log(`   status: ${status.status}`);

    const history = await get(`${BASE_URL}/jobs/${id}/history`);
    console.log(`   input keys:  ${Object.keys(history.input || {}).join(', ')}`);
    console.log(`   output keys: ${Object.keys(history.output || {}).join(', ')}`);

    const attempts = await get(`${BASE_URL}/jobs/${id}/attempts`);
    console.log(`   deliveries:  ${attempts.total_attempts} attempt(s)`);
    if (attempts.attempts?.length > 0) {
      attempts.attempts.forEach(
        (a: { subscriber_url: string; status: string; response_code: number }) => {
          console.log(`     → ${a.subscriber_url} [${a.status}] ${a.response_code}`);
        }
      );
    }
  }

  section('Simulation Complete ✅');
  console.log('Check docker compose logs mock for full delivery details\n');

  // Run performance tests
  await firstJobLatencyTest();
  await loadTest();
  await priorityTest();
}

// ─────────────────────────────────────────────────────────
// TEST 1: First job latency
// Shows: how fast does ONE job get picked up and processed?
// Polling: up to 3000ms delay
// BullMQ: ~50-100ms instant
// ─────────────────────────────────────────────────────────
async function firstJobLatencyTest() {
  section('TEST 1: First Job Latency — Webhook → Completed');

  const p = (await post(`${BASE_URL}/pipelines`, {
    name: 'Latency Test Pipeline',
    action_type: 'severity_classifier',
    action_config: {
      severity_field: 'severity_score',
      drop_below: 1,
      levels: { critical: { operator: 'gte', value: 8 } },
    },
    subscriber_urls: ['http://mock:3001/coordination'],
  })) as { id: string; source_token: string };

  console.log('⏱️  Sending 1 job and measuring time until completed...\n');

  const start = Date.now();

  const job = (await post(`${BASE_URL}/webhooks/ingest/${p.source_token}`, {
    event: 'latency.test',
    severity_score: 9,
    location: 'Test Location',
  })) as { job_id: string };

  // Poll every 100ms until completed
  let latency = 0;
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    const status = await get(`${BASE_URL}/jobs/${job.job_id}/status`);
    if (status.status === 'completed') {
      latency = Date.now() - start;
      break;
    }
  }

  console.log(`   Job ID: ${job.job_id.slice(0, 8)}...`);
  console.log(`   ⚡ Completed in: ${latency}ms`);

  if (latency < 500) {
    console.log(`   ✅ FAST — Event-driven (BullMQ) approach`);
    console.log(`   Jobs are picked up instantly from the queue`);
  } else if (latency < 3500) {
    console.log(`   ⏳ MODERATE — likely polling approach`);
    console.log(`   Worker waited for next poll cycle before processing`);
  } else {
    console.log(`   🐌 SLOW — polling with high interval`);
  }
}

// ─────────────────────────────────────────────────────────
// TEST 2: Load test — increasing batch sizes
// Shows: how does the system handle burst traffic?
// Polling: linear growth (each job waits for poll)
// BullMQ: scales with concurrency (5 at a time)
// ─────────────────────────────────────────────────────────
async function loadTest() {
  section('TEST 2: Load Test — Burst Traffic at Scale');

  const p = (await post(`${BASE_URL}/pipelines`, {
    name: 'Load Test Pipeline',
    action_type: 'severity_classifier',
    action_config: {
      severity_field: 'severity_score',
      drop_below: 1,
      levels: {
        critical: { operator: 'gte', value: 8 },
        high: { operator: 'gte', value: 5 },
      },
    },
    subscriber_urls: ['http://mock:3001/coordination'],
  })) as { id: string; source_token: string };

  console.log('Sending increasing batches simultaneously and measuring throughput:\n');

  const results: { count: number; queuedIn: number; totalTime: number; throughput: number }[] = [];

  for (const count of [10, 50, 100]) {
    process.stdout.write(`   📦 ${count} jobs: queuing...`);

    const start = Date.now();

    // Send ALL jobs simultaneously
    const jobs = (await Promise.all(
      Array.from({ length: count }, (_, i) =>
        post(`${BASE_URL}/webhooks/ingest/${p.source_token}`, {
          event: 'load.test',
          report_number: i + 1,
          severity_score: Math.floor(Math.random() * 10) + 1,
          location: `Location ${i + 1}`,
        })
      )
    )) as { job_id: string }[];

    const queuedIn = Date.now() - start;
    process.stdout.write(` queued in ${queuedIn}ms, processing`);

    // Poll until ALL completed — no artificial sleep
    let completed = 0;
    while (completed < count) {
      await sleep(300);
      const statuses = await Promise.all(
        jobs.map((j) => get(`${BASE_URL}/jobs/${j.job_id}/status`))
      );
      completed = statuses.filter((s) => s.status === 'completed').length;
      process.stdout.write('.');
    }

    const totalTime = Date.now() - start;
    const throughput = Math.round(count / (totalTime / 1000));

    results.push({ count, queuedIn, totalTime, throughput });
    console.log(` done!`);
    console.log(`      ⚡ Queued in:   ${queuedIn}ms`);
    console.log(`      ✅ Total time:  ${totalTime}ms`);
    console.log(`      📊 Avg/job:     ${Math.round(totalTime / count)}ms`);
    console.log(`      🚀 Throughput:  ${throughput} jobs/sec\n`);
  }

  // Summary table
  console.log('   ┌─────────┬──────────────┬─────────────┬──────────────────┐');
  console.log('   │  Jobs   │  Total Time  │  Avg/job    │  Throughput      │');
  console.log('   ├─────────┼──────────────┼─────────────┼──────────────────┤');
  for (const r of results) {
    const jobs = String(r.count).padEnd(7);
    const time = `${r.totalTime}ms`.padEnd(12);
    const avg = `${Math.round(r.totalTime / r.count)}ms`.padEnd(11);
    const tp = `${r.throughput} jobs/sec`.padEnd(16);
    console.log(`   │ ${jobs} │ ${time} │ ${avg} │ ${tp} │`);
  }
  console.log('   └─────────┴──────────────┴─────────────┴──────────────────┘');

  // Scaling analysis
  const first = results[0];
  const last = results[results.length - 1];
  const scalingFactor = (last.totalTime / last.count / (first.totalTime / first.count)).toFixed(2);

  console.log(
    `\n   📈 Scaling factor: ${scalingFactor}x avg time increase from ${first.count} → ${last.count} jobs`
  );
  if (Number(scalingFactor) < 1.5) {
    console.log(`   ✅ SCALES WELL — avg time stays low as load increases (BullMQ concurrency)`);
  } else {
    console.log(`   ⚠️  LINEAR GROWTH — avg time grows with load (polling bottleneck)`);
  }
}

// ─────────────────────────────────────────────────────────
// TEST 3: Priority queue
// Shows: critical reports jump ahead of routine ones
// Polling: FIFO only — no priority
// BullMQ: priority 1 (critical) processes before priority 10
// ─────────────────────────────────────────────────────────
async function priorityTest() {
  section('TEST 3: Priority Queue — Critical Reports First');

  const p = (await post(`${BASE_URL}/pipelines`, {
    name: 'Priority Test Pipeline',
    action_type: 'severity_classifier',
    action_config: {
      severity_field: 'severity_score',
      drop_below: 1,
      levels: { critical: { operator: 'gte', value: 8 } },
    },
    subscriber_urls: ['http://mock:3001/emergency'],
  })) as { id: string; source_token: string };

  console.log('Sending 20 ROUTINE reports then 1 CRITICAL simultaneously');
  console.log('Critical should process before remaining routine ones...\n');

  // Send 20 routine + 1 critical ALL at the same time
  // so they all land in queue together
  const allJobs = (await Promise.all([
    // 20 routine reports
    ...Array.from({ length: 20 }, (_, i) =>
      post(`${BASE_URL}/webhooks/ingest/${p.source_token}`, {
        event: `routine.${i + 1}`,
        severity_score: 3,
        location: `Routine Location ${i + 1}`,
      })
    ),
    // 1 critical — sent simultaneously with all routine
    post(`${BASE_URL}/webhooks/ingest/${p.source_token}`, {
      event: 'CRITICAL.airstrike',
      severity_score: 9,
      location: 'Al Shifa Hospital',
    }),
  ])) as { job_id: string }[];

  const criticalJob = allJobs[allJobs.length - 1];
  const routineJobs = allJobs.slice(0, 20);

  console.log(`   🔴 Critical job: ${criticalJob.job_id.slice(0, 8)}...`);
  console.log(`   📋 Routine jobs: ${routineJobs.length} sent simultaneously\n`);

  // Wait for all to complete
  let allDone = false;
  while (!allDone) {
    await sleep(300);
    const statuses = await Promise.all(
      allJobs.map((j) => get(`${BASE_URL}/jobs/${j.job_id}/status`))
    );
    allDone = statuses.every((s) => s.status === 'completed');
  }

  // Check processing order by processed_at timestamp
  const criticalResult = await get(`${BASE_URL}/jobs/${criticalJob.job_id}/history`);
  const routineResults = await Promise.all(
    routineJobs.map((j) => get(`${BASE_URL}/jobs/${j.job_id}/history`))
  );

  const criticalTime = new Date(criticalResult.processed_at).getTime();
  const routineProcessedBefore = routineResults.filter(
    (r) => new Date(r.processed_at).getTime() < criticalTime
  ).length;

  // Sort all by processed_at to show order
  const allResults = [
    { id: criticalJob.job_id.slice(0, 8), type: '🔴 CRITICAL', time: criticalTime },
    ...routineResults.map((r, i) => ({
      id: routineJobs[i].job_id.slice(0, 8),
      type: '📋 routine',
      time: new Date(r.processed_at).getTime(),
    })),
  ].sort((a, b) => a.time - b.time);

  console.log('   Processing order (by processed_at):');
  allResults.slice(0, 8).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.type} ${r.id}...`);
  });
  if (allResults.length > 8) console.log(`   ... and ${allResults.length - 8} more`);

  console.log(`\n   Routine jobs processed before critical: ${routineProcessedBefore}/20`);

  if (routineProcessedBefore <= 4) {
    console.log(`\n   ✅ PRIORITY WORKS — Critical jumped ahead of most routine jobs ⭐`);
    console.log(`   (Some overlap is expected due to 5 concurrent workers)`);
  } else if (routineProcessedBefore <= 10) {
    console.log(`\n   ⚠️  PARTIAL PRIORITY — Critical got some advantage`);
  } else {
    console.log(`\n   ❌ NO PRIORITY — Pure FIFO order`);
    console.log(`   On polling branch this is expected behavior`);
  }
}

simulate().catch(console.error);